// Deploy MatrixHubCoin using ethers with injected provider
const ethers = require('ethers');

async function main() {
  // Get the injected provider from Remix
  const provider = new ethers.BrowserProvider(window.ethereum);
  
  const signer = await provider.getSigner();
  console.log('Deployer address:', await signer.getAddress());
  
  const balance = await provider.getBalance(await signer.getAddress());
  console.log('Balance:', ethers.formatEther(balance), 'POL');
  
  // Contract bytecode from artifacts
  const fs = require('fs');
  const artifact = JSON.parse(fs.readFileSync('/artifacts/MatrixHubCoin.json', 'utf8'));
  const bytecode = artifact.data.bytecode.object;
  
  // ABI - constructor only
  const abi = [
    'constructor(uint256 maxSupply, address initialOwner)'
  ];
  
  const factory = new ethers.ContractFactory(abi, bytecode, signer);
  
  const maxSupply = 1000000000;
  const initialOwner = '0x9fb4bb44d8d962d695fc93b3dc15f1b287391077';
  
  console.log('Deploying MatrixHubCoin...');
  console.log('maxSupply:', maxSupply);
  console.log('initialOwner:', initialOwner);
  
  const contract = await factory.deploy(maxSupply, initialOwner);
  console.log('Deployment transaction hash:', contract.deploymentTransaction().hash);
  
  await contract.waitForDeployment();
  const address = await contract.getAddress();
  console.log('Deployed to:', address);
  
  const tx = contract.deploymentTransaction();
  console.log('Gas limit:', tx.gasLimit?.toString());
  
  const receipt = await provider.getTransactionReceipt(tx.hash);
  if (receipt) {
    console.log('Gas used:', receipt.gasUsed?.toString());
    console.log('Block number:', receipt.blockNumber);
    console.log('Status:', receipt.status);
  }
}

main().catch(err => {
  console.error('Deployment failed:', err);
  process.exit(1);
});
