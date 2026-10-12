/**
 * Find deployed contract addresses by computing CREATE addresses from nonces.
 * Uses ethers.js which is available in the Remix environment.
 */
const DEPLOYER = "0x9fb4bb44d8d962d695fc93b3dc15f1b287391077";

// keccak256(rlp([sender, nonce])) is the CREATE address formula
// We need to compute keccak256, which ethers can do

async function main() {
  // Get ethers from the Remix environment or from node_modules
  let ethers;
  try {
    ethers = require("ethers");
  } catch (e) {
    console.log("ethers not found via require, trying import...");
    try {
      const mod = await import("ethers");
      ethers = mod.ethers || mod;
    } catch (e2) {
      console.log("ethers not available:", e2.message);
      return;
    }
  }

  console.log("ethers version:", ethers.version);
  
  // Get the provider from the current environment
  let provider;
  
  // Try to use the Remix Web3 provider or window.ethereum
  if (typeof window !== "undefined" && window.ethereum) {
    provider = new ethers.BrowserProvider(window.ethereum);
  } else if (typeof web3 !== "undefined") {
    provider = new ethers.JsonRpcProvider(web3.currentProvider.host || web3.currentProvider.url);
  } else {
    // Try to use the Remix provider
    try {
      // Remix exposes the provider via the 'remix' global or 'web3' 
      console.log("Trying to find a provider...");
      
      // Check for Remix-specific globals
      if (typeof remix !== "undefined") {
        console.log("remix global found");
      }
      
      // Try common RPC endpoints for Polygon
      provider = new ethers.JsonRpcProvider("https://polygon-rpc.com", 137);
    } catch (e) {
      console.log("Could not create provider:", e.message);
      return;
    }
  }
  
  console.log("Provider created");
  
  // Step 1: Get the nonce (transaction count) of the deployer address
  const nonce = await provider.getTransactionCount(DEPLOYER, "latest");
  console.log(`\n=== Deployer: ${DEPLOYER} ===`);
  console.log(`Current nonce (transaction count): ${nonce}`);
  
  // Step 2: Compute CREATE addresses for nonces 0 through nonce-1
  console.log(`\nComputing CREATE addresses for nonces 0 through ${nonce - 1}...`);
  
  // RLP encode [sender, nonce] and compute keccak256
  function rlpEncodeAddress(sender, nonce) {
    // RLP encoding of [address, nonce]:
    // For nonce 0: 0xd6 0x94 <20-byte address> 0x80
    // For nonce 1-127: 0xd6 0x94 <20-byte address> <1-byte nonce>
    // For nonce 128-255: 0xd7 0x94 <20-byte address> 0x81 <1-byte nonce>
    // etc.
    
    const senderBytes = ethers.getBytes(sender);
    let encoded;
    
    if (nonce === 0) {
      // RLP of 0 is 0x80 (empty byte array)
      encoded = new Uint8Array(23);
      encoded[0] = 0xd6; // list prefix: 22 bytes of content
      encoded[1] = 0x94; // string prefix: 20 bytes
      encoded.set(senderBytes, 2);
      encoded[22] = 0x80; // RLP of 0
    } else if (nonce < 0x80) {
      // Single byte nonce (1-127)
      encoded = new Uint8Array(23);
      encoded[0] = 0xd6;
      encoded[1] = 0x94;
      encoded.set(senderBytes, 2);
      encoded[22] = nonce;
    } else if (nonce < 0x100) {
      // Two bytes for nonce encoding: 0x81 + nonce
      encoded = new Uint8Array(24);
      encoded[0] = 0xd7;
      encoded[1] = 0x94;
      encoded.set(senderBytes, 2);
      encoded[22] = 0x81;
      encoded[23] = nonce;
    } else if (nonce < 0x10000) {
      // Three bytes for nonce encoding: 0x82 + 2 bytes
      encoded = new Uint8Array(25);
      encoded[0] = 0xd8;
      encoded[1] = 0x94;
      encoded.set(senderBytes, 2);
      encoded[22] = 0x82;
      encoded[23] = (nonce >> 8) & 0xff;
      encoded[24] = nonce & 0xff;
    } else if (nonce < 0x1000000) {
      encoded = new Uint8Array(26);
      encoded[0] = 0xd9;
      encoded[1] = 0x94;
      encoded.set(senderBytes, 2);
      encoded[22] = 0x83;
      encoded[23] = (nonce >> 16) & 0xff;
      encoded[24] = (nonce >> 8) & 0xff;
      encoded[25] = nonce & 0xff;
    } else if (nonce < 0x100000000) {
      encoded = new Uint8Array(27);
      encoded[0] = 0xda;
      encoded[1] = 0x94;
      encoded.set(senderBytes, 2);
      encoded[22] = 0x84;
      encoded[23] = (nonce >> 24) & 0xff;
      encoded[24] = (nonce >> 16) & 0xff;
      encoded[25] = (nonce >> 8) & 0xff;
      encoded[26] = nonce & 0xff;
    } else {
      throw new Error("Nonce too large");
    }
    
    return encoded;
  }
  
  function computeCreateAddress(sender, nonce) {
    const rlpEncoded = rlpEncodeAddress(sender, nonce);
    const hash = ethers.keccak256(rlpEncoded);
    // Take the last 20 bytes of the hash
    const addressBytes = ethers.getBytes(hash).slice(12);
    return ethers.getAddress("0x" + ethers.hexlify(addressBytes).slice(2));
  }
  
  // Compute and check all addresses
  console.log("\n=== Computed CREATE Addresses ===\n");
  
  const contractNames = [
    "MatrixHubCoin",       // nonce 0 (from deploy_mtx.js)
    "RNGEngine",           // nonce 1 (from deploy_casino.js)  
    "CasinoReserve",       // nonce 2
    "LiquidityRouter",     // nonce 3
    "CasinoCore",          // nonce 4
    "setReserve() call",   // nonce 5
    "setRng() call",       // nonce 6
    "commitServerSeed() call", // nonce 7
  ];
  
  // Also check the Remix VM order
  const remixVmNames = [
    "MatrixHubCoin",       // nonce 0
    "LiquidityRouter",     // nonce 1
    "CasinoCore",          // nonce 2 (with placeholder addresses)
    "CasinoReserve",       // nonce 3
    "RNGEngine",           // nonce 4
    "setReserve() call",   // nonce 5
    "setRng() call",       // nonce 6
    "commitServerSeed() call", // nonce 7
    "setClientSeed() call",    // nonce 8
    "buyMTX() call",           // nonce 9
    "approve() call",          // nonce 10
    "transfer() call",         // nonce 11
  ];
  
  const results = [];
  const maxNonce = Math.max(nonce, 12);
  
  for (let i = 0; i < maxNonce; i++) {
    const addr = computeCreateAddress(DEPLOYER, i);
    let hasCode = false;
    let codeSize = 0;
    
    try {
      const code = await provider.getCode(addr);
      hasCode = code !== "0x" && code !== "0x0";
      codeSize = hasCode ? (ethers.getBytes(code).length) : 0;
    } catch (e) {
      console.log(`  Nonce ${i}: ${addr} - Error checking code: ${e.message}`);
    }
    
    const hardhatOrder = contractNames[i] || "(unknown)";
    const remixOrder = remixVmNames[i] || "(unknown)";
    
    const status = hasCode ? "✅ CONTRACT" : "❌ no code";
    
    console.log(`Nonce ${i}: ${addr} - ${status}`);
    console.log(`  Hardhat order: ${hardhatOrder}`);
    console.log(`  Remix VM order: ${remixOrder}`);
    console.log(`  Code size: ${codeSize} bytes`);
    console.log("");
    
    results.push({ nonce: i, address: addr, hasCode, codeSize, hardhatOrder, remixOrder });
  }
  
  // Summary
  console.log("\n=== Summary ===\n");
  const contracts = results.filter(r => r.hasCode);
  console.log(`Total nonces checked: ${results.length}`);
  console.log(`Contracts found: ${contracts.length}`);
  console.log("");
  
  contracts.forEach(c => {
    console.log(`Nonce ${c.nonce}: ${c.address} (${c.codeSize} bytes)`);
    console.log(`  Hardhat: ${c.hardhatOrder} | Remix VM: ${c.remixOrder}`);
  });
  
  return results;
}

main().then(() => console.log("\n✅ Done!")).catch(e => console.error("Error:", e));
