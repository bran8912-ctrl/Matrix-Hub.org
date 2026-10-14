import { Contract, JsonRpcProvider, formatUnits, isAddress } from 'ethers';
import { DEPLOYED_CONTRACTS } from '../src/config/contracts.js';

const POLYGON_RPCS = [
  process.env.POLYGON_RPC_URL,
  'https://polygon.drpc.org',
  'https://polygon-bor-rpc.publicnode.com',
].filter((rpc, index, all) => rpc && all.indexOf(rpc) === index);
const CHAIN_ID = 137;
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const MTX_ADDRESS = process.env.MTX_CONTRACT_ADDRESS
  || process.env.PUBLIC_MTX_CONTRACT_ADDRESS
  || DEPLOYED_CONTRACTS.mtxToken;
const CASINO_CORE_ADDRESS = process.env.CASINO_CORE_ADDRESS
  || process.env.PUBLIC_CASINO_CORE_ADDRESS
  || DEPLOYED_CONTRACTS.casinoCore;
const MTX_ABI = [
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function totalSupply() view returns (uint256)',
  'function MAX_SUPPLY() view returns (uint256)',
  'function owner() view returns (address)',
  'function mintingPaused() view returns (bool)',
];

async function connectToPolygon() {
  for (const rpc of POLYGON_RPCS) {
    const label = rpc === process.env.POLYGON_RPC_URL ? 'configured POLYGON_RPC_URL' : rpc;
    try {
      const provider = new JsonRpcProvider(rpc);
      const network = await provider.getNetwork();
      if (Number(network.chainId) !== CHAIN_ID) {
        throw new Error(`Expected Polygon chain ID ${CHAIN_ID}, received ${network.chainId}`);
      }
      const blockNumber = await provider.getBlockNumber();
      console.log(`Connected to Polygon mainnet at block ${blockNumber} using ${label}.`);
      return provider;
    } catch (error) {
      console.warn(`RPC ${label} failed: ${error.message}`);
    }
  }
  throw new Error('All configured Polygon RPC endpoints are unreachable or on the wrong network.');
}

async function checkDeployedContract(provider, name, address) {
  if (!isAddress(address) || address.toLowerCase() === ZERO_ADDRESS) {
    if (name === 'CasinoCore' && typeof address === 'string' && address.toLowerCase() === ZERO_ADDRESS) {
      console.warn(`${name} is not configured; casino checks are skipped.`);
      return;
    }
    throw new Error(`${name} address is missing or invalid: ${address}`);
  }

  const code = await provider.getCode(address);
  if (code === '0x') {
    throw new Error(`No contract bytecode found for ${name} at ${address}.`);
  }
  console.log(`${name} bytecode found at ${address}.`);
}

async function main() {
  const provider = await connectToPolygon();
  const feeData = await provider.getFeeData();
  console.log(`Current gas price: ${formatUnits(feeData.gasPrice ?? 0n, 'gwei')} gwei.`);

  await checkDeployedContract(provider, 'MTX', MTX_ADDRESS);
  const mtx = new Contract(MTX_ADDRESS, MTX_ABI, provider);
  const [name, symbol, decimals, supply, maxSupply, owner, mintingPaused] = await Promise.all([
    mtx.name(),
    mtx.symbol(),
    mtx.decimals(),
    mtx.totalSupply(),
    mtx.MAX_SUPPLY(),
    mtx.owner(),
    mtx.mintingPaused(),
  ]);

  if (name !== 'Matrix-HubCoin' || symbol !== 'MTX' || Number(decimals) !== 18) {
    throw new Error(`Unexpected MTX contract identity: ${name} (${symbol}), ${decimals} decimals.`);
  }
  console.log(`MTX identity confirmed: ${name} (${symbol}), ${decimals} decimals.`);
  console.log(`Supply: ${formatUnits(supply, decimals)} / ${formatUnits(maxSupply, decimals)} MTX.`);
  console.log(`Owner: ${owner}; direct minting ${mintingPaused ? 'paused' : 'enabled'}.`);

  await checkDeployedContract(provider, 'CasinoCore', CASINO_CORE_ADDRESS);
  console.log('Polygon live checks completed.');
}

main().catch((error) => {
  console.error('Polygon live check failed:', error.message);
  process.exitCode = 1;
});
