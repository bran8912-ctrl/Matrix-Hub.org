// MTX Token Configuration for Polygon Mainnet
// Network: Polygon Mainnet (Chain ID: 137)
//
// DEPLOYMENT STATUS: Contract must be deployed to get legitimate address
// Use: npm run deploy:polygon (production) or npm run deploy:amoy (testnet)
// 
// ⚠️ AFTER DEPLOYMENT: Update this file with the real contract address
// For production, set MTX_CONTRACT_ADDRESS in environment variables
// Exchange Rate: 1 MATIC = 1,000 MTX (configured in contract)
// Initial Owner: 0x9fb4bb44d8d962d695fc93b3dc15f1b287391077

// Helper to safely retrieve environment variables across Node and browser/Vite contexts
const getEnvVar = (name: string): string | undefined => {
  if (typeof process !== 'undefined' && process.env?.[name]) {
    return process.env[name];
  }
  if (typeof import.meta !== 'undefined' && (import.meta as any).env?.[name]) {
    return (import.meta as any).env[name];
  }
  return undefined;
};

// Get contract address from environment or use placeholder
const rawContractAddress = getEnvVar('MTX_CONTRACT_ADDRESS') || getEnvVar('PUBLIC_MTX_CONTRACT_ADDRESS');
const contractAddress = (rawContractAddress && rawContractAddress.trim() !== '')
  ? rawContractAddress.trim()
  : "0x0000000000000000000000000000000000000000"; // Placeholder - deploy contract to get real address

// Validate address format (supports 40-character hex addresses and 64-character contract IDs)
const isValidAddress = Boolean(contractAddress && contractAddress.match(/^0x([a-fA-F0-9]{40}|[a-fA-F0-9]{64})$/));
const isPlaceholder = !contractAddress || /^0x0+$/.test(contractAddress);

if (isPlaceholder) {
  console.warn("⚠️  MTX: Using placeholder address. Deploy contract to get legitimate address.");
  console.warn("    Run: npm run deploy:polygon or npm run deploy:amoy");
}

export const MTX = {
  address: contractAddress,
  symbol: "MTX",
  decimals: 18,
  chainId: 137, // Polygon Mainnet
  chainName: "Polygon",
  name: "Matrix Hub Coin",
  maxSupply: 100_000_000, // 100M MTX hard cap
  // Fixed MATIC to MTX rate for direct mint: 1 MATIC = 1,000 MTX
  maticToMtxRate: 1000,
  nativeCurrency: {
    name: "MATIC",
    symbol: "MATIC",
    decimals: 18
  },
  rpcUrls: ["https://polygon-rpc.com/"],
  blockExplorerUrls: ["https://polygonscan.com/"],
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
