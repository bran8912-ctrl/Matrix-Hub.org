// Verify MatrixHubCoin on Polygonscan via standard-json-input API
// This replicates /scripts/verify_mtx.js but uses CommonJS require for fs

(async function () {
  const contractAddress = "0xDCb51dE3359C946364F707556aC8e6C6f2e69A8a";
  const apiKey = "6557EZETIUE788YEH43FVETKI481MFNAZR";

  const maxSupply = 1000000000;
  const initialOwner = "0x9fb4bb44d8d962d695fc93b3dc15f1b287391077";

  const fs = require("fs");
  let sourceCode;
  try {
    sourceCode = fs.readFileSync("/contracts/MatrixHubCoin.sol", "utf8");
  } catch (e) {
    console.log("Error reading source:", e.message);
    return;
  }

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

  const compilerVersion = "v0.8.20+commit.a1b79de6";
  const optimizerEnabled = true;
  const optimizerRuns = 200;

  // ABI-encode constructor args manually: uint256 + address (each 32 bytes)
  const maxSupplyHex = BigInt(maxSupply).toString(16).padStart(64, "0");
  const ownerHex = initialOwner.slice(2).toLowerCase().padStart(64, "0");
  let constructorArgsEncoded;
  if (typeof web3 !== "undefined") {
    constructorArgsEncoded = web3.eth.abi.encodeParameters(["uint256", "address"], [maxSupply, initialOwner]);
  } else {
    constructorArgsEncoded = "0x" + maxSupplyHex + ownerHex;
  }

  console.log("Contract address:", contractAddress);
  console.log("Constructor args encoded:", constructorArgsEncoded);
  console.log("Source code length:", sourceCode.length);

  const standardInput = {
    language: "Solidity",
    sources: {
      "MatrixHubCoin.sol": { content: sourceCode },
      "@openzeppelin/contracts/access/Ownable.sol": { content: ownableSource },
      "@openzeppelin/contracts/token/ERC20/ERC20.sol": { content: erc20Source },
      "@openzeppelin/contracts/utils/Context.sol": { content: contextSource },
      "@openzeppelin/contracts/token/ERC20/IERC20.sol": { content: ierc20Source },
      "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol": { content: ierc20MetadataSource },
      "@openzeppelin/contracts/interfaces/draft-IERC6093.sol": { content: draftErc6093Source }
    },
    settings: {
      optimizer: { enabled: optimizerEnabled, runs: optimizerRuns },
      evmVersion: "default",
      outputSelection: { "*": { "*": ["abi", "evm.bytecode", "evm.deployedBytecode"] } }
    }
  };

  const standardInputJson = JSON.stringify(standardInput);

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
    constructorArguements: constructorArgsEncoded.slice(2),
    licenseType: "3"
  });

  console.log("\nSubmitting verification to Polygonscan...");
  console.log("API URL: https://api.polygonscan.com/api");

  try {
    const response = await fetch("https://api.polygonscan.com/api", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString()
    });

    const result = await response.json();
    console.log("\n=== Verification Submission Response ===");
    console.log(JSON.stringify(result, null, 2));

    if (result.status === "1" || (result.message && result.message.includes("OK"))) {
      console.log("\n✅ Verification submitted successfully!");
      console.log("GUID:", result.result);
      console.log("\nChecking verification status...");

      let attempts = 0;
      const maxAttempts = 10;
      const guid = result.result;

      while (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 5000));

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
