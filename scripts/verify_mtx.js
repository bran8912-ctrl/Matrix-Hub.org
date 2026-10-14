// Verify MatrixHubCoin on Polygonscan via API
// Run in Remix script runner

(async function () {
  const contractAddress = "0xDCb51dE3359C946364F707556aC8e6C6f2e69A8a";
  const apiKey = "6557EZETIUE788YEH43FVETKI481MFNAZR";

  // Constructor args: uint256 maxSupply = 1000000000, address initialOwner = 0x9fb4bb44d8d962d695fc93b3dc15f1b287391077
  // ABI-encode the constructor args for verification
  const maxSupply = 1000000000;
  const initialOwner = "0x9fb4bb44d8d962d695fc93b3dc15f1b287391077";

  // Read the contract source
  const fs = require("fs");
  let sourceCode;
  try {
    sourceCode = fs.readFileSync("/contracts/MatrixHubCoin.sol", "utf8");
  } catch (e) {
    console.log("Error reading source:", e.message);
    return;
  }

  // Read all imported dependencies
  let ownableSource, erc20Source, contextSource, ierc20Source, ierc20MetadataSource, draftErc6093Source;
  try {
    ownableSource = fs.readFileSync("/.deps/npm/@openzeppelin/contracts/access/Ownable.sol", "utf8");
    erc20Source = fs.readFileSync("/.deps/npm/@openzeppelin/contracts/token/ERC20/ERC20.sol", "utf8");
    contextSource = fs.readFileSync("/.deps/npm/@openzeppelin/contracts/utils/Context.sol", "utf8");
    ierc20Source = fs.readFileSync("/.deps/npm/@openzeppelin/contracts/token/ERC20/IERC20.sol", "utf8");
    ierc20MetadataSource = fs.readFileSync("/.deps/npm/@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol", "utf8");
    draftErc6093Source = fs.readFileSync("/.deps/npm/@openzeppelin/contracts/interfaces/draft-IERC6093.sol", "utf8");
  } catch (e) {
    console.log("Error reading dependency:", e.message);
  }

  // Build the source tree for standard JSON input
  // We'll use the Polygonscan API to submit verification
  const compilerVersion = "v0.8.20+commit.a1b79de6"; // Match hardhat config
  const optimizerEnabled = true;
  const optimizerRuns = 200;

  // ABI-encode constructor args manually
  // uint256 maxSupply (32 bytes, left-padded)
  const maxSupplyHex = BigInt(maxSupply).toString(16).padStart(64, "0");
  // address initialOwner (32 bytes, left-padded)
  const ownerHex = initialOwner.slice(2).toLowerCase().padStart(64, "0");
  const constructorArgTypes = ["uint256", "address"];

  // Use web3 to ABI-encode
  const web3Available = typeof web3 !== "undefined";
  let constructorArgsEncoded;
  if (web3Available) {
    constructorArgsEncoded = web3.eth.abi.encodeParameters(constructorArgTypes, [maxSupply, initialOwner]);
  } else {
    // Manual encoding: each param is 32 bytes
    constructorArgsEncoded = "0x" + maxSupplyHex + ownerHex;
  }

  console.log("Contract address:", contractAddress);
  console.log("Constructor args encoded:", constructorArgsEncoded);
  console.log("Source code length:", sourceCode.length);

  // Build the standard JSON input for Etherscan verification
  // Etherscan API endpoint for Polygon: https://api.polygonscan.com/api

  // We need to construct standard JSON input for multi-file (standard-json-input) verification
  const standardInput = {
    language: "Solidity",
    sources: {
      "MatrixHubCoin.sol": {
        content: sourceCode
      },
      "@openzeppelin/contracts/access/Ownable.sol": {
        content: ownableSource
      },
      "@openzeppelin/contracts/token/ERC20/ERC20.sol": {
        content: erc20Source
      },
      "@openzeppelin/contracts/utils/Context.sol": {
        content: contextSource
      },
      "@openzeppelin/contracts/token/ERC20/IERC20.sol": {
        content: ierc20Source
      },
      "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol": {
        content: ierc20MetadataSource
      },
      "@openzeppelin/contracts/interfaces/draft-IERC6093.sol": {
        content: draftErc6093Source
      }
    },
    settings: {
      optimizer: {
        enabled: optimizerEnabled,
        runs: optimizerRuns
      },
      evmVersion: "default",
      outputSelection: {
        "*": {
          "*": ["abi", "evm.bytecode", "evm.deployedBytecode"]
        }
      }
    }
  };

  const standardInputJson = JSON.stringify(standardInput);

  // Step 1: Submit verification request
  const params = new URLSearchParams({
    module: "contract",
    action: "verifysourcecode",
    apikey: apiKey,
    contractaddress: contractAddress,
    sourceCode: standardInputJson,
    codeformat: "solidity-standard-json-input",
    contractname: "MatrixHubCoin.sol:MatrixHubCoin",
    compilerversion: compilerVersion,
    optimizationUsed: optimizerEnabled ? "1" : "0",
    runs: String(optimizerRuns),
    constructorArguements: constructorArgsEncoded.slice(2), // remove 0x prefix
    licenseType: "3" // MIT
  });

  console.log("\nSubmitting verification to Polygonscan...");
  console.log("API URL: https://api.polygonscan.com/api");

  try {
    const response = await fetch("https://api.polygonscan.com/api", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: params.toString()
    });

    const result = await response.json();
    console.log("\n=== Verification Submission Response ===");
    console.log(JSON.stringify(result, null, 2));

    if (result.status === "1" || (result.message && result.message.includes("OK"))) {
      console.log("\n✅ Verification submitted successfully!");
      console.log("GUID:", result.result);
      console.log("\nChecking verification status...");

      // Step 2: Poll for verification status
      let attempts = 0;
      const maxAttempts = 10;
      const guid = result.result;

      while (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 5000)); // wait 5 seconds

        const statusParams = new URLSearchParams({
          module: "contract",
          action: "checkverifystatus",
          apikey: apiKey,
          guid: guid
        });

        const statusResponse = await fetch(`https://api.polygonscan.com/api?${statusParams.toString()}`);
        const statusResult = await statusResponse.json();
        attempts++;

        console.log(`\nAttempt ${attempts}: ${statusResult.message} - ${statusResult.result}`);

        if (statusResult.result === "Already Verified") {
          console.log("✅ Contract is already verified!");
          break;
        }
        if (statusResult.status === "1" && statusResult.result === "Pass - Verified") {
          console.log("✅ Contract verified successfully!");
          console.log(`View at: https://polygonscan.com/address/${contractAddress}#code`);
          break;
        }
        if (statusResult.result && statusResult.result.startsWith("Fail")) {
          console.log("❌ Verification failed:", statusResult.result);
          break;
        }
      }
    } else {
      console.log("\n❌ Verification submission failed:");
      console.log(result);
    }
  } catch (error) {
    console.log("Error during verification:", error.message);
    if (error.stack) {
      console.log(error.stack);
    }
  }
})();
