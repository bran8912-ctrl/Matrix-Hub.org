import "dotenv/config";
import { spawnSync } from "node:child_process";
import { Contract, JsonRpcProvider } from "ethers";
import { DEPLOYED_CONTRACTS } from "../src/config/contracts.js";

const address = DEPLOYED_CONTRACTS.mtxToken;
const deployer = DEPLOYED_CONTRACTS.deployer;
const constructorArgs = ["100000000", deployer];
const rpcUrl = process.env.POLYGON_RPC_URL || "https://polygon.drpc.org";
const npx = process.platform === "win32" ? "npx.cmd" : "npx";
const tokenAbi = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function owner() view returns (address)",
  "function MAX_SUPPLY() view returns (uint256)"
];

if (!process.env.POLYGONSCAN_API_KEY?.trim()) {
  console.error("POLYGONSCAN_API_KEY is required. Set it in .env or the environment.");
  process.exit(1);
}

console.log(`Preflighting selected MTX token at ${address} on Polygon...`);
const provider = new JsonRpcProvider(rpcUrl);
try {
  const network = await provider.getNetwork();
  if (network.chainId !== 137n) {
    throw new Error(`Expected Polygon chain ID 137; received ${network.chainId}.`);
  }

  const code = await provider.getCode(address);
  if (code === "0x") {
    throw new Error(`No contract bytecode is deployed at ${address}.`);
  }

  const token = new Contract(address, tokenAbi, provider);
  const [name, symbol, decimals, owner, maxSupply] = await Promise.all([
    token.name(),
    token.symbol(),
    token.decimals(),
    token.owner(),
    token.MAX_SUPPLY()
  ]);

  const expectedMaxSupply = 100_000_000n * 10n ** 18n;
  if (
    name !== "Matrix-HubCoin" ||
    symbol !== "MTX" ||
    decimals !== 18n ||
    owner.toLowerCase() !== deployer.toLowerCase() ||
    maxSupply !== expectedMaxSupply
  ) {
    throw new Error(
      `On-chain token checks failed (name=${name}, symbol=${symbol}, decimals=${decimals}, owner=${owner}, maxSupply=${maxSupply}).`
    );
  }

  console.log(
    `Preflight passed: ${name} (${symbol}), ${decimals} decimals, owner ${owner}, cap ${maxSupply}.`
  );
} finally {
  provider.destroy();
}

console.log("Submitting source verification for MatrixHubCoin only.");
console.log("Casino module addresses are intentionally excluded pending valid deployments.");

const result = spawnSync(npx, [
  "--no-install",
  "hardhat",
  "verify",
  "--network",
  "polygon",
  "--contract",
  "contracts/MatrixHubCoin.sol:MatrixHubCoin",
  address,
  ...constructorArgs
], { stdio: "inherit" });

if (result.error) {
  console.error(`MatrixHubCoin verification could not start: ${result.error.message}`);
  process.exitCode = 1;
} else if (result.status !== 0) {
  console.error(`MatrixHubCoin verification failed with exit code ${result.status}.`);
  process.exitCode = result.status || 1;
}
