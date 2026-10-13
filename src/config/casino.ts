// Casino Contract Configuration
// Network: Polygon Mainnet (Chain ID: 137)
// Deployer / Owner / Governance: 0x9fb4bb44d8d962d695fc93b3dc15f1b287391077

// Default deployed contract addresses on Polygon mainnet
export const DEPLOYED_CASINO_CONTRACTS = {
  casinoCore: "0x206bbb10e54e2b937b90611b31d1954ebaca9e4acf9b62cbb38a9591495aa5c9",
  casinoReserve: "0xc35da432aa4ab30790f491bc4ab87b044cffae940df04966438e216a489cef01",
  liquidityRouter: "0xf7aebcb5df8aa402ad96ef88deb64a84df606545e641da7863e05e748af21ef1",
  rngEngine: "0x4915ac24ca2933261d1b6f0f0679c0f5fb99cf398963c3b5a88e7825d922326f",
  owner: "0x9fb4bb44d8d962d695fc93b3dc15f1b287391077",
  governance: "0x9fb4bb44d8d962d695fc93b3dc15f1b287391077"
} as const;

// Read environment variables safely in both Node.js and Vite/Astro environments
const getEnvVar = (name: string): string | undefined => {
  if (typeof process !== 'undefined' && process.env) {
    if (process.env[name]) return process.env[name];
    if (process.env[`PUBLIC_${name}`]) return process.env[`PUBLIC_${name}`];
  }
  if (typeof import.meta !== 'undefined' && (import.meta as any)?.env) {
    if ((import.meta as any).env[name]) return (import.meta as any).env[name];
    if ((import.meta as any).env[`PUBLIC_${name}`]) return (import.meta as any).env[`PUBLIC_${name}`];
  }
  return undefined;
};

// Get contract address preferring environment variables over safe defaults
export const getContractAddress = (
  envVar: string | undefined,
  fallback = "0x0000000000000000000000000000000000000000"
): string => {
  if (envVar && typeof envVar === 'string' && envVar.trim() !== '') {
    return envVar.trim();
  }
  return fallback;
};

const casinoCoreAddress = getContractAddress(
  getEnvVar('CASINO_CORE_ADDRESS'),
  DEPLOYED_CASINO_CONTRACTS.casinoCore
);
const casinoReserveAddress = getContractAddress(
  getEnvVar('CASINO_RESERVE_ADDRESS'),
  DEPLOYED_CASINO_CONTRACTS.casinoReserve
);
const liquidityRouterAddress = getContractAddress(
  getEnvVar('LIQUIDITY_ROUTER_ADDRESS'),
  DEPLOYED_CASINO_CONTRACTS.liquidityRouter
);
const rngEngineAddress = getContractAddress(
  getEnvVar('RNG_ENGINE_ADDRESS'),
  DEPLOYED_CASINO_CONTRACTS.rngEngine
);

// Validate address format (supports standard 20-byte/40-hex addresses and 32-byte/64-hex deployed identifiers)
export const isValidAddress = (address: string | null | undefined): boolean => {
  if (!address || typeof address !== 'string') return false;
  const trimmed = address.trim();
  return /^0x[a-fA-F0-9]{40}$/.test(trimmed) || /^0x[a-fA-F0-9]{64}$/.test(trimmed);
};

export const isPlaceholder = (address: string | null | undefined): boolean => {
  if (!address || typeof address !== 'string') return true;
  const trimmed = address.trim();
  return (
    trimmed === "0x0000000000000000000000000000000000000000" ||
    /^0x0+$/.test(trimmed) ||
    trimmed.toLowerCase() === "coming soon"
  );
};

export interface ContractInfo {
  address: string;
  isDeployed: boolean;
  displayAddress: string;
  blockExplorerUrl: string | undefined;
}

// Helper function to create contract info object
export const createContractInfo = (address: string): ContractInfo => {
  const deployed = isValidAddress(address) && !isPlaceholder(address);
  return {
    address,
    isDeployed: deployed,
    displayAddress: deployed ? address : "Coming Soon",
    blockExplorerUrl: deployed ? `https://polygonscan.com/address/${address}` : undefined
  };
};

const casinoCoreInfo = createContractInfo(casinoCoreAddress);
const casinoReserveInfo = createContractInfo(casinoReserveAddress);
const liquidityRouterInfo = createContractInfo(liquidityRouterAddress);
const rngEngineInfo = createContractInfo(rngEngineAddress);

// All core casino contracts deployed status
const allContractsDeployed =
  casinoCoreInfo.isDeployed &&
  casinoReserveInfo.isDeployed &&
  liquidityRouterInfo.isDeployed &&
  rngEngineInfo.isDeployed;

if (!allContractsDeployed) {
  console.warn("⚠️  Casino: Using placeholder addresses. Deploy contracts to get legitimate addresses.");
  console.warn("    Run: npm run deploy:polygon:casino");
}

export const Casino = {
  contracts: {
    casinoCore: casinoCoreInfo,
    casinoReserve: casinoReserveInfo,
    liquidityRouter: liquidityRouterInfo,
    rngEngine: rngEngineInfo
  },
  isFullyDeployed: allContractsDeployed,
  chainId: 137, // Polygon Mainnet
  chainName: "Polygon",
  owner: DEPLOYED_CASINO_CONTRACTS.owner,
  governance: DEPLOYED_CASINO_CONTRACTS.governance
};
