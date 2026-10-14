// Verify all deployed casino contracts on Polygonscan via standard-json-input API
// Uses Remix's built-in fileManager API for reading files

(async function () {
  try {
    // ============================================================
    // Configuration
    // ============================================================
    const POLYGONSCAN_API_KEY = "6557EZETIUE788YEH43FVETKI481MFNAZR";
    const API_URL = "https://api.polygonscan.com/api";

    // CORS proxies — try direct fetch first, then allorigins as fallback
    const CORS_PROXIES = [
      (url) => url,  // Direct fetch (works if Polygonsan supports CORS)
      (url) => "https://api.allorigins.win/raw?url=" + encodeURIComponent(url)
    ];

    const DEPLOYER = "0x9fb4bb44d8d962d695fc93b3dc15f1b287391077";
    const MTX = "0xDCb51dE3359C946364F707556aC8e6C6f2e69A8a";

    // ============================================================
    // File reader using Remix fileManager
    // ============================================================
    async function readFile(path) {
      // Try multiple path variants — Remix fileManager can be picky about leading slashes
      const paths = [path, "/" + path, "./" + path];
      for (const p of paths) {
        try {
          return await remix.fileManager.readFile(p);
        } catch (e) {
          // Continue to next path variant
        }
      }
      throw new Error("Could not read file: " + path);
    }

    // ============================================================
    // Contracts to verify
    // ============================================================
    const CONTRACTS = [
      {
        name: "MatrixHubCoin",
        sourceName: "contracts/MatrixHubCoin.sol",
        address: "0xDCb51dE3359C946364F707556aC8e6C6f2e69A8a",
        constructorArgs: [
          { type: "uint256", value: "1000000000" },
          { type: "address", value: DEPLOYER }
        ],
        needsOpenZeppelin: true
      },
      {
        name: "CasinoReserve",
        sourceName: "contracts/CasinoReserve.sol",
        address: "0x70561ac30aedee7a09cb3840a1c7e441fd80195f",
        constructorArgs: [
          { type: "address", value: MTX },
          { type: "uint256", value: "1000000000000000000000000000" },
          { type: "address", value: "0x0000000000000000000000000000000000000000" }
        ],
        needsOpenZeppelin: true
      },
      {
        name: "RNGEngine",
        sourceName: "contracts/RNGEngine.sol",
        address: "0x53307e1db6c5cb6773c9495ca140372016dfe266",
        constructorArgs: [
          { type: "address", value: "0x0000000000000000000000000000000000000000" }
        ],
        needsOpenZeppelin: false
      },
      {
        name: "LiquidityRouter",
        sourceName: "contracts/LiquidityRouter.sol",
        address: "0x1d0787d70fc0d3111408c030e5c9de247dc0104b",
        constructorArgs: [
          { type: "address", value: MTX },
          { type: "address", value: DEPLOYER }
        ],
        needsOpenZeppelin: true
      },
      {
        name: "CasinoCore",
        sourceName: "contracts/CasinoCore.sol",
        address: "0x2fbee7a063dafc8adadfaa1c351796407454a1e0",
        constructorArgs: [
          { type: "address", value: MTX },
          { type: "address", value: "0x1d0787d70fc0d3111408c030e5c9de247dc0104b" },
          { type: "address", value: "0x70561ac30aedee7a09cb3840a1c7e441fd80195f" },
          { type: "address", value: "0x53307e1db6c5cb6773c9495ca140372016dfe266" },
          { type: "uint256", value: "1000000000000000" },
          { type: "uint256", value: "1000000000000000000000" },
          { type: "uint256", value: "10000000000000000000000" },
          { type: "address", value: DEPLOYER },
          { type: "address", value: DEPLOYER }
        ],
        needsOpenZeppelin: true
      }
    ];

    // ============================================================
    // ABI-encode constructor arguments
    // ============================================================
    function encodeConstructorArgs(args) {
      let encoded = "0x";
      for (const arg of args) {
        if (arg.type === "uint256" || arg.type === "uint8") {
          let hexVal = BigInt(arg.value).toString(16);
          encoded += hexVal.padStart(64, "0");
        } else if (arg.type === "address") {
          let hexAddr = arg.value.toLowerCase().replace(/^0x/, "");
          encoded += hexAddr.padStart(64, "0");
        } else {
          throw new Error("Unsupported type: " + arg.type);
        }
      }
      return encoded;
    }

    // ============================================================
    // OpenZeppelin source paths (Remix virtual paths)
    // ============================================================
    const OZ_SOURCES = {
      "@openzeppelin/contracts/token/ERC20/ERC20.sol": ".deps/npm/@openzeppelin/contracts/token/ERC20/ERC20.sol",
      "@openzeppelin/contracts/token/ERC20/IERC20.sol": ".deps/npm/@openzeppelin/contracts/token/ERC20/IERC20.sol",
      "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol": ".deps/npm/@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol",
      "@openzeppelin/contracts/access/Ownable.sol": ".deps/npm/@openzeppelin/contracts/access/Ownable.sol",
      "@openzeppelin/contracts/utils/Context.sol": ".deps/npm/@openzeppelin/contracts/utils/Context.sol",
      "@openzeppelin/contracts/interfaces/draft-IERC6093.sol": ".deps/npm/@openzeppelin/contracts/interfaces/draft-IERC6093.sol"
    };
    // Note: OZ paths map virtual import paths to Remix .deps/ paths for standard-json-input verification

    // ============================================================
    // Build sources for standard JSON input
    // ============================================================
    async function buildSources(contractFile, needsOZ) {
      const sources = {};
      // Add main contract
      sources[contractFile] = { content: await readFile(contractFile) };

      if (needsOZ) {
        for (const [virtualPath, realPath] of Object.entries(OZ_SOURCES)) {
          sources[virtualPath] = { content: await readFile(realPath) };
        }
      }

      return sources;
    }

    // ============================================================
    // Submit verification
    // ============================================================
    async function verifyContract(contract) {
      console.log("\n=== Verifying " + contract.name + " at " + contract.address + " ===");

      const constructorArgsEncoded = encodeConstructorArgs(contract.constructorArgs);
      console.log("Constructor args encoded:", constructorArgsEncoded);

      const sources = await buildSources(contract.sourceName, contract.needsOpenZeppelin);
      console.log("  Sources loaded:", Object.keys(sources).join(", "));

      // Build standard JSON input
      const standardInput = {
        language: "Solidity",
        sources: sources,
        settings: {
          optimizer: {
            enabled: true,
            runs: 200
          },
          evmVersion: "default",
          outputSelection: {
            "*": {
              "*": ["abi", "evm.bytecode", "evm.deployedBytecode"]
            }
          }
        }
      };

      const sourceCodeJson = JSON.stringify(standardInput);

      // Build API request body
      const body = new URLSearchParams();
      body.append("module", "contract");
      body.append("action", "verifysourcecode");
      body.append("apikey", POLYGONSCAN_API_KEY);
      body.append("codeformat", "solidity-standard-json-input");
      body.append("sourceCode", sourceCodeJson);
      body.append("contractname", contract.sourceName + ":" + contract.name);
      body.append("compilerversion", "v0.8.20+commit.a1b79de6");
      body.append("constructorArguements", constructorArgsEncoded);
      body.append("licenseType", "3"); // MIT

      console.log("Submitting to Polygonscan API...");

      let result = null;
      let proxyUsed = "";

      for (let pi = 0; pi < CORS_PROXIES.length; pi++) {
        const proxyUrl = CORS_PROXIES[pi](API_URL);
        try {
          const response = await fetch(proxyUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/x-www-form-urlencoded"
            },
            body: body.toString()
          });
          const text = await response.text();
          try {
            result = JSON.parse(text);
          } catch (e) {
            result = { status: "0", message: "Parse error", result: text.substring(0, 500) };
          }
          proxyUsed = pi === 0 ? "direct fetch" : "allorigins proxy";
          console.log("  Success with " + proxyUsed + " (POST)");
          break;
        } catch (e) {
          console.log("  Attempt " + (pi + 1) + " POST failed: " + e.message);
        }
      }

      if (!result) {
        throw new Error("All fetch attempts failed");
      }

      console.log("API Response:", JSON.stringify(result));

      if (result.status === "1" && result.message === "OK") {
        const guid = result.result;
        console.log("Verification GUID:", guid);
        console.log("Polling for verification status...");

        // Poll for status
        for (let i = 0; i < 15; i++) {
          await new Promise(resolve => setTimeout(resolve, 5000));

          const statusBody = new URLSearchParams();
          statusBody.append("module", "contract");
          statusBody.append("action", "checkverifystatus");
          statusBody.append("apikey", POLYGONSCAN_API_KEY);
          statusBody.append("guid", guid);

          let statusResult = null;

          for (let pi = 0; pi < CORS_PROXIES.length; pi++) {
            const proxyUrl = CORS_PROXIES[pi](API_URL);
            try {
              const statusResponse = await fetch(proxyUrl, {
                method: "POST",
                headers: {
                  "Content-Type": "application/x-www-form-urlencoded"
                },
                body: statusBody.toString()
              });
              const text = await statusResponse.text();
              try {
                statusResult = JSON.parse(text);
              } catch (e) {
                statusResult = null;
              }
              if (statusResult) break;
            } catch (e) {
              // continue to next proxy
            }
          }

          if (!statusResult) continue;
          console.log("  Poll " + (i + 1) + ": status=" + statusResult.status + " message=" + statusResult.message + " result=" + statusResult.result);

          if (statusResult.status === "1" && statusResult.message === "OK") {
            console.log("✅ " + contract.name + " verified successfully!");
            console.log("   https://polygonscan.com/address/" + contract.address + "#code");
            return { success: true, contract: contract.name };
          }

          if (statusResult.message === "Already Verified") {
            console.log("✅ " + contract.name + " was already verified!");
            return { success: true, contract: contract.name };
          }

          // Check for failure
          if (statusResult.result && typeof statusResult.result === "string" && statusResult.result.includes("Fail")) {
            console.log("❌ " + contract.name + " verification FAILED: " + statusResult.result);
            return { success: false, contract: contract.name, error: statusResult.result };
          }

          // Check for "Already Verified" in result string
          if (statusResult.result && typeof statusResult.result === "string" && statusResult.result.includes("Already Verified")) {
            console.log("✅ " + contract.name + " was already verified!");
            return { success: true, contract: contract.name };
          }
        }

        console.log("⏳ " + contract.name + " verification still pending after 75 seconds");
        return { success: false, contract: contract.name, error: "timeout" };
      } else {
        console.log("❌ " + contract.name + " submission failed: " + result.message + " - " + result.result);
        return { success: false, contract: contract.name, error: result.result };
      }
    }

    // ============================================================
    // Verify all contracts
    // ============================================================
    console.log("Starting Polygonscan verification for all casino contracts...\n");

    const results = [];
    for (const contract of CONTRACTS) {
      const result = await verifyContract(contract);
      results.push(result);
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    // ============================================================
    // Summary
    // ============================================================
    console.log("\n\n=== VERIFICATION SUMMARY ===");
    const succeeded = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);

    if (succeeded.length > 0) {
      console.log("\n✅ Verified:");
      succeeded.forEach(r => console.log("   - " + r.contract));
    }

    if (failed.length > 0) {
      console.log("\n❌ Failed:");
      failed.forEach(r => console.log("   - " + r.contract + ": " + (r.error || "unknown error")));
    }

    console.log("\n" + succeeded.length + "/" + results.length + " contracts verified.");

  } catch (error) {
    console.error("❌ Script error:", error.message);
    console.error(error.stack);
  }
})();
