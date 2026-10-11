// scripts/test-mtx-and-wallets.js
import fs from 'fs';
import path from 'path';
import { ethers } from 'ethers';

// Configuration
const POLYGON_RPC = 'https://polygon-rpc.com';
const MTX_TOKEN_ADDRESS = process.env.MTX_TOKEN_ADDRESS || '0xYourMTXTokenContractHere'; 
const TEST_WALLET = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045'; // Vitalik's address as a safe read-only test target

// Standard ERC-20 ABI for balance checking
const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)"
];

async function auditWalletsAndMTX() {
  console.log('🤖 Matrix-Hub Bot: Auditing Wallet Buttons & MTX Token Logic...\n');

  // 1. Audit Astro files for wallet connection implementation
  const componentsDir = path.join('src');
  let walletButtonsFound = 0;

  const scanComponents = (dir) => {
    const files = readdirSafe(dir);
    files.forEach(file => {
      const fullPath = path.join(dir, file);
      if (fs.statSync(fullPath).isDirectory()) {
        scanComponents(fullPath);
      } else if (fullPath.endsWith('.astro') || fullPath.endsWith('.js') || fullPath.endsWith('.jsx')) {
        const content = fs.readFileSync(fullPath, 'utf8');
        if (content.includes('ethereum') || content.includes('wallet') || content.includes('connect')) {
          walletButtonsFound++;
        }
      }
    });
  };

  function readdirSafe(d) {
    try { return fs.readdirSync(d); } catch { return []; }
  }

  scanComponents(componentsDir);
  console.log(`🔍 Scan Result: Found ${walletButtonsFound} files with Web3/Wallet interaction hooks.`);

  // 2. Test MTX Token On-Chain Fetching Functionality
  console.log(`\n🧪 Testing MTX Token contract read-calls on Polygon...`);
  if (MTX_TOKEN_ADDRESS.includes('0xYour')) {
    console.log(`ℹ️ MTX Token Address is currently a placeholder. Update your environment variables or config to test live balances.`);
    return;
  }

  try {
    const provider = new ethers.JsonRpcProvider(POLYGON_RPC);
    const mtxContract = new ethers.Contract(MTX_TOKEN_ADDRESS, ERC20_ABI, provider);

    const symbol = await mtxContract.symbol();
    const decimals = await mtxContract.decimals();
    const rawBalance = await mtxContract.balanceOf(TEST_WALLET);
    const formattedBalance = ethers.formatUnits(rawBalance, decimals);

    console.log(`✅ MTX Contract Connection Successful!`);
    console.log(`   - Token Symbol: ${symbol}`);
    console.log(`   - Decimals: ${decimals}`);
    console.log(`   - Test Balance Read: ${formattedBalance} ${symbol}`);

  } catch (error) {
    console.error(`❌ MTX Contract Read Failed: ${error.message}`);
    console.log(`💡 Tip: Make sure your MTX contract is fully deployed on Polygon and the address is correct.`);
  }
}

auditWalletsAndMTX();
