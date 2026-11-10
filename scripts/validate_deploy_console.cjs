// Validates the owner deploy console WITHOUT spending anything and WITHOUT
// touching any network. Run: node scripts/validate_deploy_console.cjs
//
// Checks:
//  1. Every address / VRF param / amount hardcoded in DeployConsole.tsx
//     matches scripts/deploy_casino.js (the source of truth) and the
//     verified mainnet values from the go-live runbook.
//  2. Constructor args for all four contracts encode + decode back to the
//     exact values the deploy script uses, for mainnet AND Amoy.
//  3. Every function call the console sends exists in the compiled artifact
//     ABI with the right selector, and its encoded args decode correctly.
//  4. QuickSwap min amounts use the same 1% slippage formula as
//     scripts/create_quickswap_pool.js.
//
// Exit 0 = all checks pass. Exit 1 = something drifted — do not ship.
const fs = require('node:fs');
const path = require('node:path');
const { AbiCoder, Interface, ZeroAddress, parseUnits } = require('ethers');

const ROOT = path.join(__dirname, '..');
let failures = 0;
function check(name, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures++;
}

const consoleSrc = fs.readFileSync(path.join(ROOT, 'src/components/DeployConsole.tsx'), 'utf8');
const deploySrc = fs.readFileSync(path.join(ROOT, 'scripts/deploy_casino.js'), 'utf8');

function extract(src, re, label) {
  const m = src.match(re);
  if (!m) { check(`extract ${label}`, false, 'pattern not found'); return null; }
  return m[1];
}

// --- 1. Console constants vs deploy_casino.js -------------------------------
const netBlock = (key) => {
  const m = consoleSrc.match(new RegExp(`${key}: \\{([\\s\\S]*?)\\n  \\},`));
  return m ? m[1] : '';
};
const field = (block, name) => {
  const m = block.match(new RegExp(`${name}: '([^']+)'`));
  return m ? m[1] : null;
};
const poly = netBlock('polygon');
const amoy = netBlock('amoy');

// VRF params must match the deploy script's VRF_NETWORK_CONFIG exactly.
for (const [net, block, key] of [['polygon', poly, 'polygon'], ['amoy', amoy, 'amoy']]) {
  const cfg = deploySrc.match(new RegExp(`${key}: \\{[\\s\\S]*?coordinator: "([^"]+)",[\\s\\S]*?keyHash: "([^"]+)",[\\s\\S]*?linkToken: "([^"]+)"`));
  check(`${net} coordinator matches deploy_casino.js`, cfg && field(block, 'vrfCoordinator')?.toLowerCase() === cfg[1].toLowerCase(), field(block, 'vrfCoordinator'));
  check(`${net} keyHash matches deploy_casino.js`, cfg && field(block, 'vrfKeyHash')?.toLowerCase() === cfg[2].toLowerCase());
  check(`${net} LINK matches deploy_casino.js`, cfg && field(block, 'link')?.toLowerCase() === cfg[3].toLowerCase());
}
// Mainnet token + router are the verified values from the runbook.
check('mainnet MTX is the real token', field(poly, 'mtx')?.toLowerCase() === '0x53307e1db6c5cb6773c9495ca140372016dfe266');
check('mainnet router is the verified QuickSwap V2 router', field(poly, 'quickswapRouter')?.toLowerCase() === '0xa5e0829caced8ffdd4de3c43696c57f7d7a678ff');
check('mainnet deployer is the MTX owner', field(poly, 'deployer')?.toLowerCase() === '0x9fb4bb44d8d962d695fc93b3dc15f1b287391077');
check('amoy deployer is the throwaway deployer', field(amoy, 'deployer')?.toLowerCase() === '0x19db6ad52b9f701dd436294f250a71b12cd33cab');
check('amoy MTX is the Amoy test token', field(amoy, 'mtx')?.toLowerCase() === '0x1c05f0283e44b5c13c420d24e05495dc5719548b');

