/**
 * Casino Contracts Deployment Script
 * 
 * This script automates the deployment of the Matrix-Hub casino contracts to Polygon networks.
 * It deploys CasinoCore, CasinoReserve, LiquidityRouter, and RNGEngine contracts with proper
 * configuration and saves deployment information for frontend integration.
 * 
 * PREREQUISITES:
 * - MTX token must be deployed first (run deploy_mtx.js)
 * - Environment variables configured in .env:
 *   - PRIVATE_KEY: Deployer's private key
 *   - POLYGON_RPC_URL or AMOY_RPC_URL: RPC endpoint
 *   - POLYGONSCAN_API_KEY: For contract verification (optional)
 * 
 * USAGE:
 *   npx hardhat run scripts/deploy_casino.js --network amoy
 *   npx hardhat run scripts/deploy_casino.js --network polygon
 * 
 * OUTPUT:
 *   - Deployment information saved to: deployments/casino-<network>.json
 *   - JSON file contains all contract addresses for frontend integration
 * 
 * CUSTOMIZATION:
 *   - Modify DEPLOYMENT_CONFIG to change constructor parameters
 *   - Update network-specific settings in hardhat.config.cjs
 *   - Extend deployContract() function for additional contracts
 * 
 * NOTES:
 *   - MTX_CONTRACT_ADDRESS, QUICKSWAP_V2_ROUTER_ADDRESS, and
 *     CASINO_MAX_PAYOUT_PER_BET must be set for the selected network
 *   - Module permissions are wired to CasinoCore after all contracts deploy
 *   - Casino MTX fees are queued; the owner separately supplies POL to create LP
 *   - The script creates the deployments/ folder automatically if it doesn't exist
 * 
 * @author Matrix-Hub Team
 * @version 2.0.0
 */

import hre from "hardhat";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ============================================================================
// DEPLOYMENT CONFIGURATION
// ============================================================================
// Customize these values for different deployment scenarios
// All token amounts use 18 decimals (e.g., "1" = 1 * 10^18 wei)
const DEPLOYMENT_CONFIG = {
  // CasinoReserve configuration
  reserveCap: "1000000", // Maximum MTX reserve capacity (1M MTX)
  
  // CasinoCore configuration
  minBet: "1",          // Minimum bet amount (1 MTX)
  maxBet: "1000",       // Maximum bet amount (1000 MTX)
  
  // Optional: Override these addresses if needed, otherwise uses deployer
  devAddress: null,         // Developer fee recipient (null = use deployer)
  governanceAddress: null,  // Governance address (null = use deployer)
};

const VRF_NETWORK_CONFIG = {
  polygon: {
    chainId: 137,
    coordinator: "0xec0Ed46f36576541C75739E915ADbCb3DE24bD77",
    keyHash: "0x0ffbbd0c1c18c0263dd778dadd1d64240d7bc338d95fec1cf0473928ca7eaf9e",
    linkToken: "0xb0897686c545045aFc77CF20eC7A532E3120E0F1",
  },
  amoy: {
    chainId: 80002,
    coordinator: "0x343300b5d84D444B2ADc9116FEF1bED02BE49Cf2",
    keyHash: "0x816bedba8a50b294e5cbd47842baf240c2385f2eaf719edbd4f250a137a8c899",
    linkToken: "0x0fd9e8d3af1aaee056eb9e802c3a762a667b1904",
  },
};

const VRF_REQUEST_CONFIRMATIONS = 3;
const VRF_CALLBACK_GAS_LIMIT = 250000;

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Ensure the deployments directory exists
 * Creates the directory if it doesn't exist
 */
function ensureDeploymentsDir() {
  const deploymentsDir = path.join(__dirname, "..", "deployments");
  if (!fs.existsSync(deploymentsDir)) {
    console.log("📁 Creating deployments directory...");
    fs.mkdirSync(deploymentsDir, { recursive: true });
    console.log("✅ Deployments directory created");
  }
  return deploymentsDir;
}

