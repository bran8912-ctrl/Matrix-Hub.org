export const DEPLOYED_CONTRACTS = {
  network: "polygon",
  deployer: "0x9fb4bb44d8d962d695fc93b3dc15f1b287391077",

  // Core MTX token
  mtxToken: "0x53307e1db6c5cb6773c9495ca140372016dfe266",

  // Casino modules — DEPLOYED on Polygon mainnet 2026-11-10 via the owner
  // deploy console (all 17 steps done). Addresses verified on-chain by Grok
  // Nov 10 (all getters read back against the audited deploy params) and
  // the QuickSwap pair is live (1 POL + 1,000 MTX). NOTE: source NOT yet
  // verified on PolygonScan — Contract Auditor is verifying all four now.
  matrixHubCoin: "0x0000000000000000000000000000000000000000",
  casinoReserve: "0xA7A3F9D629B1a6942EF8434639Cb1c33010F55d5",
  rngEngine: "0x00DB079bAC7D62e04f5BEd1B4c771b959935116f",
  liquidityRouter: "0x887eBC888a184E57Fe8EfA2B2E8E66C58f53De04",
  casinoCore: "0x8a3dBD4BECcAAC89F818E7cB0246241c40938DcA",

  // Additional interface and governance layer
  // 2026-11-10: interfaces was an unused MatrixHubCoin copy (0xf924...), not an interfaces layer — reset to unset.
  interfaces: "0x0000000000000000000000000000000000000000"
};
