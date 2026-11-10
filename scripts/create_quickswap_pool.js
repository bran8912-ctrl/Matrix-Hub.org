/**
 * Create the MTX/WMATIC QuickSwap V2 pool through LiquidityRouter.
 *
 * PREPARE ONLY by default. This script NEVER sends a transaction unless
 * it is run with BOTH --execute AND --confirm, with
 * QUICKSWAP_V2_ROUTER_ADDRESS set to the verified router address.
 *
 * Sequence (see docs/quickswap-pool-creation-runbook.md):
 *   0. Mint check — the owner's MTX balance must already cover Y
 *      (minting itself is a separate Brandon-signed step: buyMTX or
 *      mintToEcosystem — this script never mints).
 *   1. MTX.approve(LiquidityRouter, Y)
 *   2. LiquidityRouter.queueInitialLiquidity(Y)
 *   3. LiquidityRouter.provideLiquidity(Y, minMtx, minPol, deadline)
 *      with P POL attached — creates the pair, sets the price.
 *   4. Verify on-chain: getPair non-zero, reserves at the Y:P ratio,
 *      LP tokens in the owner's wallet, pendingMtx drained.
 *
 * USAGE (dry-run — the default; prints the plan, sends nothing,
 * needs no network connection and no key):
 *   npx hardhat run scripts/create_quickswap_pool.js -- --mtx 10000 --pol 10
 *   npx hardhat run scripts/create_quickswap_pool.js -- --dry-run --mtx 50000 --pol 50
 *
 * USAGE (execute — Polygon mainnet only, Brandon's wallet only):
 *   QUICKSWAP_V2_ROUTER_ADDRESS=0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff \
 *   LIQUIDITY_ROUTER_ADDRESS=<deployed LiquidityRouter> \
 *   npx hardhat run scripts/create_quickswap_pool.js --network polygon \
 *     -- --execute --confirm --mtx <Y> --pol <P>
 *
 * Amounts come from Brandon's decisions (docs/quickswap-decision-sheet.md).
 * --mtx / --pol are whole-token amounts (e.g. --mtx 10000 --pol 10).
 * Slippage default 100 bps (1%): minMtx = 99% of Y, minPol = 99% of P.
 * Deadline default 20 minutes from signing.
 *
 * @author Matrix-Hub Team
 * @version 1.0.0
 */

import hre from "hardhat";

// ============================================================================
// VERIFIED CONSTANTS — do not change without a new four-check verification.
// ============================================================================
const MTX_CANONICAL = "0x53307e1db6c5cb6773c9495ca140372016dfe266";
const WMATIC = "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270";
const QUICKSWAP_V2_FACTORY = "0x5757371414417b8C6CAad45bAeF941aBc7d3Ab32";
const VERIFIED_QUICKSWAP_V2_ROUTER = "0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff";
const MTX_OWNER = "0x9fb4bb44d8d962d695fc93b3dc15f1b287391077";

// FORBIDDEN — never use under any circumstances.
const FORBIDDEN_ROUTER = "0x80e59c11f4c94f3f80593895da300e1e7ec01aea";
const FAKE_MTX = "0xDCb51dE3359C946364F707556aC8e6C6f2e69A8a";

const MTX_ABI = [
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function mintingPaused() view returns (bool)",
  "function maticToMtxRate() view returns (uint256)",
  "function MAX_SUPPLY() view returns (uint256)",
  "function decimals() view returns (uint8)",
];
const LIQUIDITY_ROUTER_ABI = [
  "function MTX() view returns (address)",
  "function QUICKSWAP_V2_ROUTER() view returns (address)",
  "function WRAPPED_NATIVE() view returns (address)",
  "function pendingMtx() view returns (uint256)",
  "function queueInitialLiquidity(uint256 amount)",
  "function provideLiquidity(uint256 amountMtxDesired, uint256 amountMtxMin, uint256 amountMaticMin, uint256 deadline) payable returns (uint256 amountMtx, uint256 amountMatic, uint256 liquidity)",
];
const FACTORY_ABI = [
  "function getPair(address tokenA, address tokenB) view returns (address)",
];
const ROUTER_ABI = [
  "function factory() view returns (address)",
  "function WETH() view returns (address)",
];
const PAIR_ABI = [
  "function token0() view returns (address)",
  "function token1() view returns (address)",
  "function getReserves() view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
];