/**
 * Deploy a single contract with error handling
 * @param {string} contractName - Name of the contract to deploy
 * @param {Array} constructorArgs - Constructor arguments
 * @returns {Promise<{contract: Object, address: string}>} Deployed contract and address
 */
async function deployContract(contractName, constructorArgs = []) {
  console.log(`\n🔨 Deploying ${contractName}...`);
  
  try {
    const ContractFactory = await hre.ethers.getContractFactory(contractName);
    const contract = await ContractFactory.deploy(...constructorArgs);
    await contract.waitForDeployment();
    const address = await contract.getAddress();
    
    console.log(`✅ ${contractName} deployed successfully`);
    console.log(`   Address: ${address}`);
    
    return { contract, address };
  } catch (error) {
    console.error(`❌ Failed to deploy ${contractName}:`, error.message);
    throw error;
  }
}

/**
 * Save deployment information to JSON file
 * @param {Object} deploymentInfo - Deployment data to save
 * @param {string} deploymentsDir - Path to deployments directory
 */
function saveDeploymentInfo(deploymentInfo, deploymentsDir) {
  const deploymentFile = path.join(deploymentsDir, `casino-${hre.network.name}.json`);
  
  try {
    fs.writeFileSync(deploymentFile, JSON.stringify(deploymentInfo, null, 2));
    console.log("\n📄 Deployment info saved successfully");
    console.log(`   File: ${deploymentFile}`);
  } catch (error) {
    console.error("❌ Failed to save deployment info:", error.message);
    throw error;
  }
}

// ============================================================================
// MAIN DEPLOYMENT FUNCTION
// ============================================================================

