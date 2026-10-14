// Verify MatrixHubCoin on Polygonscan via standard-json-input API
(async function () {
  const contractAddress = "0xDCb51dE3359C946364F707556aC8e6C6f2e69A8a";
  const apiKey = "6557EZETIUE788YEH43FVETKI481MFNAZR";

  const maxSupply = 1000000000;
  const initialOwner = "0x9fb4bb44d8d962d695fc93b3dc15f1b287391077";

  const fs = require("fs");

  // Read all source files
  const sourceCode = fs.readFileSync("/contracts/MatrixHubCoin.sol", "utf8");
  const ownableSource = fs.readFileSync("/.deps/npm/@openzeppelin/contracts/access/Ownable.sol", "utf8");
  const erc20Source = fs.readFileSync("/.deps/npm/@openzeppelin/contracts/token/ERC20/ERC20.sol", "utf8");
  const contextSource = fs.readFileSync("/.deps/npm/@openzeppelin/contracts/utils/Context.sol", "utf8");
  const ierc20Source = fs.readFileSync("/.deps/npm/@openzeppelin/contracts/token/ERC20/IERC20.sol", "utf8");
  const ierc20MetadataSource = fs.readFileSync("/.deps/npm/@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol", "utf8");
  const draftErc6093Source = fs.readFileSync("/.deps/npm/@openzeppelin/contracts/interfaces/draft-IERC6093.sol", "utf8");

  // ABI-encode constructor args manually: uint256 + address (each 32 bytes)
  const maxSupplyHex = BigInt(maxSupply).toString(16).padStart(64, "0");
  const ownerHex = initialOwner.slice(2).toLowerCase().padStart(64, "0");
  const constructorArgsEncoded = maxSupplyHex + ownerHex;

  console.log("Contract address:", contractAddress);
  console.log("Constructor args encoded:", constructorArgsEncoded);

  // Build the standard JSON input
  const standardInput = {
    language: "Solidity",
    sources: {
      "contracts/MatrixHubCoin.sol": { content: sourceCode },
      "@openzeppelin/contracts/access/Ownable.sol": { content: ownableSource },
      "@openzeppelin/contracts/token/ERC20/ERC20.sol": { content: erc20Source },
      "@openzeppelin/contracts/utils/Context.sol": { content: contextSource },
      "@openzeppelin/contracts/token/ERC20/IERC20.sol": { content: ierc20Source },
      "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol": { content: ierc20MetadataSource },
      "@openzeppelin/contracts/interfaces/draft-IERC6093.sol": { content: draftErc6093Source }
    },
    settings: {
      optimizer: { enabled: true, runs: 200 },
      evmVersion: "default",
      outputSelection: { "*": { "*": ["abi", "evm.bytecode", "evm.deployedBytecode"] } }
    }
  };

  const sourceCodeJson = JSON.stringify(standardInput);

  const params = new URLSearchParams({
    module: "contract",
    action: "verifysourcecode",
    apikey: apiKey,
    contractaddress: contractAddress,
    sourceCode: sourceCodeJson,
    codeformat: "solidity-standard-json-input",
    contractname: "contracts/MatrixHubCoin.sol:MatrixHubCoin",
    compilerversion: "v0.8.20+commit.a1b79de6",
    optimizationUsed: "1",
    runs: "200",
    constructorArguements: constructorArgsEncoded,
    licenseType: "3"
  });

  console.log("\nSubmitting verification to Polygonscan...");
  const resp = await fetch("https://api.polygonscan.com/api", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString()
  });
  const data = await resp.json();
  console.log("Response:", JSON.stringify(data, null, 2));

  if (data.status === "1") {
    console.log("GUID:", data.result);
    for (let i = 0; i < 15; i++) {
      await new Promise(r => setTimeout(r, 5000));
      const sResp = await fetch(`https://api.polygonscan.com/api?module=contract&action=checkverifystatus&apikey=${apiKey}&guid=${data.result}`);
      const sData = await sResp.json();
      console.log(`Check ${i+1}:`, sData.result);
      if (sData.result === "Pass - Verified") {
        console.log("✅ Verified! https://polygonscan.com/address/" + contractAddress + "#code");
        break;
      }
      if (sData.result && sData.result.startsWith("Fail")) {
        console.log("❌ Failed:", sData.result);
        break;
      }
      if (sData.result === "Already Verified") {
        console.log("✅ Already verified!");
        break;
      }
    }
  } else {
    console.log("❌ Submission failed:", data.message, data.result);
  }
})();
