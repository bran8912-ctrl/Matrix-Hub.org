# Deployment Documentation Index

All documentation for deploying the MTX token contract to Polygon networks.

## 🚀 Start Here

**New to deployment?** Choose your path:

### 1. Quick Deploy (5 minutes)
➡️ **[QUICK_DEPLOY.md](QUICK_DEPLOY.md)**
- Minimal instructions
- Get started fast
- Perfect if you know the basics

### 2. First Time Deploying
➡️ **[SEPOLIA_DEPLOYMENT.md](SEPOLIA_DEPLOYMENT.md)**
- Detailed step-by-step guide
- Explains everything
- Includes troubleshooting
- Recommended for beginners

### 3. Pre-Deployment Checklist
➡️ **[DEPLOYMENT_CHECKLIST.md](DEPLOYMENT_CHECKLIST.md)**
- Complete checklist format
- Track your progress
- Ensures nothing is missed
- Good for verification

### 4. Complete Overview
➡️ **[DEPLOYMENT_SUMMARY.md](DEPLOYMENT_SUMMARY.md)**
- Comprehensive summary
- All information in one place
- Prerequisites, steps, and troubleshooting
- Reference document

### 5. Full Deployment Guide
➡️ **[MTX_Deployment_Guide.md](MTX_Deployment_Guide.md)**
- Original comprehensive guide
- Covers mainnet and testnet
- Security considerations
- Post-deployment tasks

## 📖 Additional Resources

### Scripts Documentation
➡️ **[scripts/README.md](../scripts/README.md)**
- Deployment scripts overview
- How to use deployment commands
- Network configurations

### Main Project README
➡️ **[README.md](../README.md)**
- Project overview
- All available commands
- General setup instructions

## ⚡ Quick Command Reference

### Setup
```bash
# Copy environment template
cp .env.example .env

# Edit with your credentials
# - PRIVATE_KEY (without 0x prefix)
# - ETHERSCAN_API_KEY (from https://polygonscan.com/myapikey)

# Install dependencies
npm install

# Compile contracts
npm run compile
```

### Deploy to Amoy Testnet
```bash
# Get test MATIC first: https://faucet.polygon.technology/amoy/

# Deploy
npm run deploy:amoy

# Verify (replace CONTRACT_ADDRESS)
npm run verify:amoy CONTRACT_ADDRESS "100000000" "0x9fb4bb44d8d962d695fc93b3dc15f1b287391077"
```

### Deploy to Mainnet (After Testing)
```bash
# Deploy
npm run deploy:polygon

# Verify (replace CONTRACT_ADDRESS)
npm run verify:polygon CONTRACT_ADDRESS "100000000" "0x9fb4bb44d8d962d695fc93b3dc15f1b287391077"
```

## 🎯 What You Need

### Required Before Deployment
1. **Burner Wallet**
   - Private key (64 hex chars, no `0x`)
   - Separate from your main wallet

2. **test MATIC** (for Amoy)
   - Faucets:
     - https://faucet.polygon.technology/amoy/
     - https://www.alchemy.com/faucets/polygon-amoy

3. **Polygonscan API Key**
   - Get from: https://polygonscan.com/myapikey
   - Used for contract verification
   - Example: `ETHERSCAN_API_KEY=ABC123XYZ456YOUR_KEY_HERE`

4. **Environment File**
   - Copy `.env.example` to `.env`
   - Fill in: `PRIVATE_KEY` and `ETHERSCAN_API_KEY`

## 🔍 By Topic

