# Casino Contracts Deployment Guide

This guide walks you through deploying the Matrix-Hub casino contracts step by step.

## Prerequisites Checklist

Before deploying, ensure you have:

- [ ] Node.js v18.14+ installed
- [ ] npm dependencies installed (`npm install`)
- [ ] Deployer wallet with private key
- [ ] Sufficient POL in deployer wallet for gas
- [ ] RPC endpoint URL (Alchemy, Infura, or public)
- [ ] Polygonscan API key (optional, for verification)
- [ ] MTX token already deployed

## Step 1: Environment Setup

### 1.1 Create `.env` File

```bash
cp .env.example .env
```

### 1.2 Edit `.env` with Your Values

```env
# Your deployer wallet private key (without 0x prefix)
# ⚠️ Use a burner wallet, NOT your main wallet!
PRIVATE_KEY=your_64_character_hex_private_key_here

# RPC endpoints
MAINNET_RPC_URL=https://eth-mainnet.g.alchemy.com/v2/YOUR_ALCHEMY_KEY
AMOY_RPC_URL=https://rpc-amoy.polygon.technology/

# Polygonscan API key for contract verification
ETHERSCAN_API_KEY=YOUR_ETHERSCAN_API_KEY
```

### 1.3 Verify Environment

```bash
# Check that .env is not tracked by git
git status .env
# Should show: ".env" is in .gitignore

# Verify deployer wallet has funds
# For Amoy: Visit https://amoy.polygonscan.com/address/YOUR_DEPLOYER_ADDRESS
# For Mainnet: Visit https://polygonscan.com/address/YOUR_DEPLOYER_ADDRESS
```

## Step 2: Deploy MTX Token First

The casino contracts require the MTX token to be deployed first.

### 2.1 Deploy to Amoy (Testnet)

```bash
npx hardhat run scripts/deploy_mtx.js --network amoy
```

**Expected Output:**
```
✅ MatrixHubCoin deployed to: 0x...
📄 Deployment info saved to: deployments/mtx-amoy.json
```

### 2.2 Verify MTX Deployment

```bash
# Check the deployment file was created
cat deployments/mtx-amoy.json

# Verify on Polygonscan
npx hardhat verify --network amoy <MTX_ADDRESS> "100000000" "0x9fb4bb44d8d962d695fc93b3dc15f1b287391077"
```

## Step 3: Deploy Casino Contracts

### 3.1 Review Deployment Configuration

Edit `scripts/deploy_casino.js` if you want to customize parameters:

```javascript
const DEPLOYMENT_CONFIG = {
  reserveCap: "1000000",  // 1M MTX reserve cap
  minBet: "1",            // 1 MTX minimum bet
  maxBet: "1000",         // 1000 MTX maximum bet
  devAddress: null,       // null = use deployer
  governanceAddress: null, // null = use deployer
  tempDexPool: null,      // null = use deployer
};
```

### 3.2 Deploy to Amoy

```bash
npx hardhat run scripts/deploy_casino.js --network amoy
```

**Expected Output:**
```
╔════════════════════════════════════════════════════════════════╗
║       Casino Contracts Deployment - Matrix-Hub Platform       ║
╚════════════════════════════════════════════════════════════════╝

📡 Network Information:
   Network: amoy
   Chain ID: 80002

👤 Deployer Account:
   Address: 0x...
   Balance: 0.5 MATIC

📋 Loading MTX Token Information...
   MTX Token Address: 0x...

⚙️  Preparing Constructor Arguments...
   Reserve Cap: 1000000 MTX
   Min Bet: 1 MTX
   Max Bet: 1000 MTX
   Dev Address: 0x...
   Governance Address: 0x...

🎰 Starting Casino Contracts Deployment...

1️⃣  RNGEngine
🔨 Deploying RNGEngine...
✅ RNGEngine deployed successfully
   Address: 0x...

2️⃣  CasinoReserve
🔨 Deploying CasinoReserve...
✅ CasinoReserve deployed successfully
   Address: 0x...
   ⚠️  CasinoCore address is temporary (deployer)
   ⚠️  Update after deployment using CasinoReserve contract

3️⃣  LiquidityRouter
🔨 Deploying LiquidityRouter...
✅ LiquidityRouter deployed successfully
   Address: 0x...
   ⚠️  DEX pool address is temporary (deployer)
   ⚠️  Update after creating QuickSwap MTX/ETH pool

4️⃣  CasinoCore
🔨 Deploying CasinoCore...
✅ CasinoCore deployed successfully
   Address: 0x...

╔════════════════════════════════════════════════════════════════╗
║                    ✅ DEPLOYMENT SUCCESSFUL                     ║
╚════════════════════════════════════════════════════════════════╝

💾 Preparing Deployment Information...

📄 Deployment info saved successfully
   File: /path/to/deployments/casino-amoy.json

╔════════════════════════════════════════════════════════════════╗
║                   📋 POST-DEPLOYMENT STEPS                      ║
╚════════════════════════════════════════════════════════════════╝

[... post-deployment instructions ...]
```

### 3.3 Verify Deployment

```bash
# Check deployment file
cat deployments/casino-amoy.json

# Verify it contains all contract addresses
jq '.contracts' deployments/casino-amoy.json
```

## Step 4: Verify Contracts on Polygonscan

Verify each contract for transparency:

