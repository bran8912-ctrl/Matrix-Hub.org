// Deploy MatrixHubCoin to Polygon Mainnet
(async () => {
  try {
    const maxSupply = "1000000000";
    const initialOwner = "0x9fb4bb44d8d962d695fc93b3dc15f1b287391077";

    console.log("Deploying MatrixHubCoin...");
    console.log("  maxSupply:", maxSupply);
    console.log("  initialOwner:", initialOwner);

    // Access the compiled contract from the artifacts
    // Remix script runner has access to the file system
    const fs = await import('fs');
    const path = await import('path');

    const artifactPath = '/artifacts/MatrixHubCoin.json';
    const artifactRaw = fs.readFileSync(artifactPath, 'utf8');
    const artifact = JSON.parse(artifactRaw);

    // The deployment bytecode
    const bytecode = artifact.data.bytecode.object;
    console.log("Bytecode length:", bytecode.length);

    // ABI-encode constructor args: (uint256 maxSupply, address initialOwner)
    // maxSupply = 1000000000 = 0x3B9ACA00
    // padded to 32 bytes: 000000000000000000000000000000000000000000000000000000003b9aca00
    // initialOwner padded to 32 bytes: 0000000000000000000000009fb4bb44d8d962d695fc93b3dc15f1b287391077
    const maxSupplyHex = BigInt(maxSupply).toString(16).padStart(64, '0');
    const ownerHex = initialOwner.slice(2).toLowerCase().padStart(64, '0');
    const constructorArgs = '0x' + maxSupplyHex + ownerHex;

    const deployData = '0x' + bytecode + constructorArgs.slice(2);
    console.log("Deploy data length:", deployData.length);
    console.log("Constructor args:", constructorArgs);

    // Get the web3/ethers provider from Remix
    const provider = await window.ethereum;
    
    // Use ethers from Remix
    const ethers = await import('ethers');
    
    // Try to use the injected provider
    let web3Provider;
    try {
      web3Provider = new ethers.BrowserProvider(window.ethereum);
    } catch(e) {
      console.log("BrowserProvider failed, trying alternative...");
    }

    console.log("Script completed - check deployment via Remix UI");
    console.log("Deploy data (first 200 chars):", deployData.substring(0, 200));
    console.log("Deploy data total hex chars:", deployData.length);
    
    return {
      deployData: deployData,
      bytecode: bytecode,
      constructorArgs: constructorArgs
    };
  } catch (error) {
    console.error("Error:", error);
    throw error;
  }
})();