async function main() {
  console.log("╔════════════════════════════════════════════════════════════════╗");
  console.log("║       Casino Contracts Deployment - Matrix-Hub Platform       ║");
  console.log("╚════════════════════════════════════════════════════════════════╝");

  // Step 1: Network Information
  console.log("\n📡 Network Information:");
  console.log("   Network:", hre.network.name);
  console.log("   Chain ID:", hre.network.config.chainId);

  const vrfConfig = VRF_NETWORK_CONFIG[hre.network.name];
  if (!vrfConfig || hre.network.config.chainId !== vrfConfig.chainId) {
    throw new Error(`Casino deployment is supported only on Polygon (137) and Amoy (80002), not ${hre.network.name}.`);
  }
  if (
    hre.network.name === "polygon" &&
    process.env.POLYGON_CASINO_DEPLOYMENT_APPROVED !== "YES"
  ) {
    throw new Error(
      "Polygon deployment is release-gated. Complete Amoy end-to-end testing and independent security review, " +
        "then explicitly set POLYGON_CASINO_DEPLOYMENT_APPROVED=YES."
    );
  }
  
  // Step 2: Deployer Account Setup
  const signers = await hre.ethers.getSigners();
  if (signers.length === 0) {
    throw new Error("Set PRIVATE_KEY for the selected network before deploying casino contracts.");
  }
  const [deployer] = signers;
  console.log("\n👤 Deployer Account:");
  console.log("   Address:", deployer.address);
  
  // Step 3: Check Balance
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("   Balance:", hre.ethers.formatEther(balance), "POL");
  
  if (balance === 0n) {
    console.warn("\n⚠️  Warning: Deployer balance is 0 POL!");
    console.warn("   Deployment will fail. Please fund the deployer account.");
  }
  
  // Step 4: Ensure Deployments Directory Exists
  const deploymentsDir = ensureDeploymentsDir();
  
  // Step 5: Validate network-specific deployment addresses before any deployment.
  const MTX_ADDRESS = process.env.MTX_CONTRACT_ADDRESS;
  const QUICKSWAP_V2_ROUTER_ADDRESS = process.env.QUICKSWAP_V2_ROUTER_ADDRESS;
  const maxPayoutPerBet = process.env.CASINO_MAX_PAYOUT_PER_BET;
  const subscriptionValue = process.env.VRF_SUBSCRIPTION_ID;
  if (!subscriptionValue || !/^\d+$/.test(subscriptionValue) || BigInt(subscriptionValue) === 0n) {
    throw new Error("Set VRF_SUBSCRIPTION_ID to an existing, LINK-funded Chainlink VRF v2.5 subscription.");
  }
  const subscriptionId = BigInt(subscriptionValue);
  if (!MTX_ADDRESS || !hre.ethers.isAddress(MTX_ADDRESS) || /^0x0{40}$/i.test(MTX_ADDRESS)) {
    throw new Error("Set MTX_CONTRACT_ADDRESS to the intended MTX token for the selected network.");
  }
  if (
    hre.network.name === "polygon" &&
    MTX_ADDRESS.toLowerCase() !== "0x53307e1db6c5cb6773c9495ca140372016dfe266"
  ) {
    throw new Error("Polygon deployment must use the user-designated canonical MTX token.");
  }
  if (
    !QUICKSWAP_V2_ROUTER_ADDRESS ||
    !hre.ethers.isAddress(QUICKSWAP_V2_ROUTER_ADDRESS) ||
    /^0x0{40}$/i.test(QUICKSWAP_V2_ROUTER_ADDRESS)
  ) {
    throw new Error("Set QUICKSWAP_V2_ROUTER_ADDRESS to the QuickSwap V2 router for the selected network.");
  }
  if (!maxPayoutPerBet || !/^\d+(\.\d+)?$/.test(maxPayoutPerBet)) {
    throw new Error("Set CASINO_MAX_PAYOUT_PER_BET to the intended maximum payout in MTX.");
  }
  for (const [label, address] of [
    ["MTX_CONTRACT_ADDRESS", MTX_ADDRESS],
    ["QUICKSWAP_V2_ROUTER_ADDRESS", QUICKSWAP_V2_ROUTER_ADDRESS],
    ["Chainlink VRF coordinator", vrfConfig.coordinator],
    ["Chainlink LINK token", vrfConfig.linkToken],
  ]) {
    if (await hre.ethers.provider.getCode(address) === "0x") {
      throw new Error(`${label} has no deployed contract on the selected network.`);
    }
  }
  const coordinator = new hre.ethers.Contract(
    vrfConfig.coordinator,
    [
      "function getSubscription(uint256) view returns (uint96 balance,uint96 nativeBalance,uint64 reqCount,address owner,address[] consumers)",
      "function addConsumer(uint256 subId,address consumer)",
    ],
    deployer
  );
  const subscription = await coordinator.getFunction("getSubscription").staticCall(subscriptionId);
  if (subscription.owner.toLowerCase() !== deployer.address.toLowerCase()) {
    throw new Error("The VRF subscription must be owned by the deployer so the script can add RNGEngine as a consumer.");
  }
  if (subscription.balance === 0n) {
    throw new Error("The VRF subscription has no LINK balance; fund it with the official network LINK token first.");
  }
  console.log("   MTX Token Address:", MTX_ADDRESS);
  console.log("   QuickSwap V2 Router:", QUICKSWAP_V2_ROUTER_ADDRESS);
  console.log("   VRF Coordinator:", vrfConfig.coordinator);
  console.log("   VRF Subscription:", subscriptionId.toString());
  console.log("   VRF LINK Balance:", subscription.balance.toString());
  
  // Step 6: Prepare Constructor Arguments
  console.log("\n⚙️  Preparing Constructor Arguments...");
  
  // Parse configuration values
  const RESERVE_CAP = hre.ethers.parseUnits(DEPLOYMENT_CONFIG.reserveCap, 18);
  const MIN_BET = hre.ethers.parseUnits(DEPLOYMENT_CONFIG.minBet, 18);
  const MAX_BET = hre.ethers.parseUnits(DEPLOYMENT_CONFIG.maxBet, 18);
  const MAX_PAYOUT_PER_BET = hre.ethers.parseUnits(maxPayoutPerBet, 18);
  if (MAX_PAYOUT_PER_BET === 0n) throw new Error("CASINO_MAX_PAYOUT_PER_BET must be greater than zero.");
  const DEV_ADDRESS = DEPLOYMENT_CONFIG.devAddress || deployer.address;
  const GOVERNANCE_ADDRESS = DEPLOYMENT_CONFIG.governanceAddress || deployer.address;
  
  console.log("   Reserve Cap:", hre.ethers.formatUnits(RESERVE_CAP, 18), "MTX");
  console.log("   Min Bet:", hre.ethers.formatUnits(MIN_BET, 18), "MTX");
  console.log("   Max Bet:", hre.ethers.formatUnits(MAX_BET, 18), "MTX");
  console.log("   Max Payout:", hre.ethers.formatUnits(MAX_PAYOUT_PER_BET, 18), "MTX");
  console.log("   Dev Address:", DEV_ADDRESS);
  console.log("   Governance Address:", GOVERNANCE_ADDRESS);
  
  // Step 7: Deploy Contracts
  console.log("\n🎰 Starting Casino Contracts Deployment...");
  
  // Deploy 1: RNGEngine (CasinoCore is wired after deployment)
  console.log("\n1️⃣  RNGEngine");
  const { contract: rng, address: rngAddress } = await deployContract("RNGEngine", [
    vrfConfig.coordinator,
    subscriptionId,
    vrfConfig.keyHash,
    VRF_CALLBACK_GAS_LIMIT,
    VRF_REQUEST_CONFIRMATIONS,
  ]);

  // Deploy 2: CasinoReserve (CasinoCore is wired after deployment)
  console.log("\n2️⃣  CasinoReserve");
  const { contract: reserve, address: reserveAddress } = await deployContract(
    "CasinoReserve",
    [MTX_ADDRESS, RESERVE_CAP, hre.ethers.ZeroAddress]
  );
  
  // Deploy 3: LiquidityRouter (the V2 router creates a pair on first liquidity provision)
  console.log("\n3️⃣  LiquidityRouter");
  const { contract: liquidity, address: liquidityAddress } = await deployContract(
    "LiquidityRouter",
    [MTX_ADDRESS, QUICKSWAP_V2_ROUTER_ADDRESS]
  );
  
  // Deploy 4: CasinoCore (depends on all previous contracts)
  console.log("\n4️⃣  CasinoCore");
  const { address: casinoCoreAddress } = await deployContract(
    "CasinoCore",
    [
      MTX_ADDRESS,
      liquidityAddress,
      reserveAddress,
      rngAddress,
      MIN_BET,
      MAX_BET,
      MAX_PAYOUT_PER_BET,
      DEV_ADDRESS,
      GOVERNANCE_ADDRESS
    ]
  );

  await (await reserve.setCasinoCore(casinoCoreAddress)).wait();
  await (await rng.setCasinoCore(casinoCoreAddress)).wait();
  await (await liquidity.setCasinoCore(casinoCoreAddress)).wait();
  const alreadyConsumer = subscription.consumers.some(
    (consumer) => consumer.toLowerCase() === rngAddress.toLowerCase()
  );
  if (!alreadyConsumer) {
    console.log("\nRegistering RNGEngine as a VRF subscription consumer...");
    await (await coordinator.getFunction("addConsumer")(subscriptionId, rngAddress)).wait();
  }
  
  console.log("\n╔════════════════════════════════════════════════════════════════╗");
  console.log("║                    ✅ DEPLOYMENT SUCCESSFUL                     ║");
  console.log("╚════════════════════════════════════════════════════════════════╝");
  
  // Step 8: Prepare Deployment Information
  console.log("\n💾 Preparing Deployment Information...");
  
  const deploymentInfo = {
    // Metadata
    network: hre.network.name,
    chainId: hre.network.config.chainId,
    deployer: deployer.address,
    deploymentTime: new Date().toISOString(),
    
    // Deployed Contract Addresses
    contracts: {
      mtxToken: MTX_ADDRESS,
      casinoCore: casinoCoreAddress,
      casinoReserve: reserveAddress,
      liquidityRouter: liquidityAddress,
      rngEngine: rngAddress
    },
    
    // Constructor Parameters Used
    parameters: {
      reserveCap: RESERVE_CAP.toString(),
      reserveCapFormatted: hre.ethers.formatUnits(RESERVE_CAP, 18) + " MTX",
      minBet: MIN_BET.toString(),
      minBetFormatted: hre.ethers.formatUnits(MIN_BET, 18) + " MTX",
      maxBet: MAX_BET.toString(),
      maxBetFormatted: hre.ethers.formatUnits(MAX_BET, 18) + " MTX",
      maxPayoutPerBet: MAX_PAYOUT_PER_BET.toString(),
      maxPayoutPerBetFormatted: hre.ethers.formatUnits(MAX_PAYOUT_PER_BET, 18) + " MTX",
      devAddress: DEV_ADDRESS,
      governanceAddress: GOVERNANCE_ADDRESS,
      quickSwapV2Router: QUICKSWAP_V2_ROUTER_ADDRESS,
      vrfCoordinator: vrfConfig.coordinator,
      vrfSubscriptionId: subscriptionId.toString(),
      vrfKeyHash: vrfConfig.keyHash,
      vrfRequestConfirmations: VRF_REQUEST_CONFIRMATIONS,
      vrfCallbackGasLimit: VRF_CALLBACK_GAS_LIMIT,
      vrfPayment: "LINK"
    },
    
    // Additional Info
    notes: {
      casinoReserveSetup: "CasinoCore permissions configured after deployment.",
      vrfSetup: "RNGEngine is registered as a consumer of the funded Chainlink VRF v2.5 subscription.",
      liquidityRouterSetup: "Casino MTX fees queue in LiquidityRouter. The owner must supply POL and call provideLiquidity to add MTX/WMATIC liquidity through QuickSwap V2.",
      reserveFunding: "CasinoReserve must be funded with MTX tokens before casino operations can begin."
    }
  };
  
  // Step 9: Save Deployment Information
  saveDeploymentInfo(deploymentInfo, deploymentsDir);
  
  // Step 10: Display Post-Deployment Instructions
  console.log("\n╔════════════════════════════════════════════════════════════════╗");
  console.log("║                   📋 POST-DEPLOYMENT STEPS                      ║");
  console.log("╚════════════════════════════════════════════════════════════════╝");
  
  console.log("\n🔧 Required Configuration Updates:");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  
  console.log(`\n1. Fund CasinoReserve with initial MTX: ${reserveAddress}`);
  console.log(`   Reserve Address: ${reserveAddress}`);
  console.log("   Approve MTX and call the owner-only CasinoReserve.fund(amount).");
  console.log("\n2. Approve initial MTX and call LiquidityRouter.queueInitialLiquidity(amount).");
  console.log("   Then call provideLiquidity with POL and the intended initial MTX/POL ratio.");
  console.log("   The first successful QuickSwap V2 addLiquidityETH call creates the MTX/WMATIC pair.");
  
  console.log("\n🔍 Contract Verification (Optional but Recommended):");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("\nVerify contracts on Polygonscan for transparency:");
  console.log(
    `\n  npx hardhat verify --network ${hre.network.name} ${rngAddress} ` +
      `"${vrfConfig.coordinator}" "${subscriptionId}" "${vrfConfig.keyHash}" ` +
      `"${VRF_CALLBACK_GAS_LIMIT}" "${VRF_REQUEST_CONFIRMATIONS}"`
  );
  console.log(`\n  npx hardhat verify --network ${hre.network.name} ${reserveAddress} \\`);
  console.log(`    "${MTX_ADDRESS}" "${RESERVE_CAP}" "${hre.ethers.ZeroAddress}"`);
  console.log(`\n  npx hardhat verify --network ${hre.network.name} ${liquidityAddress} \\`);
  console.log(`    "${MTX_ADDRESS}" "${QUICKSWAP_V2_ROUTER_ADDRESS}"`);
  console.log(`\n  npx hardhat verify --network ${hre.network.name} ${casinoCoreAddress} \\`);
  console.log(`    "${MTX_ADDRESS}" "${liquidityAddress}" "${reserveAddress}" "${rngAddress}" \\`);
  console.log(`    "${MIN_BET}" "${MAX_BET}" "${MAX_PAYOUT_PER_BET}" "${DEV_ADDRESS}" "${GOVERNANCE_ADDRESS}"`);
  
  console.log("\n🌐 Frontend Integration:");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("\n1. Update environment variables in .env:");
  console.log(`   CASINO_CORE_ADDRESS=${casinoCoreAddress}`);
  console.log(`   CASINO_RESERVE_ADDRESS=${reserveAddress}`);
  console.log(`   LIQUIDITY_ROUTER_ADDRESS=${liquidityAddress}`);
  console.log(`   RNG_ENGINE_ADDRESS=${rngAddress}`);
  
  console.log("\n2. Import deployment JSON in Astro components:");
  console.log(`   import deploymentInfo from '../../deployments/casino-${hre.network.name}.json';`);
  console.log("   const casinoCoreAddress = deploymentInfo.contracts.casinoCore;");
  
  console.log("\n3. Update relevant API routes and frontend files:");
  console.log("   - src/pages/api/place-bet.js");
  console.log("   - src/components/casino/*.tsx");
  console.log("   - Any files that interact with casino contracts");
  
  console.log("\n🧪 Testing:");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("\n1. Test all casino functionality on testnet first");
  console.log("2. Verify bet placement and payout mechanisms");
  console.log("3. Test liquidity routing and reserve management");
  console.log("4. Ensure proper permission controls (governance, dev)");
  
  // Get network explorer URL
  let explorerUrl = "";
  let explorerName = "Block Explorer";
  
  if (hre.network.name === "polygon") {
    explorerUrl = `https://polygonscan.com/address/${casinoCoreAddress}`;
    explorerName = "Polygonscan";
  } else if (hre.network.name === "amoy") {
    explorerUrl = `https://amoy.polygonscan.com/address/${casinoCoreAddress}`;
    explorerName = "Amoy Polygonscan";
  } else if (hre.network.name === "localhost" || hre.network.name === "hardhat") {
    explorerUrl = "http://localhost:8545";
    explorerName = "Local Network";
  }
  
  if (explorerUrl && hre.network.name !== "localhost" && hre.network.name !== "hardhat") {
    console.log("\n🔗 View CasinoCore on " + explorerName + ":");
    console.log("   " + explorerUrl);
  }
  
  console.log("\n╔════════════════════════════════════════════════════════════════╗");
  console.log("║                    🎉 DEPLOYMENT COMPLETE                       ║");
  console.log("╚════════════════════════════════════════════════════════════════╝");
  console.log("\n✅ All contracts deployed successfully");
  console.log(`✅ Deployment info saved to: deployments/casino-${hre.network.name}.json`);
  console.log("✅ Ready for frontend integration\n");
}

