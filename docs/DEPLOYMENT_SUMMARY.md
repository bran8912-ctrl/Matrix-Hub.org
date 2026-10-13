# MTX Amoy Deployment - Complete Setup Summary

## ✅ What's Ready

The Matrix Hub MTX token deployment infrastructure is **fully configured and ready** for Amoy testnet deployment.

### Command Ready to Use
```bash
npm run deploy:amoy
```

## 📋 Prerequisites Checklist

Before running the deployment command, ensure you have:

### 1. Wallet Setup ✅
- [ ] Burner wallet created (do NOT use your main wallet)
- [ ] Private key copied (64 hex characters, without `0x` prefix)
- [ ] Wallet address noted for receiving test MATIC

### 2. Amoy test MATIC ✅
- [ ] Visit: https://faucet.polygon.technology/amoy/
- [ ] Request 0.5+ test MATIC (for gas fees)
- [ ] Verify ETH received in your wallet

### 3. Polygonscan API Key ✅
- [ ] Go to: https://polygonscan.com/myapikey
- [ ] Create account or sign in
- [ ] Generate new API key
- [ ] Copy API key (example format: `EXAMPLE_ETHERSCAN_API_KEY_1234567890`)

### 4. Environment Configuration ✅
- [ ] Run: `cp .env.example .env`
- [ ] Edit `.env` file with your values:
  ```env
  PRIVATE_KEY=your_private_key_without_0x_prefix
  SEPOLIA_RPC_URL=https://rpc-amoy.polygon.technology/
  ETHERSCAN_API_KEY=your_etherscan_api_key_here
  ```
