// Simple deploy script for KeccakHasher
(async () => {
  try {
    console.log("Script started");
    console.log("Available globals:", Object.keys(globalThis).filter(k => k.includes('remix') || k.includes('ethers') || k.includes('web3')));
  } catch (err) {
    console.error("Error:", err);
  }
})();
