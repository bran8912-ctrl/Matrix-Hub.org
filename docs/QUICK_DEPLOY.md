# 🚀 Quick Start: Deploy MTX to Amoy

## Prerequisites (5 minutes)

1. **Get Amoy test MATIC**
   - Visit: https://faucet.polygon.technology/amoy/
   - Request 0.5 test MATIC

2. **Get Polygonscan API Key**
   - Go to: https://polygonscan.com/myapikey
   - Sign up/login → Create API key
   - Copy the key (e.g., `ABC123XYZ456YOUR_KEY_HERE`)

3. **Create .env file**
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env`:
   ```env
   PRIVATE_KEY=your_burner_wallet_private_key_without_0x
   ETHERSCAN_API_KEY=your_etherscan_api_key_here
   ```

## Deploy (2 minutes)

```bash
# Install dependencies (first time only)
npm install

# Compile contracts (first time only)
npm run compile

# Deploy to Amoy testnet
npm run deploy:amoy
```

**SAVE THE CONTRACT ADDRESS!**

## Verify (1 minute)

```bash
# Replace YOUR_CONTRACT_ADDRESS with the address from deployment
npm run verify:amoy YOUR_CONTRACT_ADDRESS "100000000" "0x9fb4bb44d8d962d695fc93b3dc15f1b287391077"
```

## Done! ✅

Your contract is now:
- ✅ Deployed to Amoy testnet
- ✅ Verified on Amoy Polygonscan
- ✅ Ready for testing

View on Polygonscan: `https://amoy.polygonscan.com/address/YOUR_CONTRACT_ADDRESS`

---

## Need Help?

- **Full Guide**: [SEPOLIA_DEPLOYMENT.md](SEPOLIA_DEPLOYMENT.md)
- **Checklist**: [DEPLOYMENT_CHECKLIST.md](DEPLOYMENT_CHECKLIST.md)
- **Troubleshooting**: See full guide above

## Troubleshooting

| Error | Solution |
|-------|----------|
| "Private key missing" | Add `PRIVATE_KEY` to `.env` (no 0x prefix) |
| "Insufficient funds" | Get more test MATIC from faucet |
| "Verification failed" | Check `ETHERSCAN_API_KEY` is set correctly |
| "Cannot download compiler" | Artifacts may exist, try deploying anyway |

---

**Command:** `npm run deploy:amoy` 🚀
