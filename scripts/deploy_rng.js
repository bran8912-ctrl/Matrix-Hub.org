/**
 * Deploy RNGEngine to Sepolia via injected MetaMask
 * Constructor: address _casinoCore
 */

const fs = require('fs');

async function main() {
  const accounts = await window.ethereum.request({ method: 'eth_accounts' });
  const deployer = accounts[0];
  console.log('Deployer address:', deployer);

  // Load RNGEngine artifact
  const rngArtifact = JSON.parse(fs.readFileSync('/.artifacts/RNGEngine.json', 'utf8'));
  const bytecode = rngArtifact.data.bytecode.object;

  // Constructor argument: _casinoCore = 0x70561Ac30AEDEE7a09Cb3840A1c7E441fD80195F
  const casinoCore = '0x70561Ac30AEDEE7a09Cb3840A1c7E441fD80195F';
  const encodedArg = web3.eth.abi.encodeParameter('address', casinoCore).slice(2); // remove 0x prefix

  const data = '0x' + bytecode + encodedArg;
  console.log('Deploying RNGEngine with _casinoCore =', casinoCore);

  const tx = await web3.eth.sendTransaction({
    from: deployer,
    data: data,
    gas: 3000000
  });

  console.log('Transaction hash:', tx.transactionHash);
  console.log('Contract address:', tx.contractAddress);
  console.log('Gas used:', tx.gasUsed);
  console.log('Status:', tx.status ? 'SUCCESS' : 'FAILED');
}

main().catch(err => { console.error(err); });
