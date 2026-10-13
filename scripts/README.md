# Scripts

This directory contains scripts for deploying and managing Matrix Hub smart contracts, as well as utility scripts for configuration and administration.

## Utility Scripts

### `generate-password-hash.js`
Generates a SHA-256 hash for the Owners Portal password authentication.

**Usage:**
```bash
node scripts/generate-password-hash.js "your-secure-password"
```

**Purpose:**
- Creates a secure hash for protecting the `/owners` portal
- Hash is stored in environment variables and embedded at build time
- Enables client-side authentication without exposing the actual password

**Example:**
```bash
$ node scripts/generate-password-hash.js "MySecureP@ssw0rd123"

✅ Password hash generated successfully!

Add this to your .env file:

OWNERS_PASSWORD_HASH=sha256-5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8

⚠️  Keep this hash secret and never commit it to the repository!
```

**Next Steps:**
1. Copy the generated hash to your `.env` file
2. Rebuild the site with `npm run build`
3. Deploy the site

**⚠️ IMPORTANT SECURITY WARNINGS:**

This script generates a password hash for **client-side authentication only**. Be aware of these critical limitations:

🔴 **This is NOT secure against determined attackers:**
- The password hash is embedded in the static site's HTML/JavaScript
- Anyone can view the page source and see the hash
- Authentication can be bypassed using browser developer tools
- SHA-256 is a fast hash, making brute-force attacks feasible
- There is NO server-side enforcement

✅ **This authentication is suitable for:**
- Hiding content from casual visitors
- Preventing accidental discovery
- Blocking search engine crawlers
- Development/testing environments

❌ **Do NOT use this for:**
- Protecting truly sensitive or confidential data
- Production systems with security requirements
- Compliance-regulated access control
- Multi-user access management
- Anything requiring legal/financial security

🔒 **For truly secure access control**, you need:
- Server-side authentication (SSR with auth middleware)
- Services like Netlify Identity, Auth0, or Clerk
- Backend API with JWT tokens
- Proper password hashing (bcrypt, argon2)

**Only YOU should have the password**. Never share it or commit it to version control.

**Documentation:**
- See [docs/OWNERS_PORTAL_AUTH.md](../docs/OWNERS_PORTAL_AUTH.md) for complete setup instructions
- See `.env.example` for configuration template

## Main Deployment Scripts

### `deploy_mtx.js`
Deploys the MTX (Matrix-HubCoin) token contract to Polygon networks.

**Usage:**
```bash
# Deploy to Amoy testnet
npm run deploy:amoy

# Deploy to Mainnet
npm run deploy:polygon
```

**Requirements:**
- `.env` file with `PRIVATE_KEY` (deployer wallet private key without 0x)
- Sufficient ETH in deployer wallet for gas fees
- `ETHERSCAN_API_KEY` (recommended for contract verification)

**Configuration:**
- Initial Supply: 100,000,000 MTX
- Initial Owner: 0x9fb4bb44d8d962d695fc93b3dc15f1b287391077
- Token Name: Matrix-HubCoin
- Token Symbol: MTX
- Decimals: 18

**Output:**
- Deploys contract and prints contract address
- Saves deployment info to `deployments/mtx-{network}.json`
- Provides verification command for Polygonscan

### `deploy_casino.js`
Deploys the complete casino contract ecosystem to Polygon networks. This automated script handles deployment of CasinoCore, CasinoReserve, LiquidityRouter, and RNGEngine with proper configuration and error handling.

**Usage:**
```bash
# Deploy to Amoy testnet (recommended first)
npx hardhat run scripts/deploy_casino.js --network amoy

# Deploy to Mainnet (after thorough testing)
npx hardhat run scripts/deploy_casino.js --network mainnet

# Or use npm scripts (if configured)
npm run deploy:amoy:casino
npm run deploy:polygon:casino
```

**Prerequisites:**
- MTX token MUST be deployed first (run `deploy_mtx.js`)
- `.env` file configured with `PRIVATE_KEY` and RPC URLs
- Sufficient ETH in deployer wallet for gas fees
- `ETHERSCAN_API_KEY` for contract verification (optional)

**Deployed Contracts:**
1. **RNGEngine** - Random number generation for game outcomes
2. **CasinoReserve** - Holds MTX reserves for casino payouts
3. **LiquidityRouter** - Manages liquidity for MTX/ETH DEX pool
4. **CasinoCore** - Main casino contract managing bets and payouts

