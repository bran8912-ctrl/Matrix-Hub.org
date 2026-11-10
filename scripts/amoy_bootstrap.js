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
 * GOVERNANCE: if GOVERNANCE_ADDRESS names a non-deployer address, step 4
 * transfers reserve ownership to it and step 5 does NOT attempt fund() from
 * the deployer (it would revert, NotAuthorized). Instead it mints the test
 * MTX to the governance address and prints the exact fund() calls the
 * governance key must sign; re-running after that completes the run.
 *
 * LOCAL DRY RUN (no network, no wallet, no LINK):
 *   CASINO_LOCAL_DRY_RUN=1 npx hardhat run scripts/amoy_bootstrap.js --network hardhat
 * Mock VRF coordinator (subscription id 1, no LINK step) + mock router +
 * test MTX. State goes to deployments/amoy-bootstrap-local-dryrun.json so a
 * dry run can never clobber real Amoy state.
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

// Local dry-run mode (Phase 3): same flow, in-memory network, mock VRF
// coordinator (no subscriptions/LINK) + mock router + test MTX. Never touches
// a real network and never writes real Amoy state (separate state file).
const LOCAL_DRY_RUN = process.env.CASINO_LOCAL_DRY_RUN === "1";

// Mock-VRF Amoy mode (temporary, labelled): CASINO_MOCK_VRF_AMOY=1 runs the
// Amoy deploy with a MockVRFCoordinator deployed as a real Amoy tx, so the
// casino test run is not blocked on LINK. Amoy (chain 80002) ONLY — the
// network guard in main() refuses every other network, and deploy_casino.js
// refuses it on any non-Amoy network too. It must NEVER be mistaken for a
// real-VRF deployment: state.mockVrf is recorded below and
// deployments/casino-amoy.json records mockVrfOnAmoy: true. Before ANY later
// real-VRF re-run, delete vrfSubscriptionId, mockVrf, mockCoordinator and
// mockVrfWarning from deployments/amoy-bootstrap.json, or the re-run would
// try to fund real subscription 1, which belongs to someone else.
const MOCK_VRF_AMOY = process.env.CASINO_MOCK_VRF_AMOY === "1";

const STATE_FILE = path.join(
  __dirname,
  "..",
  "deployments",
  LOCAL_DRY_RUN ? "amoy-bootstrap-local-dryrun.json" : "amoy-bootstrap.json"
);

function loadState() {
  return fs.existsSync(STATE_FILE) ? JSON.parse(fs.readFileSync(STATE_FILE, "utf8")) : {};
}

