// Find deployed contract addresses from a deployer wallet by scanning nonces
// Uses the CREATE address formula: keccak256(rlp([sender, nonce])) -> last 20 bytes

const DEPLOYER = "0x9fb4bb44d8d962d695fc93b3dc15f1b287391077";

// ---- Minimal RLP encoding for [address, nonce] ----
function rlpEncodeAddress(addr: string): string {
  const clean = addr.toLowerCase().replace(/^0x/, '');
  return "94" + clean; // 0x94 prefix for 20-byte string
}

function rlpEncodeNonce(nonce: number): string {
  if (nonce === 0) return "80"; // empty string RLP
  let hex = nonce.toString(16);
  if (hex.length % 2 !== 0) hex = "0" + hex;
  const bytes = hex.length / 2;
  if (bytes === 1) {
    return hex; // single byte, < 0x80, just the byte
  }
  return (0x80 + bytes).toString(16) + hex; // string prefix + data
}

function rlpEncodeList(elements: string[]): string {
  const concatenated = elements.join('');
  const totalLen = concatenated.length / 2;
  let prefix: string;
  if (totalLen < 56) {
    prefix = (0xc0 + totalLen).toString(16);
    if (prefix.length % 2 !== 0) prefix = "0" + prefix;
  } else {
    const lenHex = totalLen.toString(16);
    const padded = lenHex.length % 2 !== 0 ? "0" + lenHex : lenHex;
    prefix = (0xf7 + padded.length / 2).toString(16) + padded;
  }
  return prefix + concatenated;
}

// ---- Main ----
async function main() {
  console.log("=== Deployed Contract Address Scanner ===");
  console.log("Deployer:", DEPLOYER);
  console.log("Network: Polygon Mainnet (Chain ID 137)\n");

  // Try to get ethers from Remix environment
  const ethers = (window as any).ethers || (global as any).ethers;
  console.log("ethers available:", !!ethers);

  // Try Web3
  const Web3 = (window as any).Web3 || (global as any).Web3;
  console.log("Web3 available:", !!Web3);

  // Get provider - try window.ethereum (WalletConnect injects this)
  const ethereum = (window as any).ethereum;
  console.log("window.ethereum available:", !!ethereum);

  // RPC call helper
  async function rpcCall(method: string, params: any[]): Promise<any> {
    if (ethereum) {
      return await ethereum.request({ method, params });
    }
    throw new Error("No provider available for RPC calls");
  }

  // Get nonce
  const nonceHex = await rpcCall("eth_getTransactionCount", [DEPLOYER, "latest"]);
  const currentNonce = parseInt(nonceHex, 16);
  console.log("Current transaction count (nonce):", currentNonce);
  console.log("Scanning nonces 0 through", currentNonce - 1, "\n");

  // Keccak256 helper
  let keccak256Fn: (data: string) => string;
  if (ethers && ethers.utils && ethers.utils.keccak256) {
    keccak256Fn = ethers.utils.keccak256;
    console.log("Using ethers.utils.keccak256\n");
  } else if (ethers && ethers.keccak256) {
    keccak256Fn = ethers.keccak256;
    console.log("Using ethers.keccak256\n");
  } else if (Web3) {
    const web3 = new Web3(ethereum);
    keccak256Fn = (data: string) => web3.utils.sha3(data) as string;
    console.log("Using web3.utils.sha3\n");
  } else {
    throw new Error("No keccak256 implementation available");
  }

  // Compute CREATE address
  function computeCreateAddress(sender: string, nonce: number): string {
    const encodedAddr = rlpEncodeAddress(sender);
    const encodedNonce = rlpEncodeNonce(nonce);
    const encodedList = rlpEncodeList([encodedAddr, encodedNonce]);
    const hash = keccak256Fn("0x" + encodedList);
    return "0x" + hash.slice(-40);
  }

  const found: Array<{nonce: number, address: string, codeBytes: number}> = [];

  for (let nonce = 0; nonce < currentNonce; nonce++) {
    let addr: string;
    try {
      addr = computeCreateAddress(DEPLOYER, nonce);
    } catch (e: any) {
      console.log(`Nonce ${nonce}: computeCreateAddress failed: ${e.message}`);
      continue;
    }

    let code: string;
    try {
      code = await rpcCall("eth_getCode", [addr, "latest"]);
    } catch (e: any) {
      console.log(`Nonce ${nonce}: ${addr} — getCode failed: ${e.message}`);
      continue;
    }

    const hasCode = code && code !== "0x" && code !== "0x0" && code.length > 2;
    const codeBytes = hasCode ? (code.length - 2) / 2 : 0;

    if (hasCode) {
      found.push({ nonce, address: addr, codeBytes });
      console.log(`Nonce ${nonce}: ${addr}  ✅ CONTRACT FOUND (${codeBytes} bytes of code)`);
    } else {
      console.log(`Nonce ${nonce}: ${addr}  — no code (EOA or external tx)`);
    }
  }

  console.log("\n=== Summary ===");
  console.log("Total nonces scanned:", currentNonce);
  console.log("Contracts found:", found.length);
  for (const c of found) {
    console.log(`  Nonce ${c.nonce}: ${c.address} (${c.codeBytes} bytes)`);
  }
}

main().then(() => {
  console.log("\nDone.");
}).catch((err: any) => {
  console.error("Script error:", err.message || err);
  console.error(err);
});