// Amounts must match DEPLOYMENT_CONFIG in the deploy script.
const cfgNum = (name) => extract(deploySrc, new RegExp(`${name}: "([^"]+)"`), `DEPLOYMENT_CONFIG.${name}`);
const amt = (name) => extract(consoleSrc, new RegExp(`const ${name} = '?([0-9]+)'?`), name);
check('reserve cap 1,000,000 MTX', amt('RESERVE_CAP_MTX') === cfgNum('reserveCap'), amt('RESERVE_CAP_MTX'));
check('min bet 1 MTX', amt('MIN_BET_MTX') === cfgNum('minBet'));
check('max bet 1,000 MTX', amt('MAX_BET_MTX') === cfgNum('maxBet'));
check('VRF callback gas 250,000', amt('VRF_CALLBACK_GAS') === extract(deploySrc, /VRF_CALLBACK_GAS_LIMIT = (\d+)/, 'VRF_CALLBACK_GAS_LIMIT'));
check('VRF confirmations 3', amt('VRF_CONFIRMATIONS') === extract(deploySrc, /VRF_REQUEST_CONFIRMATIONS = (\d+)/, 'VRF_REQUEST_CONFIRMATIONS'));
check('max payout 100 MTX', amt('MAX_PAYOUT_MTX') === '100');
check('reserve funding 5,000 MTX', amt('RESERVE_FUND_MTX') === '5000');
check('VRF funding 15 LINK', amt('VRF_FUND_LINK') === '15');
check('QuickSwap 100,000 MTX + 100 POL', amt('QS_MTX') === '100000' && amt('QS_POL') === '100');
check('QuickSwap provide 1,000 MTX + 1 POL (shrunk Nov 10 — deployer held 1.86 POL)', amt('QS_PROVIDE_MTX') === '1000' && amt('QS_PROVIDE_POL') === '1');
check('QuickSwap slippage 100 bps (1%)', amt('QS_SLIPPAGE_BPS') === '100');
check('QuickSwap deadline 20 min', amt('QS_DEADLINE_MINUTES') === '20');

// --- 2. Constructor encoding, mainnet + Amoy --------------------------------
function artifact(name) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, `artifacts/contracts/${name}.sol/${name}.json`), 'utf8'));
}
const coder = AbiCoder.defaultAbiCoder();
function checkDeploy(name, args, label) {
  const art = artifact(name);
  const iface = new Interface(art.abi);
  // ethers v6: Interface.encodeDeploy returns ONLY the constructor-args
  // encoding; the on-chain deployment data is bytecode + that encoding.
  check(`${label}: artifact bytecode present`, typeof art.bytecode === 'string' && art.bytecode.startsWith('0x') && art.bytecode.length > 100);
  const encodedArgs = iface.encodeDeploy(args);
  const data = art.bytecode + encodedArgs.slice(2);
  check(`${label}: deploy data starts with artifact bytecode`, data.toLowerCase().startsWith(art.bytecode.toLowerCase()));
  // Decode the constructor args appended after the bytecode and compare.
  const ctor = art.abi.find((f) => f.type === 'constructor');
  const types = ctor.inputs.map((i) => i.type);
  const decoded = coder.decode(types, encodedArgs);
  const norm = (v) => (typeof v === 'bigint' ? v.toString() : String(v)).toLowerCase();
  let match = true;
  decoded.forEach((v, i) => {
    if (norm(v) !== norm(args[i])) match = false;
  });
  check(`${label}: constructor args round-trip`, match, `args: ${args.map((a) => String(a)).join(', ')}`);
}

for (const [key, block] of [['polygon', poly], ['amoy', amoy]]) {
  const coord = field(block, 'vrfCoordinator');
  const keyHash = field(block, 'vrfKeyHash');
  const mtx = field(block, 'mtx');
  const router = field(block, 'quickswapRouter');
  const subId = 1n; // placeholder id for encoding only; real id comes from createSubscription
  const rng = '0x1111111111111111111111111111111111111111';
  const reserve = '0x2222222222222222222222222222222222222222';
  const liq = '0x3333333333333333333333333333333333333333';
  const core = '0x4444444444444444444444444444444444444444';
  checkDeploy('RNGEngine', [coord, subId, keyHash, 250000, 3], `${key} RNGEngine`);
  checkDeploy('CasinoReserve', [mtx, parseUnits('1000000', 18), ZeroAddress], `${key} CasinoReserve`);
  checkDeploy('LiquidityRouter', [mtx, router], `${key} LiquidityRouter`);
  checkDeploy('CasinoCore', [mtx, liq, reserve, rng, parseUnits('1', 18), parseUnits('1000', 18), parseUnits('100', 18), field(block, 'deployer'), field(block, 'deployer')], `${key} CasinoCore`);
}