```bash
# RNGEngine (no constructor args)
npx hardhat verify --network amoy <RNG_ADDRESS>

# CasinoReserve
npx hardhat verify --network amoy <RESERVE_ADDRESS> \
  "<MTX_ADDRESS>" "<RESERVE_CAP>" "<TEMP_CASINO_CORE>"

# LiquidityRouter
npx hardhat verify --network amoy <LIQUIDITY_ADDRESS> \
  "<MTX_ADDRESS>" "<TEMP_DEX_POOL>"

# CasinoCore
npx hardhat verify --network amoy <CASINO_CORE_ADDRESS> \
  "<MTX_ADDRESS>" "<LIQUIDITY_ADDRESS>" "<RESERVE_ADDRESS>" "<RNG_ADDRESS>" \
  "<MIN_BET>" "<MAX_BET>" "<DEV_ADDRESS>" "<GOVERNANCE_ADDRESS>"
```

**Note:** The exact verification commands are printed by the deployment script.

## Step 5: Post-Deployment Configuration

### 5.1 Update CasinoReserve

The CasinoReserve was deployed with a temporary casinoCore address. Update it:

1. Option A: Redeploy CasinoReserve with correct address
2. Option B: If contract has a setter function, call it on-chain

### 5.2 Create QuickSwap Pool

Create a liquidity pool for MTX/ETH:

1. Visit https://app.quickswap.exchange/
2. Connect your wallet
3. Go to "Pool" > "New Position"
4. Select MTX and ETH
5. Set price range and add liquidity
6. Note the pool contract address
7. Update LiquidityRouter with pool address

### 5.3 Fund CasinoReserve

Transfer MTX tokens to the reserve:

```bash
# Using Polygonscan or cast
cast send <MTX_ADDRESS> \
  "transfer(address,uint256)" \
  <RESERVE_ADDRESS> \
  100000000000000000000000 \
  --rpc-url $AMOY_RPC_URL \
  --private-key $PRIVATE_KEY
```

Recommended: 100,000+ MTX for initial liquidity

## Step 6: Frontend Integration

### 6.1 Update Environment Variables

Add to `.env`:

```env
PUBLIC_CASINO_CORE_ADDRESS=0x...
PUBLIC_CASINO_RESERVE_ADDRESS=0x...
PUBLIC_LIQUIDITY_ROUTER_ADDRESS=0x...
PUBLIC_RNG_ENGINE_ADDRESS=0x...
PUBLIC_NETWORK=sepolia
```

### 6.2 Import Deployment Data

In your Astro components:

```typescript
import casinoDeployment from '../../deployments/casino-amoy.json';

const {
  casinoCore,
  casinoReserve,
  liquidityRouter,
  rngEngine
} = casinoDeployment.contracts;
```

### 6.3 Update Contract Interactions

Update any files that interact with casino contracts:
- `src/pages/api/place-bet.js`
- `src/components/casino/*.tsx`
- Any other casino-related files

## Step 7: Testing

### 7.1 Test on Amoy

Before mainnet deployment, thoroughly test:

- [ ] Connect wallet to Amoy
- [ ] Verify contract addresses are correct
- [ ] Test placing bets
- [ ] Test winning payouts
- [ ] Test liquidity routing
- [ ] Test reserve balance
- [ ] Test governance functions
- [ ] Test dev fee collection

### 7.2 Monitor Gas Costs

Track gas costs during testing:

```bash
# Check latest transactions
npx hardhat run scripts/check_gas_usage.js --network amoy
```

## Step 8: Mainnet Deployment (Production)

⚠️ **ONLY after thorough Amoy testing!**

### 8.1 Final Checklist

- [ ] All Amoy tests passed
- [ ] Smart contracts audited (recommended)
- [ ] Gas optimizations completed
- [ ] Security review completed
- [ ] Deployer wallet funded (0.5+ ETH recommended)
- [ ] Team approval obtained
- [ ] Rollback plan prepared

### 8.2 Deploy to Mainnet

```bash
# Deploy MTX (if not already deployed)
npx hardhat run scripts/deploy_mtx.js --network mainnet

# Deploy Casino
npx hardhat run scripts/deploy_casino.js --network mainnet
```

### 8.3 Verify Mainnet Deployment

```bash
# Verify contracts
npx hardhat verify --network mainnet <CONTRACT_ADDRESSES>

# Check deployment file
cat deployments/casino-mainnet.json

# View on Polygonscan
open https://polygonscan.com/address/<CASINO_CORE_ADDRESS>
```

## Troubleshooting

### "MTX token not deployed"
**Solution:** Deploy MTX first using `deploy_mtx.js`

### "Insufficient funds"
**Solution:** Add ETH to deployer wallet. Check balance on Polygonscan.

### "Deployment failed"
**Solution:** Check RPC URL, network connectivity, and error message.

### "Verification failed"
**Solution:** 
- Wait 1-2 minutes after deployment
- Verify Polygonscan API key is valid
- Check constructor args match exactly

### "Transaction underpriced"
**Solution:** Increase gas price in hardhat.config.cjs or wait for lower gas

## Support

For issues:
1. Check deployment script output for detailed error messages
2. Review `scripts/README.md` for additional documentation
3. Check Hardhat docs: https://hardhat.org/
4. Review smart contract code in `contracts/`

## Security Notes

- ✅ Never commit `.env` to git
- ✅ Use burner wallets for deployment
- ✅ Verify contracts on Polygonscan
- ✅ Test thoroughly on testnet first
- ✅ Keep private keys secure
- ⚠️ Smart contract deployments are irreversible
- ⚠️ Always have an emergency plan

---

**Ready to deploy?** Start with Step 1!
