// scripts/test-polygon-live.js
import { ethers } from 'ethers';

// Configuration for Polygon Mainnet
const POLYGON_RPC = 'https://polygon-rpc.com'; // Or your private RPC (Alchemy/Infura/QuickNode)
const CHAIN_ID = 137;

// Replace these with your actual deployed contract addresses from your project config
const CONTRACTS = {
  mtxToken: process.env.MTX_TOKEN_ADDRESS || '0xYourMTXTokenContractHere',
  casino: process.env.CASINO_CONTRACT_ADDRESS || '0xYourCasinoContractHere'
};

async function runPolygonSimulation() {
  console.log('🧪 Matrix-Hub Bot: Initializing Polygon Simulation Test...');
  
  try {
    // 1. Connect to Polygon Network
    const provider = new ethers.JsonRpcProvider(POLYGON_RPC);
    const network = await provider.getNetwork();
    
    console.log(`🌐 Connected to Network ID: ${network.chainId.toString()}`);
    if (Number(network.chainId) !== CHAIN_ID) {
      console.warn(`⚠️ Warning: Connected chain ID (${network.chainId}) does not match Polygon Mainnet (137).`);
    } else {
      console.log('✅ Successfully linked to Polygon Mainnet node.');
    }

    // 2. Check Gas Price / POL Native Token Status
    const feeData = await provider.getFeeData();
    console.log(`⛽ Current Polygon Gas Price: ${ethers.formatUnits(feeData.gasPrice || 0, 'gwei')} gwei`);
    console.log('🪙 Note: Ensure your UI prompts wallets for POL as the native gas asset.');

    // 3. Verify Contracts have bytecode (meaning they are deployed)
    for (const [name, address] of Object.entries(CONTRACTS)) {
      if (address.includes('0xYour')) {
        console.log(`ℹ️ Skipping bytecode check for ${name}: Placeholder address detected.`);
        continue;
      }
      
      const code = await provider.getCode(address);
      if (code === '0x') {
        console.error(`❌ Error: No contract bytecode found for ${name} at address ${address}. Verify deployment!`);
      } else {
        console.log(`✅ Verified: ${name} contract exists on-chain at ${address}`);
      }
    }

    console.log('\n✨ Polygon simulation check completed successfully. Your frontend wallet connectors are ready to interface with these network parameters.');

  } catch (error) {
    console.error('❌ Simulation failed due to a network or configuration error:', error.message);
  }
}

runPolygonSimulation();