### Prerequisites Setup
- [SEPOLIA_DEPLOYMENT.md](SEPOLIA_DEPLOYMENT.md#prerequisites) - Prerequisites section
- [DEPLOYMENT_CHECKLIST.md](DEPLOYMENT_CHECKLIST.md#pre-deployment-checklist) - Pre-deployment checklist
- [DEPLOYMENT_SUMMARY.md](DEPLOYMENT_SUMMARY.md#-prerequisites-checklist) - Requirements overview

### Environment Configuration
- [.env.example](../.env.example) - Environment template
- [MTX_Deployment_Guide.md](MTX_Deployment_Guide.md#2-prerequisites) - Environment setup

### Deployment Steps
- [QUICK_DEPLOY.md](QUICK_DEPLOY.md#deploy-2-minutes) - Quick steps
- [SEPOLIA_DEPLOYMENT.md](SEPOLIA_DEPLOYMENT.md#deployment-steps) - Detailed steps
- [DEPLOYMENT_SUMMARY.md](DEPLOYMENT_SUMMARY.md#-deployment-process) - Complete process

### Contract Verification
- [SEPOLIA_DEPLOYMENT.md](SEPOLIA_DEPLOYMENT.md#step-4-verify-contract-on-etherscan) - Verification guide
- [scripts/README.md](../scripts/README.md#step-4-verify-contract) - Verification commands

### Troubleshooting
- [SEPOLIA_DEPLOYMENT.md](SEPOLIA_DEPLOYMENT.md#troubleshooting) - Common issues and solutions
- [DEPLOYMENT_SUMMARY.md](DEPLOYMENT_SUMMARY.md#-troubleshooting) - Quick troubleshooting table
- [MTX_Deployment_Guide.md](MTX_Deployment_Guide.md#troubleshooting) - Detailed troubleshooting

### Security Best Practices
- [DEPLOYMENT_SUMMARY.md](DEPLOYMENT_SUMMARY.md#-security-best-practices) - Security guidelines
- [MTX_Deployment_Guide.md](MTX_Deployment_Guide.md#7-security-checklist) - Security checklist
- [DEPLOYMENT_CHECKLIST.md](DEPLOYMENT_CHECKLIST.md#security-reminders) - Security reminders

### Post-Deployment
- [DEPLOYMENT_CHECKLIST.md](DEPLOYMENT_CHECKLIST.md#post-deployment-testing) - Testing checklist
- [MTX_Deployment_Guide.md](MTX_Deployment_Guide.md#post-deployment) - Post-deployment tasks
- [DEPLOYMENT_SUMMARY.md](DEPLOYMENT_SUMMARY.md#-after-deployment) - Next steps

## 📊 Documentation Status

| Document | Purpose | Status |
|----------|---------|--------|
| QUICK_DEPLOY.md | Fast 5-minute guide | ✅ Ready |
| SEPOLIA_DEPLOYMENT.md | Detailed testnet guide | ✅ Ready |
| DEPLOYMENT_CHECKLIST.md | Interactive checklist | ✅ Ready |
| DEPLOYMENT_SUMMARY.md | Complete overview | ✅ Ready |
| MTX_Deployment_Guide.md | Full comprehensive guide | ✅ Ready |
| DEPLOYMENT_QUICK_START.md | Original quick start | ✅ Ready |
| scripts/README.md | Scripts documentation | ✅ Ready |

## 🆘 Need Help?

### Common Questions

**Q: Which guide should I use?**
- First time: [SEPOLIA_DEPLOYMENT.md](SEPOLIA_DEPLOYMENT.md)
- Quick deploy: [QUICK_DEPLOY.md](QUICK_DEPLOY.md)
- Checklist format: [DEPLOYMENT_CHECKLIST.md](DEPLOYMENT_CHECKLIST.md)

**Q: Where do I get an Polygonscan API key?**
- Visit: https://polygonscan.com/myapikey
- Sign up or log in
- Create new API key
- Copy and add to `.env`

**Q: Where do I get test MATIC?**
- Amoy faucets:
  - https://faucet.polygon.technology/amoy/
  - https://www.alchemy.com/faucets/polygon-amoy

**Q: What if deployment fails?**
- Check [Troubleshooting](SEPOLIA_DEPLOYMENT.md#troubleshooting)
- Verify all prerequisites are met
- Check `.env` configuration
- Ensure sufficient test MATIC

**Q: How do I verify the contract?**
- Use: `npm run verify:amoy CONTRACT_ADDRESS "100000000" "0x9fb4bb44d8d962d695fc93b3dc15f1b287391077"`
- See: [Verification Guide](SEPOLIA_DEPLOYMENT.md#step-4-verify-contract-on-etherscan)

## 🎯 Quick Navigation

```
├── Quick Start (5 min)       → QUICK_DEPLOY.md
├── Detailed Guide            → SEPOLIA_DEPLOYMENT.md
├── Interactive Checklist     → DEPLOYMENT_CHECKLIST.md
├── Complete Reference        → DEPLOYMENT_SUMMARY.md
├── Full Comprehensive Guide  → MTX_Deployment_Guide.md
├── Original Quick Start      → QUICK_DEPLOY.md
└── Scripts Documentation     → scripts/README.md
```

---

**Ready to deploy?** → [Start with QUICK_DEPLOY.md](QUICK_DEPLOY.md)  
**First time?** → [Start with SEPOLIA_DEPLOYMENT.md](SEPOLIA_DEPLOYMENT.md)  
**Need checklist?** → [Use DEPLOYMENT_CHECKLIST.md](DEPLOYMENT_CHECKLIST.md)

**Command**: `npm run deploy:amoy` 🚀
