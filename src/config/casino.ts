// Casino Contract Configuration
// Network: Polygon Mainnet (Chain ID: 137)
// Deployer / Owner / Governance: 0x9fb4bb44d8d962d695fc93b3dc15f1b287391077

import { DEPLOYED_CONTRACTS } from './contracts.js';

// Default deployed contract addresses on Polygon mainnet
export const DEPLOYED_CASINO_CONTRACTS = {
  casinoCore: DEPLOYED_CONTRACTS.casinoCore,
  casinoReserve: DEPLOYED_CONTRACTS.casinoReserve,
  liquidityRouter: DEPLOYED_CONTRACTS.liquidityRouter,
  rngEngine: DEPLOYED_CONTRACTS.rngEngine,
  owner: DEPLOYED_CONTRACTS.deployer,
  governance: DEPLOYED_CONTRACTS.deployer
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

const configuredChainId = Number(getEnvVar('CASINO_CHAIN_ID') || '137');
if (configuredChainId !== 137 && configuredChainId !== 80002) {
  throw new Error(`Unsupported CASINO_CHAIN_ID: ${configuredChainId}. Use 137 or 80002.`);
}
const casinoChainId = configuredChainId;
const explorerBase = casinoChainId === 80002
  ? 'https://amoy.polygonscan.com/address/'
  : 'https://polygonscan.com/address/';

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
    blockExplorerUrl: deployed ? `${explorerBase}${address}` : undefined
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
  console.warn("⚠️  Casino: Required modules are unavailable or unvalidated; casino features are disabled.");
}

export const Casino = {
  contracts: {
    casinoCore: casinoCoreInfo,
    casinoReserve: casinoReserveInfo,
    liquidityRouter: liquidityRouterInfo,
    rngEngine: rngEngineInfo
  },
  isFullyDeployed: allContractsDeployed,
  chainId: casinoChainId,
  chainName: casinoChainId === 80002 ? "Polygon Amoy" : "Polygon",
  owner: DEPLOYED_CASINO_CONTRACTS.owner,
  governance: DEPLOYED_CASINO_CONTRACTS.governance
};