// ============================================================================
// ARGUMENT PARSING (no network, no key — safe to run anywhere)
// ============================================================================
function parseArgs(argv) {
  const args = {
    dryRun: true, // DEFAULT: dry-run. --execute flips it off.
    execute: false,
    confirm: false,
    mtx: null, // whole MTX, e.g. "10000"
    pol: null, // whole POL, e.g. "10"
    slippageBps: 100, // 1%
    deadlineMinutes: 20,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--") {
      continue; // arg separator (present under plain `node`, stripped by hardhat)
    } else if (a === "--dry-run") {
      args.dryRun = true;
      args.execute = false;
    } else if (a === "--execute") {
      args.execute = true;
      args.dryRun = false;
    } else if (a === "--confirm") {
      args.confirm = true;
    } else if (a === "--mtx") {
      args.mtx = argv[++i];
    } else if (a === "--pol") {
      args.pol = argv[++i];
    } else if (a === "--slippage-bps") {
      args.slippageBps = Number(argv[++i]);
    } else if (a === "--deadline-minutes") {
      args.deadlineMinutes = Number(argv[++i]);
    } else if (a.startsWith("--mtx=")) {
      args.mtx = a.slice("--mtx=".length);
    } else if (a.startsWith("--pol=")) {
      args.pol = a.slice("--pol=".length);
    } else {
      throw new Error(`Unknown argument: ${a}`);
    }
  }
  return args;
}

function fail(message) {
  throw new Error(message);
}

