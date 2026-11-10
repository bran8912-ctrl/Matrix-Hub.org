export const DEPLOYED_CONTRACTS = {
  network: "polygon",
  deployer: "0x9fb4bb44d8d962d695fc93b3dc15f1b287391077",

  // Core MTX token
  mtxToken: "0x53307e1db6c5cb6773c9495ca140372016dfe266",

  // Casino modules stay unset until deployed with the Chainlink VRF flow.
  // 2026-11-10: matrixHubCoin was a SafeProxy multisig (0x7Ee4...), NOT MatrixHubCoin — reset to unset.
  matrixHubCoin: "0x0000000000000000000000000000000000000000",
  casinoReserve: "0x0000000000000000000000000000000000000000",
  rngEngine: "0x0000000000000000000000000000000000000000",
  liquidityRouter: "0x0000000000000000000000000000000000000000",
  casinoCore: "0x0000000000000000000000000000000000000000",

  // Additional interface and governance layer
  // 2026-11-10: interfaces was an unused MatrixHubCoin copy (0xf924...), not an interfaces layer — reset to unset.
  interfaces: "0x0000000000000000000000000000000000000000"
};