**Configuration:**
The script includes a `DEPLOYMENT_CONFIG` object that you can customize:
```javascript
const DEPLOYMENT_CONFIG = {
  reserveCap: "1000000",        // Max MTX reserve (1M MTX)
  minBet: "1",                  // Min bet amount (1 MTX)
  maxBet: "1000",               // Max bet amount (1000 MTX)
  devAddress: null,             // Dev fee recipient (null = deployer)
  governanceAddress: null,      // Governance address (null = deployer)
  tempDexPool: null,            // DEX pool address (null = deployer)
};
```

**Output:**
- Deploys all contracts with detailed progress logging
- Creates `deployments/` folder if it doesn't exist
- Saves deployment info to `deployments/casino-{network}.json`
- Provides complete post-deployment instructions
- Includes contract verification commands for Polygonscan
- Shows frontend integration steps for Astro

**Deployment Information File:**
The script generates a JSON file (`deployments/casino-{network}.json`) containing:
```json
{
  "network": "sepolia",
  "chainId": 80002,
  "deployer": "0x...",
  "deploymentTime": "2026-01-06T23:32:00.000Z",
  "contracts": {
    "mtxToken": "0x...",
    "casinoCore": "0x...",
    "casinoReserve": "0x...",
    "liquidityRouter": "0x...",
    "rngEngine": "0x..."
  },
  "parameters": {
    "reserveCap": "1000000000000000000000000",
    "reserveCapFormatted": "1000000 MTX",
    "minBet": "1000000000000000000",
    "minBetFormatted": "1 MTX",
    "maxBet": "1000000000000000000000",
    "maxBetFormatted": "1000 MTX",
    "devAddress": "0x...",
    "governanceAddress": "0x...",
    "tempDexPool": "0x..."
  },
  "notes": {
    "casinoReserveSetup": "CasinoReserve deployed with temporary casinoCore address...",
    "liquidityRouterSetup": "LiquidityRouter deployed with temporary DEX pool address...",
    "reserveFunding": "CasinoReserve must be funded with MTX tokens..."
  }
}
```

**Post-Deployment Steps:**
1. **Update CasinoReserve** with the actual CasinoCore address
2. **Create QuickSwap Pool** for MTX/ETH and update LiquidityRouter
3. **Fund CasinoReserve** with initial MTX (recommended: 100,000+)
4. **Verify Contracts** on Polygonscan using provided commands
5. **Update Frontend** environment variables and import deployment JSON
6. **Test Thoroughly** on testnet before mainnet deployment

**Frontend Integration (Astro):**
Import the deployment information in your Astro components:
```typescript
// Import deployment data
import deploymentInfo from '../../deployments/casino-sepolia.json';

// Access contract addresses
const casinoCoreAddress = deploymentInfo.contracts.casinoCore;
const reserveAddress = deploymentInfo.contracts.casinoReserve;
```

Update environment variables:
```env
CASINO_CORE_ADDRESS=0x...
CASINO_RESERVE_ADDRESS=0x...
LIQUIDITY_ROUTER_ADDRESS=0x...
RNG_ENGINE_ADDRESS=0x...
```

**Error Handling:**
The script includes comprehensive error handling with:
- Balance checks before deployment
- MTX token deployment validation
- Constructor argument validation
- Detailed troubleshooting tips on failure
- Clear error messages for common issues

**Customization & Extensions:**
To customize deployment parameters:
1. Edit `DEPLOYMENT_CONFIG` in the script
2. Modify constructor arguments for specific contracts
3. Add additional contracts using the `deployContract()` utility function
4. Extend the deployment JSON with custom fields

**Example: Adding a New Contract:**
```javascript
// Add to main() function after existing deployments
console.log("\n5️⃣  CustomContract");
const { address: customAddress } = await deployContract(
  "CustomContract",
  [MTX_ADDRESS, casinoCoreAddress]
);

// Add to deploymentInfo.contracts
contracts: {
  // ... existing contracts
  customContract: customAddress
}
```

**Troubleshooting:**
- **"MTX token not deployed"** - Run `deploy_mtx.js` first
- **"Insufficient funds"** - Add ETH to deployer wallet
- **"Deployment failed"** - Check RPC URL and network connectivity
- **"Contract verification failed"** - Ensure ETHERSCAN_API_KEY is valid

