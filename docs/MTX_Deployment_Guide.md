# MTX Contract Deployment Guide

## ⚠️ CRITICAL SECURITY WARNING

**The MTX contract is now configured for Polygon deployment with the specified owner address.**

**DO NOT:**
- Use testnet addresses in production
- Direct users to send funds to unverified addresses
- Reference unverified addresses in live documentation
- Enable the direct mint feature without proper testing

**This would result in complete loss of user funds!**

## Current Status

The MTX contract is currently configured with a placeholder address (`0x0000000000000000000000000000000000000000`) and **MUST** be properly deployed before any production use.

## Deployment Steps

### 1. Choose Network

The recommended deployment target is:
- **Polygon** (Chain ID: 137) - Primary production network
- Alternative: **Polygon Amoy Testnet** (Chain ID: 80002) for testing

### 2. Prerequisites

```bash
# Install dependencies
npm install

# Set up environment variables
# For GitHub Actions: Configure secrets in repository settings
# See: docs/GITHUB_ACTIONS_SECRETS.md for detailed instructions
# For local development: Copy .env.example and configure values
cp .env.example .env
```

**For Local Development** - Edit `.env` file:
```
POLYGON_RPC_URL=https://polygon-rpc.com/
AMOY_RPC_URL=https://rpc-amoy.polygon.technology/
PRIVATE_KEY=YOUR_DEPLOYER_PRIVATE_KEY_HERE
ETHERSCAN_API_KEY=YOUR_ETHERSCAN_API_KEY
MTX_CONTRACT_ADDRESS=  # Leave empty until deployed
```

**For GitHub Actions** - Configure repository secrets:
- Go to Repository Settings → Secrets and variables → Actions
- Add: `MAINNET_PRIVATE_KEY`, `MAINNET_RPC_URL`, `ETHERSCAN_API_KEY`
- See [GitHub Actions Secrets Setup](./GITHUB_ACTIONS_SECRETS.md) for complete guide

**⚠️ CRITICAL SECURITY**:
- **NEVER** commit your `.env` file! It's protected by `.gitignore`.
- Use a **burner wallet** for deployment, not your main wallet.
- The `.env` file should contain real keys and must be kept secret.
- Double-check `.env` is listed in `.gitignore` before committing.
- After deployment, securely backup and then delete the private key from `.env`.

### 3. Deploy Contract

#### Test Deployment (Polygon Amoy Testnet)

```bash
# Get test POL from faucet: https://faucet.polygon.technology/amoy/

# Deploy to testnet
npm run deploy:amoy
```

#### Production Deployment (Polygon)

```bash
# Ensure you have POL in your deployer wallet

# Deploy to mainnet
npm run deploy:polygon
```

The script will output:
```
MTX deployed to: 0xYourActualContractAddress
Contract Owner: 0x9fb4bb44d8d962d695fc93b3dc15f1b287391077
```

**SAVE THIS ADDRESS IMMEDIATELY!**

### 4. Verify Contract on Polygonscan

```bash
# Verify the contract (replace with your actual address and constructor args)
npm run verify:polygon 0xYourActualContractAddress "100000000" "0x9fb4bb44d8d962d695fc93b3dc15f1b287391077"
```

This will make the contract publicly verifiable on Polygonscan.

### 5. Update Configuration

Edit `src/config/mtx.ts`:

```typescript
export const MTX = {
  address: "0xYourActualContractAddress", // ✅ Real deployed address
  symbol: "MTX",
  decimals: 18,
  chainId: 137, // Polygon
  chainName: "Polygon",
  name: "Matrix Hub Coin",
  maticToMtxRate: 1000,
  // ... rest of config
};
```

### 6. Test Everything

Before going live:

1. **Test wallet connection** on Polygon
2. **Test direct mint** with small amount (0.01 MATIC)
3. **Test token display** and balance reading
4. **Test DEX integration** on QuickSwap
5. **Verify contract** on Polygonscan is readable
6. **Check EIP-747** (Add Token) functionality

### 7. Security Checklist

- [ ] Contract deployed to testnet first
- [ ] Contract verified on Polygonscan
- [ ] Deployer wallet secured
- [ ] Private keys removed from code
- [ ] Contract ownership verified
- [ ] Rate and minting controls tested
- [ ] Emergency pause functionality tested
- [ ] Max supply limit verified
- [ ] Initial liquidity provided on QuickSwap
- [ ] All documentation updated
- [ ] User-facing addresses match deployment

## Network Information

### Polygon
- **Chain ID**: 137
- **Currency**: POL (formerly MATIC)
- **RPC**: https://polygon-rpc.com/
- **Explorer**: https://polygonscan.com/
- **DEX**: QuickSwap

### Polygon Amoy Testnet
- **Chain ID**: 80002  
- **Currency**: test POL
- **RPC**: https://rpc-amoy.polygon.technology/
- **Explorer**: https://amoy.polygonscan.com/
- **Faucet**: https://faucet.polygon.technology/amoy/

## Post-Deployment

### Add Liquidity to QuickSwap

1. Go to https://app.quickswap.exchange/
2. Add MATIC/MTX liquidity pool
3. This enables DEX trading for users

### Monitor Contract

- Track transactions on Polygonscan
- Monitor minting activity
- Watch for any issues
- Keep emergency pause available

## Important Notes

- **Never deploy to mainnet without testnet testing first**
- **Always verify contracts on Polygonscan**
- **Keep deployer private key secure**
- **Test with small amounts first**
- **Have emergency procedures ready**

## Current Status: NOT DEPLOYED ⚠️

The contract is currently using a placeholder address and is not functional on any live network. All mint and purchase features will fail until proper deployment is completed.

## Post-Deployment Update Checklist

**CRITICAL**: After deploying the MTX contract to mainnet, you MUST update the following:

### Configuration Files
- [ ] `src/config/mtx.ts` - Replace placeholder address with deployed contract address
- [ ] `.env` file - Set `MTX_CONTRACT_ADDRESS` environment variable

### Documentation Files (Update all placeholder addresses)
- [ ] `docs/MTX_Tokenomics.md` - Update contract address
- [ ] `docs/MTX_Wallet_Integration.md` - Update contract address in examples
- [ ] `docs/MTX_Deployment_Guide.md` - Update with actual deployment info
- [ ] `docs/DEPLOYMENT_QUICK_START.md` - Update with deployment date and address
- [ ] `docs/ETHEREUM_MIGRATION_SUMMARY.md` - Update deployment status
- [ ] `README.md` - Update contract address if mentioned

### User-Facing Pages
- [ ] `src/pages/buy-mtx.astro` - Update any hardcoded addresses
- [ ] Verify `src/components/BuyMTX.tsx` is using the config correctly

### Post-Launch
- [ ] Take screenshots of working wallet connection and MTX purchase flow
- [ ] Update documentation with actual transaction examples and Polygonscan links
- [ ] Verify all Polygonscan links point to mainnet (not testnet)
- [ ] Announce deployment and share verified contract address
- [ ] Monitor first few transactions closely

**Exchange Rate Confirmed**: 1 MATIC = 1,000 MTX (as configured in contract and all docs)