// ============================================================================
// ERROR HANDLING
// ============================================================================

main()
  .then(() => {
    console.log("\n🏁 Script execution completed successfully");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n╔════════════════════════════════════════════════════════════════╗");
    console.error("║                    ❌ DEPLOYMENT FAILED                         ║");
    console.error("╚════════════════════════════════════════════════════════════════╝");
    console.error("\n💥 Error Details:");
    console.error(error);
    
    console.error("\n🔍 Troubleshooting Tips:");
    console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.error("\n1. Check that your .env file is configured correctly:");
    console.error("   - PRIVATE_KEY is set");
    console.error("   - RPC URL is valid and accessible");
    console.error("\n2. Verify deployer account has sufficient POL:");
    console.error("   - Gas fees are required for contract deployment");
    console.error("   - Check balance on block explorer");
    console.error("\n3. Ensure MTX token is deployed:");
    console.error("   - Run: npm run deploy:amoy:mtx (for testnet)");
    console.error("   - Or: npm run deploy:polygon:mtx (for mainnet)");
    console.error("\n4. Verify network configuration in hardhat.config.cjs");
    console.error("\n5. Check RPC endpoint is responding:");
    console.error("   - Try: curl <RPC_URL>");
    console.error("\n6. Review Hardhat documentation: https://hardhat.org/docs");
    
    process.exit(1);
  });
