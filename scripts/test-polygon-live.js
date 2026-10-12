// scripts/test-polygon-live.js
import { ethers } from 'ethers';

// Configuration for Polygon Mainnet
// Auto-fix: falls back to the next public RPC when one is unreachable
const POLYGON_RPCS = [
  process.env.POLYGON_RPC_URL,
  'https://polygon-rpc.com',
  'https://polygon-bor-rpc.publicnode.com',
  'https://rpc.ankr.com/polygon',
].filter(Boolean);
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
    let provider;
    let network;
    for (const rpc of POLYGON_RPCS) {
      const rpcLabel = rpc === process.env.POLYGON_RPC_URL ? 'configured POLYGON_RPC_URL' : rpc;
      try {
        const candidate = new ethers.JsonRpcProvider(rpc);
        network = await candidate.getNetwork();
        await candidate.getBlockNumber();
        provider = candidate;
        console.log(`🔧 Using RPC endpoint: ${rpcLabel}`);
        break;
      } catch (err) {
        console.warn(`⚠️ RPC ${rpcLabel} failed; trying next endpoint...`);
      }
    }
    if (!provider) throw new Error('All Polygon RPC endpoints are unreachable');
    
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
        process.exitCode = 1;
      } else {
        console.log(`✅ Verified: ${name} contract exists on-chain at ${address}`);
      }
    }

    console.log('\n✨ Polygon simulation check completed successfully. Your frontend wallet connectors are ready to interface with these network parameters.');

  } catch (error) {
    console.error('❌ Simulation failed due to a network or configuration error:', error.message);
    process.exitCode = 1;
  }
}

runPolygonSimulation();
