// src/pages/api/place-bet.js
// API route to interact with CasinoCore contract for placing a bet

import { Casino } from "../../config/casino";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Check if casino is deployed
  if (!Casino.contracts.casinoCore.isDeployed) {
    return res.status(503).json({ 
      error: "Casino contract not deployed yet. Please deploy contracts first.",
      deploymentGuide: "/docs/DEPLOYMENT_QUICK_START.md"
    });
  }

  try {
    return res.status(200).json({ 
      status: "deployed",
      network: "Polygon Mainnet",
      chainId: Casino.chainId,
      casinoCore: Casino.contracts.casinoCore.address,
      message: "Casino contracts are deployed. Client-side wallet interaction enabled."
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
