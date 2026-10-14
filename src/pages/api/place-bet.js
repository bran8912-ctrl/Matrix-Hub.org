// src/pages/api/place-bet.js
// Status route only. Wagers must be submitted by the player's connected wallet.

import { Casino } from "../../config/casino";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Check if casino is deployed
  if (!Casino.contracts.casinoCore.isDeployed) {
    return res.status(503).json({ 
      error: "Casino contract not deployed yet. Please deploy and validate contracts first."
    });
  }

  try {
    return res.status(200).json({ 
      status: "wallet-only",
      network: Casino.chainName,
      chainId: Casino.chainId,
      casinoCore: Casino.contracts.casinoCore.address,
      message: "This endpoint does not submit wagers. Use the connected-wallet Dice flow to request VRF settlement."
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
