# MTX Token Deployment - Quick Reference

## Current Status

**⚠️ Contract Not Yet Deployed**

The MTX token contract is ready for deployment but has not been deployed to any live network yet. The current placeholder address (`0x0000000000000000000000000000000000000000`) will not work.

## Quick Deploy

### Prerequisites

1. Install dependencies: `npm install`
2. Create `.env` file: `cp .env.example .env`
3. Add your private key to `.env` (wallet with MATIC for gas)
4. Get test POL: https://faucet.polygon.technology/amoy/

### Deploy Commands

```bash
# Interactive deployment (recommended)
npm run deploy

# Or deploy directly to Amoy testnet
npm run deploy:amoy

# Or deploy directly to mainnet (after testing!)
npm run deploy:polygon
```

### After Deployment

1. **Verify Contract**
   ```bash
   # For testnet
   npm run verify:amoy YOUR_CONTRACT_ADDRESS "100000000" "0x9fb4bb44d8d962d695fc93b3dc15f1b287391077"
   
   # For mainnet
   npm run verify:polygon YOUR_CONTRACT_ADDRESS "100000000" "0x9fb4bb44d8d962d695fc93b3dc15f1b287391077"
   ```

2. **Update Configuration**
   - Update `src/config/mtx.ts` with the deployed contract address
   - Update `src/pages/buy-mtx.astro` with the deployed contract address (if hardcoded)
   - Update all documentation with the real contract address
   - Or set `MTX_CONTRACT_ADDRESS` environment variable
   - **IMPORTANT**: Replace placeholder `0x0000000000000000000000000000000000000000` everywhere

3. **Test Everything**
   - Connect wallet on correct network (Polygon)
   - Test direct mint with small amount (0.01 MATIC)
   - Verify token appears in wallet
   - Test DEX integration on QuickSwap

4. **Add Liquidity**
   - Go to https://app.quickswap.exchange/
   - Add MATIC/MTX liquidity pool
   - Enables DEX trading

## Network Information

### Polygon (Production)
- **Chain ID**: 137
- **Currency**: POL (formerly MATIC)
- **RPC**: https://polygon-rpc.com/
- **Explorer**: https://polygonscan.com/
- **DEX**: QuickSwap

### Polygon Amoy Testnet (Testing)
- **Chain ID**: 80002
- **Currency**: test POL
- **RPC**: https://rpc-amoy.polygon.technology/
- **Explorer**: https://amoy.polygonscan.com/
- **Faucet**: https://faucet.polygon.technology/amoy/

## Verification on Polygonscan

After deployment, verify your contract on Polygonscan:

1. Get Polygonscan API key from: https://polygonscan.com/myapikey
2. Add to `.env`: `ETHERSCAN_API_KEY=your_key_here`
3. Run verification command (see above)

## Security Checklist

Before going live:

- [ ] Contract deployed to testnet first
- [ ] All functions tested on testnet
- [ ] Contract verified on Polygonscan
- [ ] Private keys secured (never commit to Git)
- [ ] Contract ownership checked
- [ ] Rate and minting controls tested
- [ ] Emergency pause tested
- [ ] Max supply verified
- [ ] Initial DEX liquidity added (QuickSwap)
- [ ] All documentation updated
- [ ] Frontend tested with real contract
- [ ] User-facing addresses match deployment

## Troubleshooting

**"Cannot download compiler"**
- Check internet connection
- Try again in a few minutes
- Solidity compiler downloads from soliditylang.org

**"Insufficient funds"**
- Get more ETH from faucet (testnet)
- Or buy ETH on exchange (mainnet)

**"Transaction failed"**
- Check gas price
- Verify network is correct
- Ensure wallet has enough ETH

**"Contract verification failed"**
- Check constructor arguments match deployment
- Verify Polygonscan API key is correct
- Wait a few minutes after deployment before verifying

## Support

For detailed instructions, see:
- [Full Deployment Guide](MTX_Deployment_Guide.md)
- [Wallet Integration Docs](MTX_Wallet_Integration.md)
- [Tokenomics](MTX_Tokenomics.md)

## Important Notes

- **Always test on testnet first**
- **Never share or commit private keys**
- **Verify contract address before directing users**
- **Keep emergency pause controls ready**
- **Monitor contract for unusual activity**

---

**Ready to deploy? Run: `npm run deploy:amoy` (testnet) or `npm run deploy:polygon` (production)**
