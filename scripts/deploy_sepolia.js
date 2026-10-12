/**
 * Deploy all casino contracts to Sepolia testnet via Remix injected provider.
 * 
 * Deployment order (respecting dependencies):
 * 1. MatrixHubCoin (MTX)  — no dependencies
 * 2. LiquidityRouter        — needs MTX address
 * 3. RNGEngine             — needs CasinoCore address (circular!) — use deployer as placeholder, update later
 * 4. CasinoReserve          — needs MTX + CasinoCore address (circular!) — use deployer as placeholder, update later
 * 5. CasinoCore             — needs MTX, LiquidityRouter, CasinoReserve, RNGEngine, bet params, dev, governance
 * 
 * Post-deployment: CasinoCore.setReserve() and CasinoCore.setRng() to fix circular deps
 */

const fs = require('fs');
const path = require('path');

async function deployContract(name, bytecode, abiEncodedArgs) {
  const web3 = new Web3(window.ethereum || window.provider);
  const data = '0x' + bytecode + abiEncodedArgs;
  const from = (await web3.eth.getAccounts())[0];
  console.log(`Deploying ${name} from ${from}...`);
  const tx = web3.eth.sendTransaction({ from, data, gas: 3000000 });
  const rcpt = web3.eth.getTransactionReceipt(tx.transactionHash);
  console.log(`${name} deployed at: ${rcpt.contractAddress}`);
  return rcpt.contractAddress;
}

