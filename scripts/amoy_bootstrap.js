/**
 * One-command Amoy testnet bootstrap (testnet only, refuses any other network).
 *
 * Steps (each is skipped if already done, so it is safe to re-run):
 *   1. Deploy a test MatrixHubCoin (or reuse MTX_CONTRACT_ADDRESS / saved address)
 *   2. Create a Chainlink VRF v2.5 subscription (or reuse VRF_SUBSCRIPTION_ID / saved id)
 *   3. Fund it with testnet LINK (waits for LINK from the faucet if the deployer has none)
 *   4. Run scripts/deploy_casino.js, which deploys, links and registers the RNG consumer
 *   5. Mint + fund the casino reserve with test MTX
 *
 * Requirements: PRIVATE_KEY of a throwaway testnet account holding Amoy POL, and
 * QUICKSWAP_V2_ROUTER_ADDRESS for Amoy. Faucets: https://faucet.polygon.technology/
 * and https://faucets.chain.link/polygon-amoy (LINK).
 *
 * USAGE: npx hardhat run scripts/amoy_bootstrap.js --network amoy
 */
import hre from "hardhat";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const COORDINATOR = "0x343300b5d84D444B2ADc9116FEF1bED02BE49Cf2";
const LINK = "0x0fd9e8d3af1aaee056eb9e802c3a762a667b1904";
const SUB_FUNDING_LINK = process.env.AMOY_VRF_FUNDING_LINK || "5";
const RESERVE_FUNDING_MTX = "5000";
const LINK_WAIT_MS = 10 * 60 * 1000;

const STATE_FILE = path.join(__dirname, "..", "deployments", "amoy-bootstrap.json");

function loadState() {
  return fs.existsSync(STATE_FILE) ? JSON.parse(fs.readFileSync(STATE_FILE, "utf8")) : {};
}

function saveState(state) {
  fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

async function main() {
  const { ethers } = hre;
  if (hre.network.name !== "amoy" || hre.network.config.chainId !== 80002) {
    throw new Error("amoy_bootstrap.js only runs on Polygon Amoy (--network amoy).");
  }
  const [deployer] = await ethers.getSigners();
  if (!deployer) throw new Error("Set PRIVATE_KEY to a throwaway Amoy testnet key.");
  if (!process.env.QUICKSWAP_V2_ROUTER_ADDRESS) {
    throw new Error("Set QUICKSWAP_V2_ROUTER_ADDRESS to the Amoy QuickSwap V2 router.");
  }
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`Deployer ${deployer.address}, balance ${ethers.formatEther(balance)} POL`);
  if (balance === 0n) {
    throw new Error("Deployer has no Amoy POL. Get some at https://faucet.polygon.technology/");
  }

  const state = loadState();

  // 1. Test MTX token
  let mtxAddress = process.env.MTX_CONTRACT_ADDRESS || state.mtxToken;
  if (!mtxAddress) {
    const Mtx = await ethers.getContractFactory("MatrixHubCoin");
    const mtx = await Mtx.deploy(100000000, deployer.address);
    await mtx.waitForDeployment();
    mtxAddress = await mtx.getAddress();
    console.log("Deployed test MTX:", mtxAddress);
  }
  state.mtxToken = mtxAddress;
  saveState(state);

  // 2. VRF subscription
  const coordinator = new ethers.Contract(
    COORDINATOR,
    [
      "function createSubscription() returns (uint256)",
      "event SubscriptionCreated(uint256 indexed subId, address owner)",
      "function getSubscription(uint256) view returns (uint96 balance,uint96 nativeBalance,uint64 reqCount,address owner,address[] consumers)",
    ],
    deployer
  );
  let subId = process.env.VRF_SUBSCRIPTION_ID || state.vrfSubscriptionId;
  if (!subId) {
    const receipt = await (await coordinator.createSubscription()).wait();
    const event = receipt.logs
      .map((log) => {
        try {
          return coordinator.interface.parseLog(log);
        } catch {
          return null;
        }
      })
      .find((parsed) => parsed?.name === "SubscriptionCreated");
    if (!event) throw new Error("SubscriptionCreated event not found.");
    subId = event.args.subId.toString();
    console.log("Created VRF subscription:", subId);
  }
  state.vrfSubscriptionId = subId;
  saveState(state);

  // 3. Fund with LINK
  const sub = await coordinator.getSubscription(subId);
  if (sub.balance === 0n) {
    const link = new ethers.Contract(
      LINK,
      [
        "function balanceOf(address) view returns (uint256)",
        "function transferAndCall(address to,uint256 value,bytes data) returns (bool)",
      ],
      deployer
    );
    const amount = ethers.parseEther(SUB_FUNDING_LINK);
    const deadline = Date.now() + LINK_WAIT_MS;
    while ((await link.balanceOf(deployer.address)) < amount) {
      if (Date.now() > deadline) {
        throw new Error(
          `Need ${SUB_FUNDING_LINK} Amoy LINK at ${deployer.address}. Request it at ` +
            "https://faucets.chain.link/polygon-amoy, then re-run (state is saved)."
        );
      }
      console.log(`Waiting for ${SUB_FUNDING_LINK} LINK from the faucet (${deployer.address})...`);
      await new Promise((resolve) => setTimeout(resolve, 15000));
    }
    const data = ethers.AbiCoder.defaultAbiCoder().encode(["uint256"], [subId]);
    await (await link.transferAndCall(COORDINATOR, amount, data)).wait();
    console.log(`Funded subscription ${subId} with ${SUB_FUNDING_LINK} LINK`);
  }

  // 4. Deploy and link the casino
  process.env.MTX_CONTRACT_ADDRESS = mtxAddress;
  process.env.VRF_SUBSCRIPTION_ID = subId;
  process.env.CASINO_MAX_PAYOUT_PER_BET ||= "100";
  await import("./deploy_casino.js");

  // deploy_casino.js reports failure via process.exit(1); reaching here means success.
  const casino = JSON.parse(
    fs.readFileSync(path.join(__dirname, "..", "deployments", "casino-amoy.json"), "utf8")
  );

  // 5. Fund the reserve with test MTX
  const mtx = await ethers.getContractAt("MatrixHubCoin", mtxAddress);
  const reserve = await ethers.getContractAt("CasinoReserve", casino.contracts.casinoReserve);
  const amount = ethers.parseEther(RESERVE_FUNDING_MTX);
  await (await mtx.mintToEcosystem(deployer.address, amount)).wait();
  await (await mtx.approve(reserve.target, amount)).wait();
  await (await reserve.fund(amount)).wait();

  state.casino = casino.contracts;
  state.completedAt = new Date().toISOString();
  saveState(state);

  console.log("\nAmoy casino is live on testnet. Set for the frontend:");
  console.log("PUBLIC_CASINO_CHAIN_ID=80002");
  console.log(`PUBLIC_MTX_CONTRACT_ADDRESS=${mtxAddress}`);
  console.log(`CASINO_CORE_ADDRESS=${casino.contracts.casinoCore}`);
  console.log(`CASINO_RESERVE_ADDRESS=${casino.contracts.casinoReserve}`);
  console.log(`LIQUIDITY_ROUTER_ADDRESS=${casino.contracts.liquidityRouter}`);
  console.log(`RNG_ENGINE_ADDRESS=${casino.contracts.rngEngine}`);
}

main().catch((error) => {
  console.error("Amoy bootstrap failed:", error.message);
  process.exit(1);
});
