// Find deployed contracts on Polygon Mainnet from deployer's nonces
// Computes CREATE addresses: keccak256(rlp([sender, nonce]))

const DEPLOYER = "0x9fb4bb44d8d962d695fc93b3dc15f1b287391077";

(async () => {
  try {
    // Try to get ethers from node_modules
    let ethers;
    try {
      ethers = require("ethers");
    } catch (e) {
      console.log("ethers not available, trying alternative...");
      // Try using the remix module
      const remix = require("remix");
      console.log("Got remix module");
    }

    // If ethers is available, use it
    if (ethers) {
      console.log("ethers version:", ethers.version || "unknown");

      // Connect to Polygon mainnet via the Remix provider
      // We'll use the WebSocket/HTTP provider from Remix
      const provider = new ethers.JsonRpcProvider("https://polygon-rpc.com");

      // Get the nonce (transaction count) of the deployer
      const nonce = await provider.getTransactionCount(DEPLOYER);
      console.log(`\nDeployer: ${DEPLOYER}`);
      console.log(`Current nonce (transaction count): ${nonce}`);
      console.log(`Checking nonces 0 through ${nonce - 1}...`);
      console.log("");

      // Compute CREATE addresses for nonces 0 to nonce-1
      const results = [];

      for (let i = 0; i < nonce; i++) {
        // Compute the CREATE address
        // RLP encoding: [sender, nonce]
        // For nonce 0: 0xd6 0x94 <20 bytes> 0x80
        // For nonce 1-127: 0xd6 0x94 <20 bytes> <nonce byte>
        // For nonce 128-255: 0xd7 0x94 <20 bytes> 0x81 <nonce byte>

        let rlpEncoded;
        if (i === 0) {
          rlpEncoded = "0xd694" + DEPLOYER.slice(2) + "80";
        } else if (i < 0x80) {
          rlpEncoded = "0xd694" + DEPLOYER.slice(2) + i.toString(16).padStart(2, "0");
        } else if (i < 0x100) {
          rlpEncoded = "0xd794" + DEPLOYER.slice(2) + "81" + i.toString(16).padStart(2, "0");
        } else if (i < 0x10000) {
          rlpEncoded = "0xd894" + DEPLOYER.slice(2) + "82" + i.toString(16).padStart(4, "0");
        } else {
          rlpEncoded = "0xd994" + DEPLOYER.slice(2) + "83" + i.toString(16).padStart(6, "0");
        }

        // Compute keccak256
        const hash = ethers.keccak256(rlpEncoded);
        // Take last 20 bytes (40 hex chars) as the address
        const address = "0x" + hash.slice(26);

        // Check if there's code at this address
        const code = await provider.getCode(address);

        const hasCode = code !== "0x";
        const codeSize = hasCode ? (code.length - 2) / 2 : 0;

        results.push({
          nonce: i,
          address: address,
          hasCode: hasCode,
          codeSize: codeSize,
        });

        console.log(`Nonce ${i}: ${address} | Code: ${hasCode ? "YES (" + codeSize + " bytes)" : "NO"}`);
      }

      console.log("\n=== Summary ===");
      console.log(`Total nonces checked: ${nonce}`);
      const contractAddresses = results.filter(r => r.hasCode);
      console.log(`Contracts found (addresses with code): ${contractAddresses.length}`);
      console.log("");

      contractAddresses.forEach((r, idx) => {
        console.log(`Contract ${idx + 1}: Nonce ${r.nonce} -> ${r.address} (${r.codeSize} bytes)`);
      });

      // Try to identify contracts by calling common functions
      console.log("\n=== Attempting to identify contracts ===");

      const contractNames = [
        "MatrixHubCoin", "RNGEngine", "CasinoReserve",
        "LiquidityRouter", "CasinoCore"
      ];

      for (const r of contractAddresses) {
        console.log(`\nAddress ${r.address} (nonce ${r.nonce}, ${r.codeSize} bytes):`);

        // Try calling name() - selector: 0x06fdde03
        try {
          const nameResult = await provider.call({
            to: r.address,
            data: "0x06fdde03"
          });
          if (nameResult && nameResult !== "0x") {
            try {
              const decoded = ethers.AbiCoder.defaultAbiCoder.decode(["string"], nameResult);
              console.log(`  name(): "${decoded[0]}"`);
            } catch (e) {
              console.log(`  name(): raw=${nameResult.slice(0, 66)}...`);
            }
          }
        } catch (e) {
          console.log(`  name(): not available`);
        }

        // Try calling symbol() - selector: 0x95d89b41
        try {
          const symbolResult = await provider.call({
            to: r.address,
            data: "0x95d89b41"
          });
          if (symbolResult && symbolResult !== "0x") {
            try {
              const decoded = ethers.AbiCoder.defaultAbiCoder.decode(["string"], symbolResult);
              console.log(`  symbol(): "${decoded[0]}"`);
            } catch (e) {
              console.log(`  symbol(): raw=${symbolResult.slice(0, 66)}...`);
            }
          }
        } catch (e) {
          console.log(`  symbol(): not available`);
        }

        // Try calling totalSupply() - selector: 0x18160ddd
        try {
          const tsResult = await provider.call({
            to: r.address,
            data: "0x18160ddd"
          });
          if (tsResult && tsResult !== "0x") {
            try {
              const decoded = ethers.AbiCoder.defaultAbiCoder.decode(["uint256"], tsResult);
              console.log(`  totalSupply(): ${decoded[0].toString()}`);
            } catch (e) {
              console.log(`  totalSupply(): raw=${tsResult.slice(0, 66)}...`);
            }
          }
        } catch (e) {
          console.log(`  totalSupply(): not available`);
        }

        // Try calling owner() - selector: 0x8da5cb5b
        try {
          const ownerResult = await provider.call({
            to: r.address,
            data: "0x8da5cb5b"
          });
          if (ownerResult && ownerResult !== "0x") {
            try {
              const decoded = ethers.AbiCoder.defaultAbiCoder.decode(["address"], ownerResult);
              console.log(`  owner(): ${decoded[0]}`);
            } catch (e) {
              console.log(`  owner(): raw=${ownerResult.slice(0, 66)}...`);
            }
          }
        } catch (e) {
          console.log(`  owner(): not available`);
        }

        // Try calling casinoCore() - selector computed from "casinoCore()"
        try {
          const casinoCoreSelector = ethers.id("casinoCore()").slice(0, 10);
          const ccResult = await provider.call({
            to: r.address,
            data: casinoCoreSelector
          });
          if (ccResult && ccResult !== "0x") {
            try {
              const decoded = ethers.AbiCoder.defaultAbiCoder.decode(["address"], ccResult);
              console.log(`  casinoCore(): ${decoded[0]}`);
            } catch (e) {
              console.log(`  casinoCore(): raw=${ccResult.slice(0, 66)}...`);
            }
          }
        } catch (e) {
          console.log(`  casinoCore(): not available`);
        }

        // Try calling rng() - selector from "rng()"
        try {
          const rngSelector = ethers.id("rng()").slice(0, 10);
          const rngResult = await provider.call({
            to: r.address,
            data: rngSelector
          });
          if (rngResult && rngResult !== "0x") {
            try {
              const decoded = ethers.AbiCoder.defaultAbiCoder.decode(["address"], rngResult);
              console.log(`  rng(): ${decoded[0]}`);
            } catch (e) {
              console.log(`  rng(): raw=${rngResult.slice(0, 66)}...`);
            }
          }
        } catch (e) {
          console.log(`  rng(): not available`);
        }

        // Try calling reserve() - selector from "reserve()"
        try {
          const reserveSelector = ethers.id("reserve()").slice(0, 10);
          const reserveResult = await provider.call({
            to: r.address,
            data: reserveSelector
          });
          if (reserveResult && reserveResult !== "0x") {
            try {
              const decoded = ethers.AbiCoder.defaultAbiCoder.decode(["address"], reserveResult);
              console.log(`  reserve(): ${decoded[0]}`);
            } catch (e) {
              console.log(`  reserve(): raw=${reserveResult.slice(0, 66)}...`);
            }
          }
        } catch (e) {
          console.log(`  reserve(): not available`);
        }

        // Try calling serverSeedHash() - selector from "serverSeedHash()"
        try {
          const sshSelector = ethers.id("serverSeedHash()").slice(0, 10);
          const sshResult = await provider.call({
            to: r.address,
            data: sshSelector
          });
          if (sshResult && sshResult !== "0x") {
            console.log(`  serverSeedHash(): ${sshResult}`);
          }
        } catch (e) {
          console.log(`  serverSeedHash(): not available`);
        }

        // Try calling paused() - selector from "paused()"
        try {
          const pausedSelector = ethers.id("paused()").slice(0, 10);
          const pausedResult = await provider.call({
            to: r.address,
            data: pausedSelector
          });
          if (pausedResult && pausedResult !== "0x") {
            try {
              const decoded = ethers.AbiCoder.defaultAbiCoder.decode(["bool"], pausedResult);
              console.log(`  paused(): ${decoded[0]}`);
            } catch (e) {
              console.log(`  paused(): raw=${pausedResult.slice(0, 66)}...`);
            }
          }
        } catch (e) {
          console.log(`  paused(): not available`);
        }
      }

      console.log("\n=== Done ===");
    }
  } catch (error) {
    console.error("Error:", error.message || error);
    if (error.stack) console.error(error.stack);
  }
})();