- [ ] Save `.env` file
- [ ] Verify `.env` is NOT committed (it's in `.gitignore`)

### 5. Dependencies ✅
- [ ] Run: `npm install`
- [ ] Wait for installation to complete

### 6. Compile Contracts ✅
- [ ] Run: `npm run compile`
- [ ] Verify compilation succeeds or artifacts already exist

## 🚀 Deployment Process

### Step 1: Deploy to Amoy
```bash
npm run deploy:amoy
```

**Expected Output:**
```
Starting MTX Token Deployment to Polygon...
Network: sepolia
Deploying with account: 0xYourDeployerAddress
Account balance: 0.5 MATIC

Deployment parameters:
- Initial Supply: 100000000 MTX
- Initial Owner: 0x9fb4bb44d8d962d695fc93b3dc15f1b287391077
- Token Name: Matrix-HubCoin
- Token Symbol: MTX
- Decimals: 18

Deploying MatrixHubCoin contract...

✅ MTX Token deployed successfully!
Contract Address: 0xYOUR_CONTRACT_ADDRESS
Contract Owner: 0x9fb4bb44d8d962d695fc93b3dc15f1b287391077
Transaction Hash: 0xYOUR_TX_HASH

📄 Deployment info saved to: deployments/mtx-sepolia.json

🔍 View on Polygonscan: https://amoy.polygonscan.com/address/0xYOUR_CONTRACT_ADDRESS
```

**⚠️ CRITICAL: Save the contract address immediately!**

### Step 2: Verify on Polygonscan
```bash
npm run verify:amoy 0xYOUR_CONTRACT_ADDRESS "100000000" "0x9fb4bb44d8d962d695fc93b3dc15f1b287391077"
```

Replace `0xYOUR_CONTRACT_ADDRESS` with your actual deployed address.

**Expected Output:**
```
Successfully verified contract MatrixHubCoin on Polygonscan.
https://amoy.polygonscan.com/address/0xYOUR_CONTRACT_ADDRESS#code
```

### Step 3: Verify Deployment Success
Visit the Polygonscan URL and confirm:
- ✅ Contract shows as "verified" (green checkmark)
- ✅ Contract name: MatrixHubCoin
- ✅ Symbol: MTX
- ✅ Total supply: 100,000,000 MTX
- ✅ Owner address: 0x9fb4bb44d8d962d695fc93b3dc15f1b287391077

## 📚 Documentation Available

### Quick References
1. **[QUICK_DEPLOY.md](QUICK_DEPLOY.md)** - 5-minute quick start
2. **[DEPLOYMENT_CHECKLIST.md](DEPLOYMENT_CHECKLIST.md)** - Full checklist

### Detailed Guides
3. **[SEPOLIA_DEPLOYMENT.md](SEPOLIA_DEPLOYMENT.md)** - Step-by-step Amoy guide
4. **[MTX_Deployment_Guide.md](MTX_Deployment_Guide.md)** - Complete deployment guide
5. **[DEPLOYMENT_QUICK_START.md](DEPLOYMENT_QUICK_START.md)** - Original quick start

### Additional Resources
6. **[scripts/README.md](../scripts/README.md)** - Scripts documentation
7. **[README.md](../README.md)** - Main project README

## 🔧 Configuration Files

### Already Configured
- ✅ `package.json` - Deploy scripts defined
- ✅ `hardhat.config.js` - Networks and Polygonscan configured
- ✅ `scripts/deploy_mtx.js` - Deployment script ready
- ✅ `contracts/MatrixHubCoin.sol` - Token contract ready
- ✅ `.env.example` - Template with clear instructions
- ✅ `.gitignore` - Protects `.env` from commits

### What You Need to Create
- ⚠️ `.env` - Your private configuration (copy from `.env.example`)

## 🎯 Deployment Parameters

The deployment script will use these fixed parameters:

| Parameter | Value |
|-----------|-------|
| **Initial Supply** | 100,000,000 MTX |
| **Owner Address** | 0x9fb4bb44d8d962d695fc93b3dc15f1b287391077 |
| **Token Name** | Matrix-HubCoin |
| **Token Symbol** | MTX |
| **Decimals** | 18 |
| **Network** | Amoy (Chain ID: 80002) |

## 🔍 Network Information

### Amoy Testnet
- **Chain ID**: 80002
- **RPC URL**: https://rpc-amoy.polygon.technology/
- **Explorer**: https://amoy.polygonscan.com/
- **Faucets**:
  - https://faucet.polygon.technology/amoy/
  - https://www.alchemy.com/faucets/polygon-amoy
- **test MATIC**: Free from faucets

## ⚠️ Troubleshooting

### Common Issues and Solutions

| Issue | Solution |
|-------|----------|
| **"Private key missing"** | Add `PRIVATE_KEY` to `.env` (no `0x` prefix) |
| **"Insufficient funds"** | Get more test MATIC from Amoy faucet |
| **"Cannot download compiler"** | Check internet or use existing artifacts |
| **"Verification failed"** | Ensure `ETHERSCAN_API_KEY` is set correctly |
| **"Transaction failed"** | Check gas price and network connectivity |
| **"Already verified"** | Contract was verified previously (this is OK) |

## 🛡️ Security Best Practices

### ✅ DO
- Use a burner wallet for deployment
- Keep your `.env` file secret
- Verify the contract on Polygonscan after deployment
- Test with small amounts first
- Save your contract address immediately
- Backup your deployment info

### ❌ DON'T
- Don't use your main wallet for deployment
- Don't commit `.env` to Git (protected by `.gitignore`)
- Don't share your private key or API key
- Don't skip verification step
- Don't deploy to mainnet without testing on Amoy first

## 📊 After Deployment

### Immediate Actions
1. ✅ Save contract address
2. ✅ Verify on Polygonscan
3. ✅ Check deployment info in `deployments/mtx-sepolia.json`
4. ✅ Verify token balance of owner address

### Next Steps
1. Test contract functions on Polygonscan
2. Update `src/config/mtx.ts` with contract address
3. Test wallet integration with frontend
4. Test buying MTX with test MATIC
5. Perform thorough testing before mainnet deployment

### For Production (After Amoy Testing)
1. Deploy to mainnet: `npm run deploy:polygon`
2. Verify on mainnet: `npm run verify:polygon ...`
3. Add liquidity to QuickSwap
4. Update all documentation with mainnet address
5. Announce deployment

## 📝 Deployment Artifacts

After successful deployment, you'll have:

1. **`deployments/mtx-sepolia.json`** - Deployment metadata:
   ```json
   {
     "network": "sepolia",
     "chainId": 80002,
     "contractAddress": "0x...",
     "deployer": "0x...",
     "owner": "0x9fb4bb44d8d962d695fc93b3dc15f1b287391077",
     "deploymentTime": "2025-12-30T...",
     "initialSupply": "100000000",
     "transactionHash": "0x...",
     "blockNumber": 12345
   }
   ```

2. **Polygonscan verification** - Public source code
3. **Transaction history** - On Amoy Polygonscan

## 🎉 Success Criteria

Your deployment is successful when:
- ✅ Deployment command completes without errors
- ✅ Contract address is received and saved
- ✅ Transaction appears on Amoy Polygonscan
- ✅ Verification succeeds (green checkmark)
- ✅ Contract shows correct parameters
- ✅ Owner has 100M MTX balance
- ✅ All contract functions are visible

## 🆘 Support

If you encounter issues:
1. Check the troubleshooting section above
2. Review the detailed deployment guides
3. Verify all prerequisites are met
4. Check Hardhat documentation: https://hardhat.org/
5. Check Polygonscan API docs: https://docs.polygonscan.com/

## 🚀 Ready to Deploy?

If you've completed all prerequisites, run:
```bash
npm run deploy:amoy
```

Then verify with:
```bash
npm run verify:amoy YOUR_CONTRACT_ADDRESS "100000000" "0x9fb4bb44d8d962d695fc93b3dc15f1b287391077"
```

---

**Last Updated**: December 30, 2025  
**Status**: ✅ Ready for deployment  
**Command**: `npm run deploy:amoy`
