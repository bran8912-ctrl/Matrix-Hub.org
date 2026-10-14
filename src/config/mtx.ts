// MTX Token Configuration for Polygon Mainnet and Amoy testnet
//
// The selected Polygon token is configured in contracts.js.
// Set MTX_CONTRACT_ADDRESS only to override it for a specific environment.
// Exchange Rate: 1 POL = 1,000 MTX (configured in contract)
// Initial Owner: 0x9fb4bb44d8d962d695fc93b3dc15f1b287391077

// Helper to safely retrieve environment variables across Node and browser/Vite contexts
import { DEPLOYED_CONTRACTS } from './contracts.js';

const getEnvVar = (name: string): string | undefined => {
  if (typeof process !== 'undefined' && process.env?.[name]) {
    return process.env[name];
  }
  if (typeof import.meta !== 'undefined' && (import.meta as any).env?.[name]) {
    return (import.meta as any).env[name];
  }
  return undefined;
};

const configuredChainId = Number(getEnvVar('CASINO_CHAIN_ID') || '137');
if (configuredChainId !== 137 && configuredChainId !== 80002) {
  throw new Error(`Unsupported CASINO_CHAIN_ID: ${configuredChainId}. Use 137 or 80002.`);
}
const isPolygonMainnet = configuredChainId === 137;
const rawContractAddress = getEnvVar('MTX_CONTRACT_ADDRESS') || getEnvVar('PUBLIC_MTX_CONTRACT_ADDRESS');
const contractAddress = (rawContractAddress && rawContractAddress.trim() !== '')
  ? rawContractAddress.trim()
  : isPolygonMainnet
    ? DEPLOYED_CONTRACTS.mtxToken
    : '0x0000000000000000000000000000000000000000';
const rpcUrl = isPolygonMainnet
  ? getEnvVar('POLYGON_RPC_URL')?.trim() || 'https://polygon.drpc.org'
  : getEnvVar('AMOY_RPC_URL')?.trim() || 'https://rpc-amoy.polygon.technology/';
const explorerUrl = isPolygonMainnet ? 'https://polygonscan.com/' : 'https://amoy.polygonscan.com/';

// Validate EVM address format
const isValidAddress = Boolean(contractAddress && contractAddress.match(/^0x[a-fA-F0-9]{40}$/));
const isPlaceholder = !contractAddress || /^0x0+$/.test(contractAddress);

if (isPlaceholder) {
  console.warn("⚠️  MTX: No Polygon token address is configured.");
}

export const MTX = {
  address: contractAddress,
  symbol: "MTX",
  decimals: 18,
  chainId: configuredChainId,
  chainName: isPolygonMainnet ? "Polygon" : "Polygon Amoy",
  name: "Matrix Hub Coin",
  maxSupply: 100_000_000, // 100M MTX hard cap
  // Fixed POL to MTX rate for direct mint: 1 POL = 1,000 MTX
  maticToMtxRate: 1000,
  nativeCurrency: {
    name: "POL",
    symbol: "POL",
    decimals: 18
  },
  rpcUrls: [rpcUrl],
  blockExplorerUrls: [explorerUrl],
  // Contract owner for verification and management
  owner: "0x9fb4bb44d8d962d695fc93b3dc15f1b287391077",
  isDeployed: isValidAddress && !isPlaceholder,
  get blockExplorerUrl() {
    return `${this.blockExplorerUrls[0]}address/${this.address}`;
  },
  get quickswapUrl() {
    // QuickSwap is the primary DEX on Polygon
    return `https://quickswap.exchange/#/swap?outputCurrency=${this.address}`;
  },
  get uniswapUrl() {
    // Alias for quickswapUrl — Polygon uses QuickSwap, but call sites reference uniswapUrl
    return this.quickswapUrl;
  }
};
