// Casino Contract Configuration
// Network: Polygon Mainnet (Chain ID: 137)
// Deployer / Owner / Governance: 0x9fb4bb44d8d962d695fc93b3dc15f1b287391077

// Deployed Polygon Mainnet contract addresses (safe defaults)
export const DEPLOYED_CASINO_CONTRACTS = {
  casinoCore: "0x206bbb10e54e2b937b90611b31d1954ebaca9e4acf9b62cbb38a9591495aa5c9",
  casinoReserve: "0xc35da432aa4ab30790f491bc4ab87b044cffae940df04966438e216a489cef01",
  liquidityRouter: "0xf7aebcb5df8aa402ad96ef88deb64a84df606545e641da7863e05e748af21ef1",
  rngEngine: "0x4915ac24ca2933261d1b6f0f0679c0f5fb99cf398963c3b5a88e7825d922326f",
  owner: "0x9fb4bb44d8d962d695fc93b3dc15f1b287391077",
  governance: "0x9fb4bb44d8d962d695fc93b3dc15f1b287391077",
};

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

// Get contract addresses from environment or use deployed defaults
const getContractAddress = (envVarName: string, fallback: string): string => {
  const val = getEnvVar(envVarName) || getEnvVar(`PUBLIC_${envVarName}`);
  return (val && val.trim() !== '') ? val.trim() : fallback;
};

const casinoCoreAddress = getContractAddress('CASINO_CORE_ADDRESS', DEPLOYED_CASINO_CONTRACTS.casinoCore);
const casinoReserveAddress = getContractAddress('CASINO_RESERVE_ADDRESS', DEPLOYED_CASINO_CONTRACTS.casinoReserve);
const liquidityRouterAddress = getContractAddress('LIQUIDITY_ROUTER_ADDRESS', DEPLOYED_CASINO_CONTRACTS.liquidityRouter);
const rngEngineAddress = getContractAddress('RNG_ENGINE_ADDRESS', DEPLOYED_CASINO_CONTRACTS.rngEngine);

// Validate address format (supports 40-character hex addresses and 64-character contract IDs/hashes)
const isValidAddress = (address: string | null | undefined): boolean => {
  if (!address || typeof address !== 'string') return false;
  return /^0x([a-fA-F0-9]{40}|[a-fA-F0-9]{64})$/.test(address);
};

const isPlaceholder = (address: string): boolean => {
  return !address || /^0x0+$/.test(address);
};

// Helper function to create contract info object
const createContractInfo = (address: string) => ({
  address,
  isDeployed: isValidAddress(address) && !isPlaceholder(address),
  displayAddress: (isValidAddress(address) && !isPlaceholder(address)) ? address : "Coming Soon"
});

// Check deployment status
const casinoCoreDeployed = isValidAddress(casinoCoreAddress) && !isPlaceholder(casinoCoreAddress);
const casinoReserveDeployed = isValidAddress(casinoReserveAddress) && !isPlaceholder(casinoReserveAddress);
const liquidityRouterDeployed = isValidAddress(liquidityRouterAddress) && !isPlaceholder(liquidityRouterAddress);
const rngEngineDeployed = isValidAddress(rngEngineAddress) && !isPlaceholder(rngEngineAddress);
const allContractsDeployed = casinoCoreDeployed && casinoReserveDeployed && liquidityRouterDeployed && rngEngineDeployed;

if (!allContractsDeployed) {
  console.warn("⚠️  Casino: Using placeholder addresses. Deploy contracts to get legitimate addresses.");
  console.warn("    Run: npm run deploy:polygon:casino");
}

export const Casino = {
  contracts: {
    casinoCore: createContractInfo(casinoCoreAddress),
    casinoReserve: createContractInfo(casinoReserveAddress),
    liquidityRouter: createContractInfo(liquidityRouterAddress),
    rngEngine: createContractInfo(rngEngineAddress)
  },
  owner: DEPLOYED_CASINO_CONTRACTS.owner,
  governance: DEPLOYED_CASINO_CONTRACTS.governance,
  isFullyDeployed: allContractsDeployed,
  chainId: 137, // Polygon Mainnet
  chainName: "Polygon"
};
