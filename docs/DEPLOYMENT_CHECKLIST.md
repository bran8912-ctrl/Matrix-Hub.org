# MTX Token Deployment Checklist

Use this checklist to ensure you have everything ready before deploying the MTX token contract.

## Pre-Deployment Checklist

### Environment Setup
- [ ] Node.js v18+ installed
- [ ] Repository cloned and dependencies installed (`npm install`)
- [ ] `.env` file created from `.env.example`

### Wallet Preparation
- [ ] Burner wallet created (NOT your main wallet)
- [ ] Private key added to `.env` (without `0x` prefix)
- [ ] test MATIC obtained from Amoy faucet (https://faucet.polygon.technology/amoy/)
- [ ] Sufficient ETH balance (0.05+ ETH recommended for gas)

### API Keys
- [ ] Polygonscan account created (https://polygonscan.com/)
- [ ] Polygonscan API key generated (https://polygonscan.com/myapikey)
- [ ] API key added to `.env` as `ETHERSCAN_API_KEY`

### Contract Configuration
- [ ] Review deployment parameters in `scripts/deploy_mtx.js`
  - Initial Supply: 100,000,000 MTX
  - Owner Address: 0x9fb4bb44d8d962d695fc93b3dc15f1b287391077
- [ ] Confirm owner address is correct and accessible

### Compilation
- [ ] Contracts compiled successfully (`npm run compile`)
- [ ] No compilation errors
- [ ] Artifacts generated in `artifacts/` directory

## Deployment to Amoy (Testnet)

### Deploy Contract
- [ ] Run: `npm run deploy:amoy`
- [ ] Deployment successful (no errors)
- [ ] Contract address saved/noted
- [ ] Deployment info saved to `deployments/mtx-sepolia.json`

### Verify Contract
- [ ] Run: `npm run verify:amoy CONTRACT_ADDRESS "100000000" "0x9fb4bb44d8d962d695fc93b3dc15f1b287391077"`
- [ ] Verification successful on Amoy Polygonscan
- [ ] Contract source code visible on Polygonscan
- [ ] Green checkmark appears on Polygonscan

### Post-Deployment Testing
- [ ] Contract visible on Amoy Polygonscan
- [ ] Owner has 100M MTX balance
- [ ] Token name: Matrix-HubCoin
- [ ] Token symbol: MTX
- [ ] Token decimals: 18
- [ ] Can read contract values on Polygonscan
- [ ] Contract functions visible and callable

### Configuration Updates
- [ ] Update `src/config/mtx.ts` with Amoy contract address
- [ ] Update documentation with deployment info
- [ ] Test wallet connection with Amoy network
- [ ] Test buying MTX with test MATIC

## Deployment to Mainnet (Production)

⚠️ **Only proceed after thorough Amoy testing!**

### Pre-Mainnet Checklist
- [ ] All Amoy tests passed
- [ ] Contract behavior verified on testnet
- [ ] Wallet integration tested
- [ ] UI tested with Amoy contract
- [ ] Security audit completed (if applicable)
- [ ] Real ETH obtained for mainnet deployment (0.1+ ETH recommended)

### Deploy to Mainnet
- [ ] Run: `npm run deploy:polygon`
- [ ] Deployment successful (no errors)
- [ ] **SAVE CONTRACT ADDRESS IMMEDIATELY!**
- [ ] Deployment info saved to `deployments/mtx-mainnet.json`

### Verify on Mainnet
- [ ] Run: `npm run verify:polygon CONTRACT_ADDRESS "100000000" "0x9fb4bb44d8d962d695fc93b3dc15f1b287391077"`
- [ ] Verification successful on Mainnet Polygonscan
- [ ] Contract source code visible
- [ ] Green checkmark on Polygonscan

### Post-Mainnet Verification
- [ ] Contract visible on Mainnet Polygonscan
- [ ] Owner has 100M MTX balance
- [ ] All token details correct
- [ ] Contract functions visible and callable
- [ ] No errors or warnings on Polygonscan

### Configuration Updates
- [ ] Update `src/config/mtx.ts` with Mainnet contract address
- [ ] Update all documentation with mainnet address
- [ ] Remove all testnet addresses from user-facing pages
- [ ] Test wallet connection on Mainnet
- [ ] Test buying MTX with real ETH (small amount first)

### Go Live
- [ ] Add liquidity to QuickSwap (MATIC/MTX pair)
- [ ] Test DEX integration
- [ ] Monitor first transactions
- [ ] Announce deployment with verified contract link
- [ ] Update community with contract address

## Security Reminders

### During Deployment
- ✅ Use a burner wallet with only needed ETH
- ✅ Never share or commit private keys
- ✅ Keep `.env` file secret
- ✅ Verify contract address before announcing
- ✅ Test with small amounts first

### After Deployment
- ✅ Securely backup deployer private key
- ✅ Then delete private key from `.env`
- ✅ Monitor contract for unusual activity
- ✅ Keep emergency pause controls ready
- ✅ Document deployment in team records

## Quick Reference

### Amoy Deployment
```bash
# 1. Setup
cp .env.example .env
# Edit .env with your keys

# 2. Compile
npm run compile

# 3. Deploy
npm run deploy:amoy

# 4. Verify (replace CONTRACT_ADDRESS)
npm run verify:amoy CONTRACT_ADDRESS "100000000" "0x9fb4bb44d8d962d695fc93b3dc15f1b287391077"
```

### Mainnet Deployment
```bash
# 1. Deploy
npm run deploy:polygon

# 2. Verify (replace CONTRACT_ADDRESS)
npm run verify:polygon CONTRACT_ADDRESS "100000000" "0x9fb4bb44d8d962d695fc93b3dc15f1b287391077"
```

## Troubleshooting

### Common Issues
- **"Private key missing"**: Add `PRIVATE_KEY` to `.env` (without 0x)
- **"Insufficient funds"**: Get more ETH from faucet (testnet) or exchange (mainnet)
- **"Cannot download compiler"**: Check internet connection
- **"Verification failed"**: Ensure `ETHERSCAN_API_KEY` is set, wait 1-2 minutes, check constructor args

### Support Resources
- [Amoy Deployment Guide](SEPOLIA_DEPLOYMENT.md)
- [Full Deployment Guide](MTX_Deployment_Guide.md)
- [Hardhat Documentation](https://hardhat.org/)
- [Polygonscan API Docs](https://docs.polygonscan.com/)

---

**Ready to deploy? Follow this checklist step by step!**