function isSameAddress(a, b) {
  return !!a && !!b && a.toLowerCase() === b.toLowerCase();
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const mtxAddress = (process.env.MTX_CONTRACT_ADDRESS || MTX_CANONICAL).trim();
  const liquidityRouterAddress = (process.env.LIQUIDITY_ROUTER_ADDRESS || "").trim();
  const routerEnv = (process.env.QUICKSWAP_V2_ROUTER_ADDRESS || "").trim();

  // --- Static validation (no network needed) -------------------------------
  if (!hre.ethers.isAddress(mtxAddress) || /^0x0{40}$/i.test(mtxAddress)) {
    fail("MTX_CONTRACT_ADDRESS is unset, malformed, or zero.");
  }
  if (isSameAddress(mtxAddress, FAKE_MTX)) {
    fail("MTX_CONTRACT_ADDRESS is the flagged fake/phishing token. Refusing to run.");
  }
  if (!isSameAddress(mtxAddress, MTX_CANONICAL) && hre.network.name === "polygon") {
    fail(`Polygon run must use the canonical MTX ${MTX_CANONICAL}.`);
  }
  if (!args.mtx || !/^\d+(\.\d+)?$/.test(args.mtx) || Number(args.mtx) <= 0) {
    fail("Set --mtx to the MTX amount (whole tokens, > 0), e.g. --mtx 10000.");
  }
  if (!args.pol || !/^\d+(\.\d+)?$/.test(args.pol) || Number(args.pol) <= 0) {
    fail("Set --pol to the POL amount (whole POL, > 0), e.g. --pol 10.");
  }
  if (!Number.isInteger(args.slippageBps) || args.slippageBps < 0 || args.slippageBps > 5000) {
    fail("--slippage-bps must be an integer between 0 and 5000 (0–50%).");
  }
  if (!Number.isInteger(args.deadlineMinutes) || args.deadlineMinutes <= 0 || args.deadlineMinutes > 30) {
    fail("--deadline-minutes must be an integer between 1 and 30.");
  }

  const mtxAmount = hre.ethers.parseUnits(args.mtx, 18);
  const polAmount = hre.ethers.parseUnits(args.pol, 18);
  const minMtx = (mtxAmount * BigInt(10_000 - args.slippageBps)) / 10_000n;
  const minPol = (polAmount * BigInt(10_000 - args.slippageBps)) / 10_000n;
  const deadline = Math.floor(Date.now() / 1000) + args.deadlineMinutes * 60;
  const priceMtxInPol = Number(args.pol) / Number(args.mtx); // POL per MTX
  const lpApprox = Math.sqrt(Number(args.mtx) * Number(args.pol)); // whole LP tokens, approx

  // --- Router-env gate (checked in BOTH modes; execute refuses on failure) --
  let routerGate = "OK";
  if (!routerEnv) {
    routerGate = "BLOCKED — QUICKSWAP_V2_ROUTER_ADDRESS is not set.";
  } else if (isSameAddress(routerEnv, FORBIDDEN_ROUTER)) {
    routerGate = "REFUSED — QUICKSWAP_V2_ROUTER_ADDRESS is the forbidden misconfigured address 0x80e59c11…";
  } else if (!isSameAddress(routerEnv, VERIFIED_QUICKSWAP_V2_ROUTER)) {
    routerGate = `BLOCKED — QUICKSWAP_V2_ROUTER_ADDRESS (${routerEnv}) is not the verified router ${VERIFIED_QUICKSWAP_V2_ROUTER}.`;
  }

  // ==========================================================================
  // DRY-RUN (default): print the plan. No provider, no signer, no key,
  // no network call of any kind. Safe to run anywhere, including offline.
  // ==========================================================================
  if (args.dryRun) {
    console.log("╔════════════════════════════════════════════════════════════════╗");
    console.log("║  QuickSwap pool creation — DRY RUN (nothing will be sent)    ║");
    console.log("╚════════════════════════════════════════════════════════════════╝");
    console.log("\nNetwork (hardhat config):", hre.network.name);
    console.log("MTX:                      ", mtxAddress);
    console.log("WMATIC:                   ", WMATIC);
    console.log("QuickSwap V2 factory:     ", QUICKSWAP_V2_FACTORY);
    console.log("QuickSwap V2 router:      ", VERIFIED_QUICKSWAP_V2_ROUTER, "(verified 2026-11-10)");
    console.log("Router env gate:          ", routerGate);
    console.log("LiquidityRouter:          ", liquidityRouterAddress || "(not set — set LIQUIDITY_ROUTER_ADDRESS before --execute)");
    console.log("Owner (must sign):        ", MTX_OWNER);
    console.log("\nPlanned amounts (from Brandon's decisions — verify these are his):");
    console.log(`  MTX to add (Y):         ${args.mtx} MTX (${mtxAmount.toString()} wei)`);
    console.log(`  POL to add (P):         ${args.pol} POL (${polAmount.toString()} wei)`);
    console.log(`  Implied MTX price:      ${priceMtxInPol} POL per MTX (mint-rate parity is 0.001; 1 POL buys ${(1 / priceMtxInPol).toLocaleString()} MTX)`);
    console.log(`  LP tokens minted (≈):   ${lpApprox.toFixed(2)} (sqrt(Y × P), minus 1,000 wei minimum liquidity)`);
    console.log(`  Slippage:               ${args.slippageBps} bps → minMtx ${hre.ethers.formatUnits(minMtx, 18)} MTX, minPol ${hre.ethers.formatUnits(minPol, 18)} POL`);
    console.log(`  Deadline:               ${deadline} (now + ${args.deadlineMinutes} min)`);
    console.log("\nPlanned calls, in order (NONE will be sent in dry-run):");
    console.log("  [check]  MTX.totalSupply() / balanceOf(owner) — balance must be >= Y");
    console.log("           (if short: mint first via buyMTX or mintToEcosystem — this script never mints)");
    console.log("  [check]  factory.getPair(MTX, WMATIC) — must be 0x0 (no pool yet)");
    console.log(`  [tx 1]   MTX.approve(${liquidityRouterAddress || "<LIQUIDITY_ROUTER_ADDRESS>"}, ${mtxAmount.toString()})`);
    console.log(`  [tx 2]   LiquidityRouter.queueInitialLiquidity(${mtxAmount.toString()})`);
    console.log(`  [tx 3]   LiquidityRouter.provideLiquidity(${mtxAmount.toString()}, ${minMtx.toString()}, ${minPol.toString()}, ${deadline}) with value ${polAmount.toString()} wei (${args.pol} POL)`);
    console.log("  [verify] factory.getPair(MTX, WMATIC) — expect non-zero pair address");
    console.log("  [verify] pair.getReserves() — expect the Y:P ratio");
    console.log("  [verify] pair.balanceOf(owner) — expect the LP tokens from tx 3");
    console.log("  [verify] LiquidityRouter.pendingMtx() — expect 0 (or the known remainder)");
    if (routerGate !== "OK") {
      console.log(`\n⚠️  Execute is ${routerGate}`);
      console.log("   Set QUICKSWAP_V2_ROUTER_ADDRESS to the verified router before --execute.");
    }
    if (!liquidityRouterAddress) {
      console.log("\n⚠️  Execute is BLOCKED — LIQUIDITY_ROUTER_ADDRESS is not set (deploy the casino contracts first).");
    }
    console.log("\nTo execute (Brandon's wallet only, Polygon only):");
    console.log("  QUICKSWAP_V2_ROUTER_ADDRESS=0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff \\");
    console.log(`  LIQUIDITY_ROUTER_ADDRESS=<deployed LiquidityRouter> npx hardhat run scripts/create_quickswap_pool.js --network polygon -- --execute --confirm --mtx ${args.mtx} --pol ${args.pol}`);
    console.log("\n✅ Dry-run complete. No transaction sent, no network call made.");
    return;
  }

  // ==========================================================================
  // EXECUTE: hard gates. Any failure throws before any transaction.
  // ==========================================================================
  if (!args.confirm) {
    fail("Refusing --execute without --confirm. Re-run with both --execute --confirm.");
  }
  if (routerGate !== "OK") {
    fail(`Refusing --execute: ${routerGate}`);
  }
  if (hre.network.config.chainId !== 137) {
    fail(`Refusing --execute: this script executes on Polygon (137) only, not chain ${hre.network.config.chainId}.`);
  }
  if (!liquidityRouterAddress || !hre.ethers.isAddress(liquidityRouterAddress)) {
    fail("Refusing --execute: set LIQUIDITY_ROUTER_ADDRESS to the deployed LiquidityRouter.");
  }

  const signers = await hre.ethers.getSigners();
  if (signers.length === 0) {
    fail("Refusing --execute: no signer available. Set PRIVATE_KEY for the deployer (Brandon's) wallet.");
  }
  const [deployer] = signers;
  if (!isSameAddress(deployer.address, MTX_OWNER)) {
    fail(`Refusing --execute: signer ${deployer.address} is not the MTX owner ${MTX_OWNER}. Only Brandon's wallet may create the pool.`);
  }
  console.log("Signer (owner):", deployer.address);

  const mtx = new hre.ethers.Contract(mtxAddress, MTX_ABI, deployer);
  const liquidityRouter = new hre.ethers.Contract(liquidityRouterAddress, LIQUIDITY_ROUTER_ABI, deployer);
  const factory = new hre.ethers.Contract(QUICKSWAP_V2_FACTORY, FACTORY_ABI, deployer);
  const router = new hre.ethers.Contract(VERIFIED_QUICKSWAP_V2_ROUTER, ROUTER_ABI, deployer);

  // --- Pre-flight reads ------------------------------------------------------
  if ((await hre.ethers.provider.getCode(liquidityRouterAddress)) === "0x") {
    fail("LIQUIDITY_ROUTER_ADDRESS has no deployed contract on this network.");
  }
  if ((await hre.ethers.provider.getCode(VERIFIED_QUICKSWAP_V2_ROUTER)) === "0x") {
    fail("Verified QuickSwap V2 router has no code on this network — aborting.");
  }
  const routerFactory = await router.factory();
  if (!isSameAddress(routerFactory, QUICKSWAP_V2_FACTORY)) {
    fail(`Router factory() is ${routerFactory}, not the verified factory ${QUICKSWAP_V2_FACTORY}. Aborting.`);
  }
  const routerWeth = await router.WETH();
  if (!isSameAddress(routerWeth, WMATIC)) {
    fail(`Router WETH() is ${routerWeth}, not WMATIC ${WMATIC}. Aborting.`);
  }
  const routerOnRouter = await liquidityRouter.QUICKSWAP_V2_ROUTER();
  if (!isSameAddress(routerOnRouter, VERIFIED_QUICKSWAP_V2_ROUTER)) {
    fail(`LiquidityRouter was deployed with router ${routerOnRouter}, not the verified router. Aborting.`);
  }
  const existingPair = await factory.getPair(mtxAddress, WMATIC);
  if (existingPair !== hre.ethers.ZeroAddress) {
    fail(`Pair already exists at ${existingPair}. The first-add price is already set — aborting. Read its reserves and re-decide.`);
  }
  const totalSupply = await mtx.totalSupply();
  const maxSupply = await mtx.MAX_SUPPLY();
  console.log(`MTX totalSupply: ${hre.ethers.formatUnits(totalSupply, 18)} / max ${hre.ethers.formatUnits(maxSupply, 18)}`);
  const ownerBalance = await mtx.balanceOf(deployer.address);
  console.log(`Owner MTX balance: ${hre.ethers.formatUnits(ownerBalance, 18)} MTX (need ${args.mtx})`);
  if (ownerBalance < mtxAmount) {
    fail(
      `Owner holds ${hre.ethers.formatUnits(ownerBalance, 18)} MTX, less than the ${args.mtx} MTX requested. ` +
        "Mint first (buyMTX or mintToEcosystem — a separate Brandon-signed step), then re-run. This script never mints."
    );
  }
  const polBalance = await hre.ethers.provider.getBalance(deployer.address);
  console.log(`Owner POL balance: ${hre.ethers.formatEther(polBalance)} POL (need ${args.pol} + gas)`);
  if (polBalance <= polAmount) {
    fail("Owner POL balance does not cover the liquidity POL plus gas. Fund the wallet first.");
  }

  // --- tx 1: approve ---------------------------------------------------------
  const allowance = await mtx.allowance(deployer.address, liquidityRouterAddress);
  if (allowance < mtxAmount) {
    console.log(`\n[tx 1] MTX.approve(LiquidityRouter, ${args.mtx})…`);
    await (await mtx.approve(liquidityRouterAddress, mtxAmount)).wait();
    console.log("✅ Approved.");
  } else {
    console.log("\n[tx 1] Allowance already covers the amount — skipping approve.");
  }

  // --- tx 2: queue -----------------------------------------------------------
  console.log(`\n[tx 2] LiquidityRouter.queueInitialLiquidity(${args.mtx} MTX)…`);
  await (await liquidityRouter.queueInitialLiquidity(mtxAmount)).wait();
  console.log(`✅ Queued. pendingMtx: ${hre.ethers.formatUnits(await liquidityRouter.pendingMtx(), 18)} MTX`);

  // --- tx 3: provide liquidity (creates the pair, sets the price) -----------
  console.log(`\n[tx 3] LiquidityRouter.provideLiquidity(${args.mtx} MTX, min ${hre.ethers.formatUnits(minMtx, 18)}, min ${hre.ethers.formatUnits(minPol, 18)} POL, deadline ${deadline}) with ${args.pol} POL…`);
  const tx = await liquidityRouter.provideLiquidity(mtxAmount, minMtx, minPol, deadline, { value: polAmount });
  const receipt = await tx.wait();
  console.log(`✅ Provide liquidity mined in tx ${receipt.hash}`);

  // --- Verify ----------------------------------------------------------------
  const pairAddress = await factory.getPair(mtxAddress, WMATIC);
  console.log("\nVerification:");
  console.log("  Pair:", pairAddress);
  if (pairAddress === hre.ethers.ZeroAddress) {
    fail("Verification FAILED: getPair still returns 0x0 after provideLiquidity.");
  }
  const pair = new hre.ethers.Contract(pairAddress, PAIR_ABI, deployer);
  const token0 = await pair.token0();
  const token1 = await pair.token1();
  const [reserve0, reserve1] = await pair.getReserves();
  const reserveMtx = isSameAddress(token0, mtxAddress) ? reserve0 : reserve1;
  const reservePol = isSameAddress(token0, mtxAddress) ? reserve1 : reserve0;
  console.log(`  token0: ${token0}, token1: ${token1}`);
  console.log(`  Reserves — MTX: ${hre.ethers.formatUnits(reserveMtx, 18)}, WMATIC: ${hre.ethers.formatUnits(reservePol, 18)}`);
  const lpBalance = await pair.balanceOf(deployer.address);
  console.log(`  LP tokens in owner wallet: ${hre.ethers.formatUnits(lpBalance, 18)}`);
  console.log(`  Pair totalSupply (LP): ${hre.ethers.formatUnits(await pair.totalSupply(), 18)}`);
  console.log(`  LiquidityRouter pendingMtx: ${hre.ethers.formatUnits(await liquidityRouter.pendingMtx(), 18)} MTX`);
  if (lpBalance === 0n) {
    fail("Verification FAILED: owner holds 0 LP tokens after provideLiquidity.");
  }
  console.log("\n✅ Pool created and verified. Pair:", pairAddress);
  console.log("   Record the pair address and LP balance; do not advertise the pool until the frontend QA gate passes.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ create_quickswap_pool failed:", error.message);
    process.exit(1);
  });
