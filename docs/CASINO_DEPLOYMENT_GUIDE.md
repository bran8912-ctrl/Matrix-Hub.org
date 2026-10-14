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
POLYGON_RPC_URL=https://polygon.drpc.org
AMOY_RPC_URL=https://rpc-amoy.polygon.technology/

# Polygonscan API key for contract verification
POLYGONSCAN_API_KEY=YOUR_POLYGONSCAN_API_KEY
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
};
```

### 3.2 Deploy to Amoy

Set `MTX_CONTRACT_ADDRESS`, `QUICKSWAP_V2_ROUTER_ADDRESS`,
`CASINO_MAX_PAYOUT_PER_BET`, `VRF_SUBSCRIPTION_ID`, and the network RPC/private
key before running the script. The router and MTX addresses are
network-specific; do not use the Polygon mainnet router on Amoy.

Create and fund a Chainlink VRF v2.5 subscription on the selected network
before deployment. The subscription must be owned by the deployer and funded
with the official Chainlink LINK token because requests use LINK billing. The
deployment script verifies the subscription, deploys `RNGEngine`, then adds it
as a consumer automatically. The current coordinator, LINK token, and key hash
values are pinned in `scripts/deploy_casino.js` from Chainlink's
[supported networks reference](https://docs.chain.link/vrf/v2-5/supported-networks).
The script supports Polygon mainnet and Amoy only.

Polygon deployment is now technically enabled by the asynchronous VRF design,
but that is not approval to launch. First deploy and test on Amoy, then decide
the initial reserve funding, pool seed ratio/amount, and maximum payout. Never
put a deployer private key in chat or commit it to the repository.
The script refuses Polygon deployment unless
`POLYGON_CASINO_DEPLOYMENT_APPROVED=YES` is set after the Amoy end-to-end test
and independent security review are complete.

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

📡 Checking selected-network contract addresses...
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
   CasinoCore permission will be configured after deployment

3️⃣  LiquidityRouter
🔨 Deploying LiquidityRouter...
✅ LiquidityRouter deployed successfully
   Address: 0x...
   QuickSwap V2 pair will be created on first successful liquidity provision

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
# RNGEngine
npx hardhat verify --network amoy <RNG_ADDRESS> \
  "<VRF_COORDINATOR>" "<VRF_SUBSCRIPTION_ID>" "<VRF_KEY_HASH>" "250000" "3"

# CasinoReserve (deployed with zero CasinoCore, then configured by setter)
npx hardhat verify --network amoy <RESERVE_ADDRESS> \
  "<MTX_ADDRESS>" "<RESERVE_CAP>" "0x0000000000000000000000000000000000000000"

# LiquidityRouter
npx hardhat verify --network amoy <LIQUIDITY_ADDRESS> \
  "<MTX_ADDRESS>" "<QUICKSWAP_V2_ROUTER_ADDRESS>"

# CasinoCore
npx hardhat verify --network amoy <CASINO_CORE_ADDRESS> \
  "<MTX_ADDRESS>" "<LIQUIDITY_ADDRESS>" "<RESERVE_ADDRESS>" "<RNG_ADDRESS>" \
  "<MIN_BET>" "<MAX_BET>" "<MAX_PAYOUT_PER_BET>" "<DEV_ADDRESS>" "<GOVERNANCE_ADDRESS>"
```

**Note:** The exact verification commands are printed by the deployment script.

## Step 5: Post-Deployment Configuration

### 5.1 Module Permissions

The deployment script sets the CasinoCore address on the reserve, RNG engine,
and liquidity router after deploying the core. It also registers `RNGEngine`
as a consumer of the funded VRF subscription. Do not enable the frontend if
consumer registration failed.

### 5.2 Create QuickSwap Pool

Casino bet fees accumulate as pending MTX in LiquidityRouter. The owner must
mint/hold the intended initial MTX allocation, approve the router, and call
`queueInitialLiquidity`. Then call `provideLiquidity` with that queued MTX
amount and matching POL.
The call uses QuickSwap V2 `addLiquidityETH`; the owner supplies native POL,
which the router wraps as WMATIC. The first successful call creates the
MTX/WMATIC pair and establishes its initial price from the supplied ratio.
The LP tokens are sent to the owner. Choose the initial ratio deliberately,
then set minimum amounts and a short deadline to control slippage.

### 5.3 Fund CasinoReserve

The reserve's tracked balance must be initialized through its owner-only
`fund(amount)` method. A plain token transfer does not update the reserve's
accounting and will not enable betting.

```bash
# Approve CasinoReserve to pull the selected MTX allocation, then fund it.
# Exact CLI syntax depends on the wallet tooling used.
```

The reserve requires enough tracked MTX to cover the worst-case payout plus
all already locked bets before it accepts a new bet. Winnings remain reserved
until the player claims them. There is no timeout refund or cancel function:
removing one could let players discard unfavorable pending outcomes.
`CASINO_MAX_PAYOUT_PER_BET` and reserve funding must be chosen together.

## Step 6: Frontend Integration

### 6.1 Update Environment Variables

For Amoy testing, set the frontend network and deployed addresses in `.env`.
Use `PUBLIC_`-prefixed values so Astro/Vite can expose them to the browser:

```env
PUBLIC_CASINO_CHAIN_ID=80002
PUBLIC_MTX_CONTRACT_ADDRESS=0x...
PUBLIC_CASINO_CORE_ADDRESS=0x...
PUBLIC_CASINO_RESERVE_ADDRESS=0x...
PUBLIC_LIQUIDITY_ROUTER_ADDRESS=0x...
PUBLIC_RNG_ENGINE_ADDRESS=0x...
```

For Polygon, use `PUBLIC_CASINO_CHAIN_ID=137` and the validated mainnet
addresses. Never point the frontend at historical synchronous RNG deployments.
Only single-round Dice is supported; the other game pages remain disabled.

## Step 7: Testing

### 7.1 Test on Amoy

Before mainnet deployment, thoroughly test:

- [ ] Connect wallet to Amoy
- [ ] Verify contract addresses are correct
- [ ] Confirm the funded VRF subscription lists `RNGEngine` as a consumer
- [ ] Test approval and asynchronous bet submission
- [ ] Confirm VRF settlement matches the on-chain roll and target
- [ ] Test winner-only payout claims and reserve-liability accounting
- [ ] Confirm a losing result releases its reserved payout capacity
- [ ] Confirm pending bets cannot be cancelled, rerolled, or claimed early
- [ ] Confirm all unsupported local-outcome game pages remain disabled
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
npx hardhat run scripts/deploy_mtx.js --network polygon

# Deploy Casino
npx hardhat run scripts/deploy_casino.js --network polygon
```

### 8.3 Verify Mainnet Deployment

```bash
# Verify contracts
npx hardhat verify --network polygon <CONTRACT_ADDRESSES>

# Check deployment file
cat deployments/casino-polygon.json

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
