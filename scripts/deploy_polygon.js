// Deploy all casino contracts to Polygon Mainnet via Remix injected provider
// Run with: remix.exe currentfile, or use run_script in Remix

(async function () {
  try {
    const accounts = await web3.eth.getAccounts();
    console.log("Available accounts:", accounts);
    const deployer = accounts[0];
    console.log("Deployer:", deployer);
    console.log("Balance:", web3.utils.fromWei(await web3.eth.getBalance(deployer), "ether"), "POL");
    console.log("Chain ID:", await web3.eth.getChainId());
    console.log("Gas price:", web3.utils.fromWei(await web3.eth.getGasPrice(), "gwei"), "gwei");

    const owner = deployer;
    const results = {};

    // ============================================================
    // Step 1: Deploy MatrixHubCoin
    // constructor(uint256 maxSupply, address initialOwner)
    // ============================================================
    console.log("\n=== Step 1: Deploying MatrixHubCoin ===");
    const mtxAbi = [{"inputs":[{"internalType":"uint256","name":"maxSupply","type":"uint256"},{"internalType":"address","name":"initialOwner","type":"address"}],"stateMutability":"nonpayable","type":"constructor"}];
    // Read bytecode from artifacts
    const fs = require("fs");
    const mtxArtifact = JSON.parse(fs.readFileSync("/artifacts/MatrixHubCoin.json", "utf8"));
    const MTX = new web3.eth.Contract(mtxArtifact.abi);
    console.log("Deploying MatrixHubCoin with maxSupply=1000000000, owner=", owner);
    const mtxInstance = await MTX.deploy({
      data: mtxArtifact.bytecode,
      arguments: [1000000000, owner]
    }).send({
      from: deployer,
      gas: 3000000
    });
    results.MatrixHubCoin = mtxInstance.options.address;
    console.log("✅ MatrixHubCoin deployed at:", results.MatrixHubCoin);

    // ============================================================
    // Step 2: Deploy CasinoReserve
    // constructor(address _mtx, uint256 _reserveCap, address _casinoCore)
    // casinoCore = address(0) for now, set later
    // ============================================================
    console.log("\n=== Step 2: Deploying CasinoReserve ===");
    const reserveArtifact = JSON.parse(fs.readFileSync("/artifacts/CasinoReserve.json", "utf8"));
    const reserveCap = "1000000000000000000000000000"; // 1 billion MTX with 18 decimals
    const Reserve = new web3.eth.Contract(reserveArtifact.abi);
    const reserveInstance = await Reserve.deploy({
      data: reserveArtifact.bytecode,
      arguments: [results.MatrixHubCoin, reserveCap, "0x0000000000000000000000000000000000000000"]
    }).send({
      from: deployer,
      gas: 2000000
    });
    results.CasinoReserve = reserveInstance.options.address;
    console.log("✅ CasinoReserve deployed at:", results.CasinoReserve);

    // ============================================================
    // Step 3: Deploy RNGEngine
    // constructor(address _casinoCore) — casinoCore = address(0) for now
    // ============================================================
    console.log("\n=== Step 3: Deploying RNGEngine ===");
    const rngArtifact = JSON.parse(fs.readFileSync("/artifacts/RNGEngine.json", "utf8"));
    const RNG = new web3.eth.Contract(rngArtifact.abi);
    const rngInstance = await RNG.deploy({
      data: rngArtifact.bytecode,
      arguments: ["0x0000000000000000000000000000000000000000"]
    }).send({
      from: deployer,
      gas: 2000000
    });
    results.RNGEngine = rngInstance.options.address;
    console.log("✅ RNGEngine deployed at:", results.RNGEngine);

    // ============================================================
    // Step 4: Deploy LiquidityRouter
    // constructor(address _mtx, address _dexPool)
    // dexPool = deployer for now (can be updated later)
    // ============================================================
    console.log("\n=== Step 4: Deploying LiquidityRouter ===");
    const liqArtifact = JSON.parse(fs.readFileSync("/artifacts/LiquidityRouter.json", "utf8"));
    const LiqRouter = new web3.eth.Contract(liqArtifact.abi);
    const liqInstance = await LiqRouter.deploy({
      data: liqArtifact.bytecode,
      arguments: [results.MatrixHubCoin, deployer] // deployer as temp DEX pool
    }).send({
      from: deployer,
      gas: 1000000
    });
    results.LiquidityRouter = liqInstance.options.address;
    console.log("✅ LiquidityRouter deployed at:", results.LiquidityRouter);

    // ============================================================
    // Step 5: Deploy CasinoCore
    // constructor(address _mtx, address _liquidity, address _reserve, address _rng,
    //   uint256 _minBet, uint256 _maxBet, uint256 _maxPayoutPerBet, address _dev, address _governance)
    // ============================================================
    console.log("\n=== Step 5: Deploying CasinoCore ===");
    const coreArtifact = JSON.parse(fs.readFileSync("/artifacts/CasinoCore.json", "utf8"));
    const minBet = "1000000000000000"; // 0.001 MTX
    const maxBet = "1000000000000000000000"; // 1000 MTX
    const maxPayoutPerBet = "10000000000000000000000"; // 10000 MTX
    const CasinoCore = new web3.eth.Contract(coreArtifact.abi);
    const coreInstance = await CasinoCore.deploy({
      data: coreArtifact.bytecode,
      arguments: [
        results.MatrixHubCoin,
        results.LiquidityRouter,
        results.CasinoReserve,
        results.RNGEngine,
        minBet,
        maxBet,
        maxPayoutPerBet,
        deployer, // dev
        deployer  // governance
      ]
    }).send({
      from: deployer,
      gas: 3000000
    });
    results.CasinoCore = coreInstance.options.address;
    console.log("✅ CasinoCore deployed at:", results.CasinoCore);

    // ============================================================
    // Step 6: Link — setCasinoCore on CasinoReserve
    // ============================================================
    console.log("\n=== Step 6: Linking CasinoReserve → CasinoCore ===");
    await reserveInstance.methods.setCasinoCore(results.CasinoCore).send({
      from: deployer,
      gas: 100000
    });
    console.log("✅ CasinoReserve.setCasinoCore() called");

    // ============================================================
    // Step 7: Link — setCasinoCore on RNGEngine
    // ============================================================
    console.log("\n=== Step 7: Linking RNGEngine → CasinoCore ===");
    await rngInstance.methods.setCasinoCore(results.CasinoCore).send({
      from: deployer,
      gas: 100000
    });
    console.log("✅ RNGEngine.setCasinoCore() called");

    // ============================================================
    // Done — Save deployment info
    // ============================================================
    console.log("\n=== DEPLOYMENT COMPLETE ===");
    console.log("All contracts deployed and linked on Polygon Mainnet (chain 137):");
    console.log(JSON.stringify(results, null, 2));

    // Save to file
    const deploymentData = {
      network: "polygon",
      chainId: 137,
      deployer: deployer,
      timestamp: new Date().toISOString(),
      contracts: {
        MatrixHubCoin: results.MatrixHubCoin,
        CasinoReserve: results.CasinoReserve,
        RNGEngine: results.RNGEngine,
        LiquidityRouter: results.LiquidityRouter,
        CasinoCore: results.CasinoCore
      }
    };
    fs.writeFileSync("/deployments/casino-polygon.json", JSON.stringify(deploymentData, null, 2));
    console.log("Deployment saved to /deployments/casino-polygon.json");

    return results;
  } catch (error) {
    console.error("❌ Deployment failed:", error.message);
    if (error.receipt) {
      console.error("Transaction receipt:", JSON.stringify(error.receipt, null, 2));
    }
    throw error;
  }
})();