For detailed documentation, see the comments in `scripts/deploy_casino.js`.

## Environment Setup

### Required Environment Variables

Create a `.env` file from `.env.example`:

```bash
cp .env.example .env
```

Edit `.env` with your values:

```env
# Deployer wallet private key (without 0x prefix)
PRIVATE_KEY=your_private_key_here

# RPC URLs (defaults provided if not set)
MAINNET_RPC_URL=https://eth.llamarpc.com
SEPOLIA_RPC_URL=https://rpc-amoy.polygon.technology/

# Polygonscan API key for contract verification
# Get from: https://polygonscan.com/myapikey
ETHERSCAN_API_KEY=your_etherscan_api_key_here
```

**Security Notes:**
- ✅ `.env` is in `.gitignore` - never commit it!
- ✅ Use a burner wallet, not your main wallet
- ✅ Keep your private keys and API keys secret

## Deployment Flow

### 1. Prepare Environment

```bash
# Install dependencies
npm install

# Set up .env file
cp .env.example .env
# Edit .env with your private key and API key

# Get test MATIC (for Amoy)
# Visit: https://faucet.polygon.technology/amoy/
```

### 2. Compile Contracts

```bash
npm run compile
```

This generates the contract artifacts needed for deployment.

### 3. Deploy to Testnet (Recommended First)

```bash
npm run deploy:amoy
```

**Save the contract address!**

### 4. Verify Contract

```bash
npm run verify:amoy YOUR_CONTRACT_ADDRESS "100000000" "0x9fb4bb44d8d962d695fc93b3dc15f1b287391077"
```

Replace `YOUR_CONTRACT_ADDRESS` with the deployed contract address.

### 5. Test Thoroughly

- Check contract on Amoy Polygonscan
- Verify token balance of initial owner
- Test contract functions
- Test wallet integration

### 6. Deploy to Mainnet (After Testing)

```bash
npm run deploy:polygon
```

### 7. Verify on Mainnet

```bash
npm run verify:polygon YOUR_CONTRACT_ADDRESS "100000000" "0x9fb4bb44d8d962d695fc93b3dc15f1b287391077"
```

## Networks

### Amoy Testnet
- **Chain ID**: 80002
- **RPC**: https://rpc-amoy.polygon.technology/
- **Explorer**: https://amoy.polygonscan.com/
- **Faucet**: https://faucet.polygon.technology/amoy/
- **Purpose**: Testing before mainnet deployment

### Polygon
- **Chain ID**: 137
- **RPC**: https://eth.llamarpc.com
- **Explorer**: https://polygonscan.com/
- **Purpose**: Production deployment

## Deployment Artifacts

After deployment, artifacts are saved to `deployments/`:
- `mtx-sepolia.json` - Amoy deployment info
- `mtx-mainnet.json` - Mainnet deployment info

Each file contains:
- Contract address
- Deployer address
- Owner address
- Deployment timestamp
- Transaction hash
- Block number
- Network information

## Troubleshooting

### "Private key missing"
- Ensure `PRIVATE_KEY` is set in `.env`
- Private key should NOT include `0x` prefix
- Use a 64-character hex string

### "Insufficient funds"
- Get test MATIC from faucet (Amoy)
- Buy ETH on exchange (Mainnet)
- Ensure deployer wallet has enough ETH for gas

### "Cannot download compiler"
- Check internet connection
- Hardhat downloads Solidity compiler from soliditylang.org
- If artifacts exist, deployment may still work

### "Verification failed"
- Ensure `ETHERSCAN_API_KEY` is set in `.env`
- Wait 1-2 minutes after deployment before verifying
- Check constructor arguments match deployment exactly
- Verify API key is valid at https://polygonscan.com/myapikey

## Documentation

For detailed deployment instructions, see:
- [Amoy Deployment Guide](../docs/SEPOLIA_DEPLOYMENT.md)
- [Full Deployment Guide](../docs/MTX_Deployment_Guide.md)
- [Quick Start Guide](../docs/DEPLOYMENT_QUICK_START.md)

## Support

For questions or issues:
1. Check the documentation
2. Review Hardhat documentation: https://hardhat.org/
3. Check Polygonscan API docs: https://docs.polygonscan.com/

---

**Quick Deploy: `npm run deploy:amoy` (testnet) or `npm run deploy:polygon` (production)**
