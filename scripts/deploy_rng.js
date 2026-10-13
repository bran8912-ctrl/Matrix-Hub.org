/**
 * Deploy RNGEngine to Amoy via injected MetaMask
 * Constructor: address _casinoCore
 */

const fs = require('fs');

async function main() {
  const chainId = await window.ethereum.request({ method: 'eth_chainId' });
  if (Number.parseInt(chainId, 16) !== 80002) {
    throw new Error('Connect to Polygon Amoy (chain ID 80002) before deploying.');
  }
  const accounts = await window.ethereum.request({ method: 'eth_accounts' });
  const deployer = accounts[0];
  console.log('Deployer address:', deployer);

  // Load RNGEngine artifact
  const rngArtifact = JSON.parse(fs.readFileSync('/.artifacts/RNGEngine.json', 'utf8'));
  const bytecode = rngArtifact.data.bytecode.object;

  const casinoCore = window.prompt('Enter the deployed CasinoCore address on Amoy')?.trim();
  if (!web3.utils.isAddress(casinoCore) || /^0x0{40}$/i.test(casinoCore)) {
    throw new Error('Enter a valid, non-zero Amoy CasinoCore address.');
  }
  if (await web3.eth.getCode(casinoCore) === '0x') {
    throw new Error('CasinoCore must contain deployed code on Amoy.');
  }
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
