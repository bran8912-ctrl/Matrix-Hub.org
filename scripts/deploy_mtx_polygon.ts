// Deploy MatrixHubCoin to Polygon Mainnet using injected MetaMask provider
import { ethers } from "ethers";

async function main() {
  if (typeof (window as any) === "undefined" || !(window as any).ethereum) {
    throw new Error("No injected Ethereum provider found (window.ethereum). Make sure MetaMask is connected.");
  }

  const provider = new ethers.BrowserProvider((window as any).ethereum);
  const signer = await provider.getSigner();
  const deployer = await signer.getAddress();
  console.log("Deployer address:", deployer);

  const balance = await provider.getBalance(deployer);
  console.log("Balance:", ethers.formatEther(balance), "POL");

  const network = await provider.getNetwork();
  console.log("Network chainId:", network.chainId.toString());

  if (network.chainId !== 137n) {
    throw new Error(`Expected Polygon Mainnet (chainId 137), got chainId ${network.chainId}`);
  }

  const maxSupply = 1000000000;
  const initialOwner = "0x9fb4bb44d8d962d695fc93b3dc15f1b287391077";
  console.log("Deploying MatrixHubCoin...");
  console.log("  maxSupply:", maxSupply);
  console.log("  initialOwner:", initialOwner);

  const abi = [
    "constructor(uint256 maxSupply, address initialOwner)"
  ];

  const fs = await import("fs");
  const artifact = JSON.parse(fs.readFileSync("/artifacts/MatrixHubCoin.json", "utf8"));
  const bytecode = artifact.data.bytecode.object;

  if (!bytecode || bytecode.length < 10) {
    throw new Error("Invalid bytecode from artifact");
  }

  const factory = new ethers.ContractFactory(abi, bytecode, signer);

  console.log("Sending deployment transaction...");
  const contract = await factory.deploy(maxSupply, initialOwner, { gasLimit: 3000000 });
  const deployTx = contract.deploymentTransaction();
  console.log("Transaction hash:", deployTx?.hash);

  await contract.waitForDeployment();
  const address = await contract.getAddress();
  console.log("Deployed contract address:", address);

  if (deployTx) {
    console.log("Gas limit:", deployTx.gasLimit?.toString());
  }

  const receipt = await provider.getTransactionReceipt(deployTx!.hash);
  if (receipt) {
    console.log("Gas used:", receipt.gasUsed?.toString());
    console.log("Block number:", receipt.blockNumber);
    console.log("Status:", receipt.status === 1 ? "success" : "failed");
  }

  console.log("\n=== DEPLOYMENT SUMMARY ===");
  console.log("Contract: MatrixHubCoin");
  console.log("Address:", address);
  console.log("Transaction Hash:", deployTx?.hash);
  console.log("Gas Used:", receipt?.gasUsed?.toString());
  console.log("Block:", receipt?.blockNumber);
  console.log("Status:", receipt?.status === 1 ? "✅ Success" : "❌ Failed");
}

main().catch(err => {
  console.error("Deployment failed:", err);
  throw err;
});
