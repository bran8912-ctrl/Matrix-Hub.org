/**
 * Deploy MatrixHubCoin to Polygon Mainnet via injected MetaMask
 * Constructor: uint256 maxSupply, address initialOwner
 */
const fs = require('fs');

async function main() {
  const accounts = await window.ethereum.request({ method: 'eth_accounts' });
  const deployer = accounts[0];
  console.log('Deployer address:', deployer);

  // Load MatrixHubCoin artifact
  const artifact = JSON.parse(fs.readFileSync('/artifacts/MatrixHubCoin.json', 'utf8'));
  const bytecode = artifact.data.bytecode.object;
  console.log('Bytecode length:', bytecode.length);

  // Constructor arguments
  const maxSupply = 1000000000; // 1 billion
  const initialOwner = '0x9fb4bb44d8d962d695fc93b3dc15f1b287391077';
  console.log('maxSupply:', maxSupply);
  console.log('initialOwner:', initialOwner);

  // Encode constructor args: uint256, address
  const encodedMaxSupply = web3.eth.abi.encodeParameter('uint256', maxSupply).slice(2);
  const encodedOwner = web3.eth.abi.encodeParameter('address', initialOwner).slice(2);
  const constructorArgs = encodedMaxSupply + encodedOwner;

  const data = '0x' + bytecode + constructorArgs;
  console.log('Total data length:', data.length);

  console.log('Sending deployment transaction...');
  const tx = await web3.eth.sendTransaction({
    from: deployer,
    data: data,
    gas: 3000000
  });

  console.log('Transaction hash:', tx.transactionHash);
  console.log('Contract address:', tx.contractAddress);
  console.log('Gas used:', tx.gasUsed);
  console.log('Status:', tx.status ? 'SUCCESS' : 'FAILED');
  console.log('Block number:', tx.blockNumber);
  console.log('Effective gas price:', tx.effectiveGasPrice);

  console.log('\n=== DEPLOYMENT SUMMARY ===');
  console.log('Contract: MatrixHubCoin');
  console.log('Address:', tx.contractAddress);
  console.log('Transaction Hash:', tx.transactionHash);
  console.log('Gas Used:', tx.gasUsed);
  console.log('Block:', tx.blockNumber);
  console.log('Status:', tx.status ? 'Success' : 'Failed');
}

main().catch(err => { console.error('Deployment failed:', err); throw err; });
