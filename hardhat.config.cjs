
require("dotenv/config");
require("@nomicfoundation/hardhat-toolbox");

module.exports = {
  solidity: {
    compilers: [
      {
        version: "0.8.20",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200
          }
        }
      },
      {
        version: "0.8.34",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200
          },
          evmVersion: "osaka"
        }
      }
    ],
    overrides: {
      "contracts/MatrixHubCoin.sol": {
        version: "0.8.34",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200
          },
          evmVersion: "osaka"
        }
      }
    }
  },
  networks: {
    // Polygon Mainnet - PRIMARY NETWORK
    polygon: {
      url: process.env.POLYGON_RPC_URL || "https://polygon.drpc.org",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 137,
      gasPrice: 50000000000 // 50 gwei - adjust based on network conditions
    },
    // Polygon Amoy Testnet (recommended for testing)
    amoy: {
      url: process.env.AMOY_RPC_URL || "https://rpc-amoy.polygon.technology/",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 80002
    },
    // Localhost for development
    localhost: {
      url: "http://127.0.0.1:8545",
      chainId: 31337
    }
  },
  etherscan: {
    apiKey: process.env.POLYGONSCAN_API_KEY || ""
  },
  // Validate Polygonscan API key is set for contract verification
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts"
  }
};