function saveState(state) {
  fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

async function main() {
  const { ethers } = hre;
  if (LOCAL_DRY_RUN) {
    if (
      (hre.network.name !== "hardhat" && hre.network.name !== "localhost") ||
      hre.network.config.chainId !== 31337
    ) {
      throw new Error("CASINO_LOCAL_DRY_RUN=1 only runs on the Hardhat in-memory network (--network hardhat).");
    }
    console.log("🧪 LOCAL DRY RUN — mock VRF coordinator / mock router / test MTX only. No real network, no LINK, no wallet needed.");
  } else if (hre.network.name !== "amoy" || hre.network.config.chainId !== 80002) {
    throw new Error("amoy_bootstrap.js only runs on Polygon Amoy (--network amoy).");
  }
  if (MOCK_VRF_AMOY) {
    console.log("🧪 MOCK VRF ON AMOY (temporary, labelled) — MockVRFCoordinator deployed as a real Amoy tx; no LINK, no real VRF subscription. This deployment can NEVER satisfy the mainnet gate.");
  }
  const [deployer] = await ethers.getSigners();
  if (!deployer) throw new Error("Set PRIVATE_KEY to a throwaway Amoy testnet key.");
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`Deployer ${deployer.address}, balance ${ethers.formatEther(balance)} POL`);
  if (balance === 0n) {
    throw new Error("Deployer has no Amoy POL. Get some at https://faucet.polygon.technology/");
  }

  const state = loadState();

  // Amoy has no official QuickSwap; deploy a mock router when none is supplied.
  // LiquidityRouter's constructor reads router.WETH() and reverts unless it is
  // a non-zero address WITH code, so the mock router must be given a mock
  // wrapped-native token — never ZeroAddress (that used to make the
  // LiquidityRouter deploy revert with ZeroAddress()).
  if (!process.env.QUICKSWAP_V2_ROUTER_ADDRESS) {
    if (!state.mockRouter) {
      const MockToken = await ethers.getContractFactory("MockLiquidityToken");
      const wrappedNative = await MockToken.deploy();
      await wrappedNative.waitForDeployment();
      state.mockWrappedNative = await wrappedNative.getAddress();
      const Mock = await ethers.getContractFactory("MockQuickSwapV2Router");
      const mock = await Mock.deploy(state.mockWrappedNative);
      await mock.waitForDeployment();
      state.mockRouter = await mock.getAddress();
      saveState(state);
      console.log(`Deployed MockQuickSwapV2Router ${state.mockRouter}`);
    }
    process.env.QUICKSWAP_V2_ROUTER_ADDRESS = state.mockRouter;
  }

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
  // Mock coordinator (local dry run OR mock-VRF Amoy): the mock coordinator
  // has no subscription model (no createSubscription / getSubscription /
  // LINK), so use id 1 and skip step 3 entirely. deploy_casino.js reuses
  // this mock via CASINO_LOCAL_DRY_RUN_COORDINATOR (historical env name —
  // it carries the mock coordinator address in both modes).
  let subId = process.env.VRF_SUBSCRIPTION_ID || state.vrfSubscriptionId;
  if (LOCAL_DRY_RUN || MOCK_VRF_AMOY) {
    if (!state.mockCoordinator) {
      const MockCoordinator = await ethers.getContractFactory("MockVRFCoordinator");
      const mockCoordinator = await MockCoordinator.deploy();
      await mockCoordinator.waitForDeployment();
      state.mockCoordinator = await mockCoordinator.getAddress();
      saveState(state);
      console.log(`Deployed MockVRFCoordinator ${state.mockCoordinator} (local dry run only)`);
    }
    process.env.CASINO_LOCAL_DRY_RUN_COORDINATOR = state.mockCoordinator;
    subId = "1";
    console.log(
      MOCK_VRF_AMOY
        ? "Mock VRF on Amoy: VRF subscription is mock id 1 — no LINK funding step."
        : "Local dry run: VRF subscription is mock id 1 — no LINK funding step."
    );
  } else {
    const coordinator = new ethers.Contract(
      COORDINATOR,
      [
        "function createSubscription() returns (uint256)",
        "event SubscriptionCreated(uint256 indexed subId, address owner)",
        "function getSubscription(uint256) view returns (uint96 balance,uint96 nativeBalance,uint64 reqCount,address owner,address[] consumers)",
      ],
      deployer
    );
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
  }
  state.vrfSubscriptionId = subId;
  if (MOCK_VRF_AMOY) {
    state.mockVrf = true;
    state.mockVrfWarning =
      "POISONED STATE — mock run: vrfSubscriptionId '1' is a MOCK id, NOT a real Chainlink subscription. Before ANY later real-VRF re-run, delete vrfSubscriptionId, mockVrf, mockCoordinator and mockVrfWarning from this file, or the re-run would try to fund real subscription 1, which belongs to someone else.";
  }
  saveState(state);

  // 4. Deploy and link the casino.
  // deploy_casino.js is imported WITHOUT auto-running (it only auto-runs
  // when it is the hardhat-run entrypoint) and invoked explicitly here, so
  // this script keeps running into step 5 afterwards. The old bare import
  // used to let deploy_casino.js process.exit(0) inside this process,
  // silently skipping step 5 (reserve funding) on every successful run.
  // NOTE (G-03): deploy_casino.js honours GOVERNANCE_ADDRESS / DEV_ADDRESS
  // from env. If GOVERNANCE_ADDRESS is set to a non-deployer address, it
  // transfers CasinoReserve + LiquidityRouter ownership to governance — and
  // step 5 below handles that: it mints the test MTX to the governance
  // address and prints the exact fund() calls the governance key must sign
  // (reserve.fund is owner-only). Leave GOVERNANCE_ADDRESS unset for
  // throwaway Amoy runs so the deployer stays the reserve owner.
  process.env.MTX_CONTRACT_ADDRESS = mtxAddress;
  process.env.VRF_SUBSCRIPTION_ID = subId;
  process.env.CASINO_MAX_PAYOUT_PER_BET ||= "100";
  const { deployCasino } = await import("./deploy_casino.js");
  await deployCasino();

  // deployCasino() throws on failure; reaching here means it succeeded.
  // The deployment file is named after the network (casino-amoy.json on
  // Amoy, casino-hardhat.json in a local dry run).
  const casino = JSON.parse(
    fs.readFileSync(path.join(__dirname, "..", "deployments", `casino-${hre.network.name}.json`), "utf8")
  );

  // 5. Fund the reserve with test MTX.
  // reserve.fund() is owner-only (CasinoReserve.fund reverts NotAuthorized
  // for anyone but the reserve owner). After step 4 the reserve owner is the
  // deployer UNLESS GOVERNANCE_ADDRESS was set to another address — in that
  // case deploy_casino.js transferred ownership to governance, so this
  // deployer CANNOT fund it: the script mints the test MTX to the governance
  // address instead and prints the exact calls the governance key must sign.
  // Re-running after the manual step completes the run (reserveHealth() is
  // checked first, so funding is never doubled).
  const mtx = await ethers.getContractAt("MatrixHubCoin", mtxAddress);
  const reserve = await ethers.getContractAt("CasinoReserve", casino.contracts.casinoReserve);
  const amount = ethers.parseEther(RESERVE_FUNDING_MTX);
  const reserveOwner = await reserve.owner();
  const reserveOwnedByGovernance =
    reserveOwner.toLowerCase() !== deployer.address.toLowerCase();
  let reserveFunded = false;
  if ((await reserve.reserveHealth()) >= amount) {
    console.log(
      `Reserve already funded (${ethers.formatEther(await reserve.reserveHealth())} MTX) — skipping step 5 (idempotent re-run).`
    );
    reserveFunded = true;
  } else if (!reserveOwnedByGovernance) {
    await (await mtx.mintToEcosystem(deployer.address, amount)).wait();
    await (await mtx.approve(reserve.target, amount)).wait();
    await (await reserve.fund(amount)).wait();
    console.log(`Funded reserve with ${RESERVE_FUNDING_MTX} test MTX`);
    reserveFunded = true;
  } else {
    // Governance owns the reserve now: put the test MTX in governance's
    // hands (possible only if this deployer owns the test MTX) and leave
    // fund() to the governance key — attempting it here would revert.
    const mtxOwner = await mtx.owner();
    if (mtxOwner.toLowerCase() === deployer.address.toLowerCase()) {
      if ((await mtx.balanceOf(reserveOwner)) < amount) {
        await (await mtx.mintToEcosystem(reserveOwner, amount)).wait();
        console.log(`Minted ${RESERVE_FUNDING_MTX} test MTX to governance ${reserveOwner}`);
      } else {
        console.log(`Governance ${reserveOwner} already holds ${RESERVE_FUNDING_MTX} test MTX.`);
      }
    } else {
      console.log(
        `⚠️  Test MTX owner is ${mtxOwner}, not the deployer — the deployer cannot mint test MTX to governance. Send ${RESERVE_FUNDING_MTX} test MTX to ${reserveOwner} first.`
      );
    }
    state.pendingReserveFunding = {
      reserve: casino.contracts.casinoReserve,
      amountMtx: RESERVE_FUNDING_MTX,
      governance: reserveOwner,
      mtxToken: mtxAddress,
    };
    console.log("\n⚠️  RESERVE NOT FUNDED BY THIS RUN — governance owns the reserve, so only the governance key can call fund():");
    console.log(`   1. From governance ${reserveOwner}: MTX.approve(${casino.contracts.casinoReserve}, ${amount} /* ${RESERVE_FUNDING_MTX} MTX */)`);
    console.log(`   2. From governance ${reserveOwner}: CasinoReserve(${casino.contracts.casinoReserve}).fund(${amount})`);
    console.log("   3. Re-run this bootstrap afterwards: it detects reserveHealth() and completes.");
    console.log("   Until then the casino is DEPLOYED BUT NOT PLAYABLE — every bet reverts with MaxPayoutExceedsReserve on an empty reserve.");
  }

  state.casino = casino.contracts;
  if (reserveFunded) {
    state.completedAt = new Date().toISOString();
    delete state.pendingReserveFunding;
  } else {
    delete state.completedAt;
  }
  saveState(state);

  if (!reserveFunded) {
    console.log("\nAmoy casino contracts are deployed; reserve funding is pending the manual governance step above.");
    console.log(`PUBLIC_CASINO_CHAIN_ID=${hre.network.config.chainId}`);
    console.log(`PUBLIC_MTX_CONTRACT_ADDRESS=${mtxAddress}`);
    console.log(`CASINO_CORE_ADDRESS=${casino.contracts.casinoCore}`);
    console.log(`CASINO_RESERVE_ADDRESS=${casino.contracts.casinoReserve}`);
    console.log(`LIQUIDITY_ROUTER_ADDRESS=${casino.contracts.liquidityRouter}`);
    console.log(`RNG_ENGINE_ADDRESS=${casino.contracts.rngEngine}`);
    return;
  }

  console.log("\nAmoy casino is live on testnet. Set for the frontend:");
  console.log(`PUBLIC_CASINO_CHAIN_ID=${hre.network.config.chainId}`);
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
