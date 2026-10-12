// Simple deploy script for KeccakHasher
(async () => {
  try {
    console.log("Script started");
    console.log("Checking for ethers...");
    if (typeof ethers !== 'undefined') {
      console.log("ethers is available, version:", ethers.version);
    }
    if (typeof web3 !== 'undefined') {
      console.log("web3 is available");
    }
    console.log("Done probing");
  } catch (err) {
    console.error("Error:", err);
  }
})();
