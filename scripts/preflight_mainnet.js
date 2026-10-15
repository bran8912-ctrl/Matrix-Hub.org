/**
 * Read-only Polygon mainnet launch preflight. Sends no transactions and never
 * prints secret values. Exits non-zero while any blocker remains.
 *
 * USAGE: node scripts/preflight_mainnet.js
 */
import "dotenv/config";
import { Contract, JsonRpcProvider, Wallet, formatEther, formatUnits, isAddress } from "ethers";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DEPLOYED_CONTRACTS } from "../src/config/contracts.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RPC = process.env.POLYGON_RPC_URL || "https://polygon.drpc.org";
const COORDINATOR = "0xec0Ed46f36576541C75739E915ADbCb3DE24bD77";
const CANONICAL_MTX = DEPLOYED_CONTRACTS.mtxToken;
const MIN_DEPLOY_POL = 15;

const results = [];
const check = (ok, label, detail = "") => results.push({ ok, label, detail });

function ghJson(args) {
  try {
    return JSON.parse(execFileSync("gh", args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }));
  } catch {
    return null;
  }
}

async function main() {
  const provider = new JsonRpcProvider(RPC);
  const network = await provider.getNetwork();
  check(network.chainId === 137n, "RPC is Polygon mainnet (137)", `chain ${network.chainId}`);

  // Secrets and settings (presence only)
  let deployer = null;
  if (process.env.PRIVATE_KEY) {
    try {
      deployer = new Wallet(process.env.PRIVATE_KEY);
    } catch {
      /* reported below */
    }
  }
  check(Boolean(deployer), "PRIVATE_KEY set and valid");
  if (deployer) {
    check(
      deployer.address.toLowerCase() === DEPLOYED_CONTRACTS.deployer.toLowerCase(),
      "Signer matches configured owner/deployer",
      deployer.address
    );
    const balance = await provider.getBalance(deployer.address);
    check(
      Number(formatEther(balance)) >= MIN_DEPLOY_POL,
      `Deployer holds at least ${MIN_DEPLOY_POL} POL`,
      `${formatEther(balance)} POL`
    );
  }
  check(
    (process.env.MTX_CONTRACT_ADDRESS || CANONICAL_MTX).toLowerCase() === CANONICAL_MTX.toLowerCase(),
    "MTX address is the designated canonical token"
  );
  const router = process.env.QUICKSWAP_V2_ROUTER_ADDRESS;
  check(Boolean(router) && isAddress(router), "QUICKSWAP_V2_ROUTER_ADDRESS set");
  if (router && isAddress(router)) {
    check((await provider.getCode(router)) !== "0x", "QuickSwap router has bytecode");
  }
  const payout = process.env.CASINO_MAX_PAYOUT_PER_BET;
  check(Boolean(payout) && Number(payout) > 0, "CASINO_MAX_PAYOUT_PER_BET set (owner policy)", payout || "");
  check(
    process.env.POLYGON_CASINO_DEPLOYMENT_APPROVED === "YES",
    "POLYGON_CASINO_DEPLOYMENT_APPROVED=YES (owner's explicit release flag)"
  );

  // MTX token
  const mtx = new Contract(
    CANONICAL_MTX,
    ["function symbol() view returns (string)", "function totalSupply() view returns (uint256)", "function owner() view returns (address)"],
    provider
  );
  try {
    const [symbol, supply, owner] = await Promise.all([mtx.symbol(), mtx.totalSupply(), mtx.owner()]);
    check(symbol === "MTX", "MTX contract responds", `supply ${formatUnits(supply, 18)}`);
    check(
      Boolean(deployer) && owner.toLowerCase() === deployer.address.toLowerCase(),
      "Signer owns the MTX token (needed to mint reserve funding)",
      owner
    );
  } catch (error) {
    check(false, "MTX contract responds", error.message);
  }

  // VRF subscription
  const subId = process.env.VRF_SUBSCRIPTION_ID;
  check(Boolean(subId) && /^\d+$/.test(subId), "VRF_SUBSCRIPTION_ID set");
  if (subId && /^\d+$/.test(subId)) {
    try {
      const coordinator = new Contract(
        COORDINATOR,
        ["function getSubscription(uint256) view returns (uint96 balance,uint96 nativeBalance,uint64 reqCount,address owner,address[] consumers)"],
        provider
      );
      const sub = await coordinator.getSubscription(subId);
      check(
        Boolean(deployer) && sub.owner.toLowerCase() === deployer.address.toLowerCase(),
        "VRF subscription owned by deployer"
      );
      check(sub.balance > 0n, "VRF subscription funded with official LINK", `${formatUnits(sub.balance, 18)} LINK`);
    } catch (error) {
      check(false, "VRF subscription readable", error.message);
    }
  }

  // Testnet evidence, security review and GitHub controls
  const amoyFile = path.join(__dirname, "..", "deployments", "casino-amoy.json");
  const amoy = fs.existsSync(amoyFile) ? JSON.parse(fs.readFileSync(amoyFile, "utf8")) : null;
  check(amoy?.status === "deployed", "Amoy casino deployment completed (deployments/casino-amoy.json)");
  check(
    fs.existsSync(path.join(__dirname, "..", "docs", "SECURITY_REVIEW_SIGNOFF.md")),
    "Independent security review sign-off recorded (docs/SECURITY_REVIEW_SIGNOFF.md)"
  );
  const env = ghJson(["api", "repos/{owner}/{repo}/environments/polygon-production"]);
  const reviewers = env?.protection_rules?.some((rule) => rule.type === "required_reviewers");
  check(Boolean(reviewers), "GitHub environment polygon-production has required reviewers");

  let failed = 0;
  for (const { ok, label, detail } of results) {
    if (!ok) failed += 1;
    console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? ` - ${detail}` : ""}`);
  }
  console.log(failed ? `\n${failed} blocker(s) remain. Do not deploy.` : "\nAll preflight checks passed.");
  process.exitCode = failed ? 1 : 0;
}

main().catch((error) => {
  console.error("Preflight failed:", error.message);
  process.exitCode = 1;
});