async function main() {
  const accounts = await window.ethereum.request({ method: 'eth_accounts' });
  const deployer = accounts[0];
  console.log('Deployer address:', deployer);

  // Load artifacts
  const mtxArtifact = JSON.parse(fs.readFileSync('/.artifacts/MatrixHubCoin.json', 'utf8'));
  const casinoReserveArtifact = JSON.parse(fs.readFileSync('/.artifacts/CasinoReserve.json', 'utf8'));
  const liquidityArtifact = JSON.parse(fs.readFileSync('/.artifacts/LiquidityRouter.json', 'utf8'));
  const rngArtifact = JSON.parse(fs.readFileSync('/.artifacts/RNGEngine.json', 'utf8'));
  const casinoCoreArtifact = JSON.parse(fs.readFileSync('/.artifacts/CasinoCore.json', 'utf8'));

  // Helper: get deployed bytecode from Remix artifact
  function getBytecode(artifact) {
    return artifact.data.bytecode.object;
  }

  // 1. Deploy MatrixHubCoin
  // Constructor: (uint256 maxSupply, address initialOwner)
  // maxSupply = 100000000 (100M), initialOwner = deployer
  const mtxBytecode = getBytecode(mtxArtifact);
  const mtxArgs = web3.eth.abi.encodeParameters(
    ['uint256', 'address'],
    ['100000000', deployer]
  ).slice(2); // remove '0x' prefix
  console.log('\n1. Deploying MatrixHubCoin...');
  const mtxAddr = await deployContract('MatrixHubCoin', mtxBytecode, mtxArgs);
  console.log('MatrixHubCoin (MTX) address:', mtxAddr);

  // 2. Deploy LiquidityRouter
  // Constructor: (address _mtx, address _dexPool)
  // _dexPool = deployer (placeholder)
  const liqBytecode = getBytecode(liquidityArtifact);
  const liqArgs = web3.eth.abi.encodeParameters(
    ['address', 'address'],
    [mtxAddr, deployer]
  ).slice(2);
  console.log('\n2. Deploying LiquidityRouter...');
  const liqAddr = await deployContract('LiquidityRouter', liqBytecode, liqArgs);
  console.log('LiquidityRouter address:', liqAddr);

  // 3. Deploy RNGEngine
  // Constructor: (address _casinoCore)
  // _casinoCore = deployer (placeholder, will be updated later)
  // Note: RNGEngine has no setCasinoCore() function, so we need to deploy after CasinoCore
  // Actually, looking at the RNGEngine code, casinoCore is set in constructor only.
  // We'll need to deploy RNGEngine with the real CasinoCore address.
  // So we deploy RNGEngine AFTER CasinoCore.
  
  // 4. Deploy CasinoCore
  // Constructor: (address _mtx, address _liquidity, address _reserve, address _rng,
  //               uint256 _minBet, uint256 _maxBet, uint256 _maxPayoutPerBet,
  //               address _dev, address _governance)
  // _reserve and _rng will use deployer as placeholder, then update via setReserve() and setRng()
  
  // But wait: CasinoCore constructor checks zero addresses, not whether they're contracts.
  // So we can use deployer as placeholder for _reserve and _rng.
  
  // For CasinoReserve, the constructor takes (address _mtx, uint256 _reserveCap, address _casinoCore)
  // Similarly, we use deployer as placeholder for _casinoCore.
  
  // Actually, let me reconsider the deployment order to minimize post-deployment fixes:
  // The original deploy_casino.js deploys RNGEngine FIRST with empty args (wrong - it needs casinoCore)
  // Then deploys CasinoReserve with deployer as temp casinoCore
  // Then deploys CasinoCore with the real addresses
  
  // Better approach: 
  // 1. Deploy MTX (no deps)
  // 2. Deploy LiquidityRouter (needs MTX)  
  // 3. Deploy CasinoCore with deployer as placeholder for _reserve and _rng
  // 4. Deploy CasinoReserve with real CasinoCore address
  // 5. Deploy RNGEngine with real CasinoCore address
  // 6. Call CasinoCore.setReserve(reserveAddr) and CasinoCore.setRng(rngAddr)
  
  // CasinoCore constructor params:
  // _mtx = mtxAddr
  // _liquidity = liqAddr  
  // _reserve = deployer (placeholder)
  // _rng = deployer (placeholder)
  // _minBet = 1 ether (1 * 10^18)
  // _maxBet = 1000 ether (1000 * 10^18)  
  // _maxPayoutPerBet = 10000 ether (10000 * 10^18) — set high for testing
  // _dev = deployer
  // _governance = deployer

  const coreBytecode = getBytecode(casinoCoreArtifact);
  const oneEther = '1000000000000000000'; // 1e18
  const thousandEther = '1000000000000000000000'; // 1000e18
  const tenThousandEther = '10000000000000000000000'; // 10000e18

  const coreArgs = web3.eth.abi.encodeParameters(
    ['address', 'address', 'address', 'address', 'uint256', 'uint256', 'uint256', 'address', 'address'],
    [mtxAddr, liqAddr, deployer, deployer, oneEther, thousandEther, tenThousandEther, deployer, deployer]
  ).slice(2);
  
  console.log('\n3. Deploying CasinoCore (with placeholder reserve & rng)...');
  const coreAddr = await deployContract('CasinoCore', coreBytecode, coreArgs);
  console.log('CasinoCore address:', coreAddr);

  // 4. Deploy CasinoReserve with real CasinoCore address
  // Constructor: (address _mtx, uint256 _reserveCap, address _casinoCore)
  // _reserveCap = 1,000,000 ether (1M * 10^18)
  const reserveBytecode = getBytecode(casinoReserveArtifact);
  const oneMillionEther = '1000000000000000000000000'; // 1e6 * 1e18
  const reserveArgs = web3.eth.abi.encodeParameters(
    ['address', 'uint256', 'address'],
    [mtxAddr, oneMillionEther, coreAddr]
  ).slice(2);
  
  console.log('\n4. Deploying CasinoReserve...');
  const reserveAddr = await deployContract('CasinoReserve', reserveBytecode, reserveArgs);
  console.log('CasinoReserve address:', reserveAddr);

  // 5. Deploy RNGEngine with real CasinoCore address
  // Constructor: (address _casinoCore)
  const rngBytecode = getBytecode(rngArtifact);
  const rngArgs = web3.eth.abi.encodeParameters(
    ['address'],
    [coreAddr]
  ).slice(2);
  
  console.log('\n5. Deploying RNGEngine...');
  const rngAddr = await deployContract('RNGEngine', rngBytecode, rngArgs);
  console.log('RNGEngine address:', rngAddr);

  // 6. Update CasinoCore with correct reserve and rng addresses
  console.log('\n6. Updating CasinoCore with correct reserve and RNG addresses...');
  
  // setReserve(address) - function selector: 0x9bbde838
  const setReserveData = '0x9bbde838' + reserveAddr.slice(2).toLowerCase().padStart(64, '0');
  await web3.eth.sendTransaction({ from: deployer, to: coreAddr, data: setReserveData, gas: 100000 });
  console.log('   CasinoCore.setReserve() called with:', reserveAddr);
  
  // setRng(address) - function selector: 0x856d0f58
  const setRngData = '0x856d0f58' + rngAddr.slice(2).toLowerCase().padStart(64, '0');
  await web3.eth.sendTransaction({ from: deployer, to: coreAddr, data: setRngData, gas: 100000 });
  console.log('   CasinoCore.setRng() called with:', rngAddr);

  console.log('\n========================================');
  console.log('DEPLOYMENT COMPLETE');
  console.log('========================================');
  console.log('MatrixHubCoin (MTX):', mtxAddr);
  console.log('LiquidityRouter:    ', liqAddr);
  console.log('CasinoCore:         ', coreAddr);
  console.log('CasinoReserve:      ', reserveAddr);
  console.log('RNGEngine:          ', rngAddr);
  console.log('========================================');
  console.log('Deployer/Dev/Governance:', deployer);
  console.log('Note: LiquidityRouter dexPool set to deployer (placeholder)');
  console.log('Note: CasinoReserve & RNGEngine wired to CasinoCore via setReserve() & setRng()');
  
  return {
    mtxAddr,
    liqAddr,
    coreAddr,
    reserveAddr,
    rngAddr
  };
}

main().catch(err => { console.error('Deployment failed:', err); process.exit(1); });
