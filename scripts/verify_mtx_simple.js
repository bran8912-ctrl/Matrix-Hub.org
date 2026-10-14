// Simplified Polygonscan verification - run in Remix
(async function () {
  const addr = "0xDCb51dE3359C946364F707556aC8e6C6f2e69A8a";
  const apiKey = "6557EZETIUE788YEH43FVETKI481MFNAZR";

  // Constructor args ABI-encoded
  const maxSupplyHex = BigInt(1000000000).toString(16).padStart(64, "0");
  const ownerHex = "9fb4bb44d8d962d695fc93b3dc15f1b287391077".padStart(64, "0");
  const ctorArgs = maxSupplyHex + ownerHex;

  const fs = require("fs");

  // Read all source files
  const sources = {};
  sources["contracts/MatrixHubCoin.sol"] = fs.readFileSync("/contracts/MatrixHubCoin.sol", "utf8");
  sources["@openzeppelin/contracts/access/Ownable.sol"] = fs.readFileSync("/.deps/npm/@openzeppelin/contracts/access/Ownable.sol", "utf8");
  sources["@openzeppelin/contracts/token/ERC20/ERC20.sol"] = fs.readFileSync("/.deps/npm/@openzeppelin/contracts/token/ERC20/ERC20.sol", "utf8");
  sources["@openzeppelin/contracts/utils/Context.sol"] = fs.readFileSync("/.deps/npm/@openzeppelin/contracts/utils/Context.sol", "utf8");
  sources["@openzeppelin/contracts/token/ERC20/IERC20.sol"] = fs.readFileSync("/.deps/npm/@openzeppelin/contracts/token/ERC20/IERC20.sol", "utf8");
  sources["@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol"] = fs.readFileSync("/.deps/npm/@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol", "utf8");
  sources["@openzeppelin/contracts/interfaces/draft-IERC6093.sol"] = fs.readFileSync("/.deps/npm/@openzeppelin/contracts/interfaces/draft-IERC6093.sol", "utf8");

  // Build standard JSON input
  const input = {
    language: "Solidity",
    sources: {},
    settings: {
      optimizer: { enabled: true, runs: 200 },
      evmVersion: "default",
      outputSelection: { "*": { "*": ["abi", "evm.bytecode", "evm.deployedBytecode"] } }
    }
  };
  for (const [path, content] of Object.entries(sources)) {
    input.sources[path] = { content };
  }

  const body = new URLSearchParams({
    module: "contract",
    action: "verifysourcecode",
    apikey: apiKey,
    contractaddress: addr,
    sourceCode: JSON.stringify(input),
    codeformat: "solidity-standard-json-input",
    contractname: "contracts/MatrixHubCoin.sol:MatrixHubCoin",
    compilerversion: "v0.8.20+commit.a1b79de6",
    optimizationUsed: "1",
    runs: "200",
    constructorArguements: ctorArgs,
    licenseType: "3"
  });

  console.log("Submitting to Polygonscan API...");
  const resp = await fetch("https://api.polygonscan.com/api", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString()
  });
  const data = await resp.json();
  console.log("Response:", JSON.stringify(data, null, 2));

  if (data.status === "1") {
    console.log("GUID:", data.result);
    // Poll for status
    for (let i = 0; i < 15; i++) {
      await new Promise(r => setTimeout(r, 5000));
      const sResp = await fetch(`https://api.polygonscan.com/api?module=contract&action=checkverifystatus&apikey=${apiKey}&guid=${data.result}`);
      const sData = await sResp.json();
      console.log(`Check ${i+1}:`, sData.result);
      if (sData.result === "Pass - Verified") {
        console.log("✅ Verified! https://polygonscan.com/address/" + addr + "#code");
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