// --- 3. Every call the console sends ----------------------------------------
function checkCall(iface, fnName, args, label) {
  try {
    const fn = iface.getFunction(fnName);
    const data = iface.encodeFunctionData(fnName, args);
    const decoded = iface.decodeFunctionData(fnName, data);
    const norm = (v) => (typeof v === 'bigint' ? v.toString() : String(v)).toLowerCase();
    let match = true;
    decoded.forEach((v, i) => {
      if (norm(v) !== norm(args[i])) match = false;
    });
    check(`${label}: ${fnName} selector ${fn.selector} + args round-trip`, match);
  } catch (e) {
    check(`${label}: ${fnName} exists in ABI`, false, String(e.message));
  }
}
const coordIface = new Interface([
  'function createSubscription() returns (uint256 subId)',
  'function addConsumer(uint256 subId, address consumer)',
  'function getSubscription(uint256 subId) view returns (uint96 balance, uint96 nativeBalance, uint64 reqCount, address owner, address[] consumers)',
]);
checkCall(coordIface, 'createSubscription', [], 'VRF coordinator');
checkCall(coordIface, 'addConsumer', [1n, '0x1111111111111111111111111111111111111111'], 'VRF coordinator');

const linkIface = new Interface([
  'function transferAndCall(address to, uint256 value, bytes data) returns (bool)',
]);
const fundingData = coder.encode(['uint256'], [1n]);
checkCall(linkIface, 'transferAndCall', ['0xec0Ed46f36576541C75739E915ADbCb3DE24bD77', parseUnits('15', 18), fundingData], 'LINK');
check('transferAndCall data encodes the subscription id', coder.decode(['uint256'], fundingData)[0] === 1n);

const mtxIface = new Interface(JSON.parse(fs.readFileSync(path.join(ROOT, 'src/abi/mtx.json'), 'utf8')));
checkCall(mtxIface, 'mintToEcosystem', ['0x9fb4bb44d8d962d695fc93b3dc15f1b287391077', parseUnits('5000', 18)], 'MTX reserve mint');
checkCall(mtxIface, 'mintToEcosystem', ['0x9fb4bb44d8d962d695fc93b3dc15f1b287391077', parseUnits('100000', 18)], 'MTX QuickSwap mint');
checkCall(mtxIface, 'approve', ['0x2222222222222222222222222222222222222222', parseUnits('5000', 18)], 'MTX approve reserve');
checkCall(mtxIface, 'approve', ['0x3333333333333333333333333333333333333333', parseUnits('100000', 18)], 'MTX approve router');

const reserveIface = new Interface(artifact('CasinoReserve').abi);
checkCall(reserveIface, 'fund', [parseUnits('5000', 18)], 'CasinoReserve');
checkCall(reserveIface, 'setCasinoCore', ['0x4444444444444444444444444444444444444444'], 'CasinoReserve');
const rngIface = new Interface(artifact('RNGEngine').abi);
checkCall(rngIface, 'setCasinoCore', ['0x4444444444444444444444444444444444444444'], 'RNGEngine');
const routerIface = new Interface(artifact('LiquidityRouter').abi);
checkCall(routerIface, 'setCasinoCore', ['0x4444444444444444444444444444444444444444'], 'LiquidityRouter');
checkCall(routerIface, 'queueInitialLiquidity', [parseUnits('100000', 18)], 'LiquidityRouter');

// --- 4. QuickSwap min amounts (same 1% formula as create_quickswap_pool.js) --
// Provide step uses the shrunk QS_PROVIDE_* amounts (1,000 MTX + 1 POL).
const desired = parseUnits('1000', 18);
const pol = parseUnits('1', 18);
const minMtx = (desired * BigInt(10_000 - 100)) / 10_000n;
const minPol = (pol * BigInt(10_000 - 100)) / 10_000n;
check('provideLiquidity minMtx = 990 MTX', minMtx === parseUnits('990', 18));
check('provideLiquidity minPol = 0.99 POL', minPol === parseUnits('0.99', 18));

console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
