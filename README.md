## 10. MTX SINK CONTROLS

Matrix-Hub keeps MTX supply healthy and utility high with:

- **Burn % on Premium Usage:**
        - A percentage of MTX spent on premium features is burned (sent to a dead address), reducing total supply.
- **Lock MTX for Tier Access:**
        - Users can lock MTX to access higher tiers/features. Locked MTX is held and cannot be spent until unlocked.
- **Time-Based Unlocks:**
        - Locked MTX can be unlocked after a set period (e.g., 30 days), encouraging holding and stabilizing supply.

These mechanisms ensure sustainable value and reward long-term engagement.
## 9. CASINO: WIN OR SPEND MTX

Matrix-Hub features a Casino section where users can:

- **Spend MTX** to play games (Slots, Blackjack, Roulette)
- **Win MTX** by hitting jackpots or winning hands
- All transactions are on-chain and transparent
- MTX is required to play, but you can win more!

### Casino Games
- **Slots**: Spin the reels, each spin costs 1 MTX. Win MTX by landing winning combinations.
- **Blackjack**: Beat the dealer, each hand costs 2 MTX. Win MTX for winning hands.
- **Roulette**: Bet MTX, minimum bet 1 MTX. Win MTX by guessing the correct outcome.

### MTX Earn Paths
- Usage milestones (e.g., games played, modules used)
- Bug reports (approved by admins)
- Approved GitHub actions (merged PRs, code contributions)
- Community testing and feedback
## 8. WHAT MAKES THIS DESIGN LEGIT

✔ MTX is useful on-site, not theoretical
✔ DEX provides access, not promises
✔ Value loops through behavior
✔ Growth comes from usage
✔ No dependency on hype cycles
# Matrix Hub

[![.github/workflows/run-scripts.yml](https://github.com/bran8912-ctrl/Matrix-Hub.org/actions/workflows/run-scripts.yml/badge.svg?branch=Hub10)](https://github.com/bran8912-ctrl/Matrix-Hub.org/actions/workflows/run-scripts.yml)
[![Code Quality Analysis](https://github.com/bran8912-ctrl/Matrix-Hub.org/actions/workflows/code-quality.yml/badge.svg?branch=Hub10)](https://github.com/bran8912-ctrl/Matrix-Hub.org/actions/workflows/code-quality.yml)

> MATRIX HUB :: ONLINE  
> NODE STATUS: ACTIVE  
> ACCESS LAYER: OPEN

**Matrix-Hub.org** is a live system.  
Tools. Modules. Experiments.  
No noise. No illusion.

**MTX** is the system key.  
Access. Usage. Contribution.  
Earn it. Spend it.

More modules loading...

## The Feedback Loop: Self-Sustaining Ecosystem

```
┌─────────────────────────────────────────────────────────┐
│                    THE MTX CYCLE                        │
└─────────────────────────────────────────────────────────┘

USERS → Engage with modules → EARN MTX
  ↑                                ↓
  │                            Hold & Stake
  │                                ↓
  │                          Unlock Features
  │                                ↓
  │                         SPEND MTX → Access Premium Tools
  │                                ↓
  └──────────────────── Enhanced Experience ──────────────┘
                              ↓
                    Attract More Users
                              ↓
                      Network Effect → Growth
```

### How It Works

**1. EARN** → Users accumulate MTX through:
- Daily platform engagement
- Contributing tools/modules
- Playing Matrix games
- Completing challenges
- Community participation

**2. STAKE** → Holding MTX unlocks:
- Advanced features
- Priority access
- Governance rights
- Revenue share from platform growth

**3. SPEND** → MTX fuels the ecosystem:
- Access premium modules
- Unlock experimental tools
- Deploy custom integrations
- Support other developers

**4. CIRCULATE** → The loop reinforces itself:
- More users → More activity → More value created
- More value → More MTX utility → Higher retention
- Higher retention → Stronger network → Ecosystem growth

### Sustainability Principles

- **No External Dependency**: Value generated internally through real utility
- **Perpetual Motion**: Each action feeds the next cycle
- **Scarcity by Design**: Limited MTX supply increases value with growth
- **Merit-Based**: Contribution = Reward = Access

The system sustains itself. The loop never stops.

## ⚡ MTX System Flow — How It Powers Site Growth

### HIGH-LEVEL SYSTEM FLOW (OVERVIEW)

```
┌─────────────────────────────────────────────────────────┐
│              MTX Purchase Options                        │
│                                                         │
│  ├─ Direct Mint: Send MATIC → Receive MTX (1 MATIC = 1,000 MTX) │
│  │  └─ Lower gas, instant minting, perfect for onboarding │
│  │                                                      │
│  └─ QuickSwap DEX: Public market trading                  │
│     └─ Market rates, high liquidity, any token swap     │
└─────────────────────────────────────────────────────────┘
                        ↓
                 ┌─────────────┐
                 │ User Wallet │
                 └─────────────┘
                        ↓
              [ CONNECT WALLET ]
                        ↓
                ┌───────────────────┐
                │ Matrix-Hub.org    │
                │                   │
                │ • Use Tools       │
                │ • Earn MTX        │
                │ • Unlock Features │
                │ • Build Modules   │
                └───────────────────┘
```

**Entry Points:**
- **Direct Mint**: Send MATIC directly to MTX contract for instant minting at fixed rate
- **DEX Acquisition**: Purchase MTX on QuickSwap at market rates
- **Direct Earn**: Earn MTX through platform engagement (no purchase required)
- **Wallet Connection**: Non-custodial — you control your MTX

**Flow:**
1. Acquire MTX (direct mint, DEX buy, or earn)
2. Connect wallet to Matrix-Hub.org
3. Use MTX to unlock features and tools
4. Earn more MTX through contribution
5. Optional: Exit to DEX if desired

---

### DEX → SYSTEM BRIDGE (CRITICAL DESIGN)

**Purpose of DEX Launch:**

- Price discovery
- Open access
- External visibility

**Not revenue extraction.**

**Flow Diagram: DEX → HUB**

```
[ WALLET CONNECTED ]
        ↓
[ MTX BALANCE READ ]
        ↓
[ PERMISSION CHECK ]
        ↓
┌───────────────────────┐
│  BASIC ACCESS (FREE)  │
│  ───────────────────  │
│  + Core tools         │
│  + Public modules     │
│  + Game access        │
│  + Community features │
└───────────────────────┘
        ↓
        MTX Balance > 0 ?
        ↓
┌───────────────────────┐
│  MTX UNLOCKED LAYERS  │
│  ───────────────────  │
│  + Advanced tools     │
│  + Priority queues    │
│  + Experimental mods  │
│  + Compute-heavy ops  │
│  + Beta features      │
└───────────────────────┘
```

**Key Design Principles:**

1. **Free Base Access**: No MTX required to use Matrix-Hub
2. **Balance-Based Permissions**: MTX amount determines feature access
3. **No Custody**: Site reads wallet, never holds MTX
4. **Progressive Unlock**: More MTX = More features (not pay-per-use)
5. **Transparent Gates**: Users always know what MTX unlocks

---

### MATRIX-HUB ACCESS FLOW (CORE LOOP)

```
USER ACTION
     ↓
[ TOOL / MODULE ]
     ↓
MTX COST APPLIED
     ↓
 ┌───────────────┬───────────────┐
 │               │               │
[SYSTEM SINK]   [REWARD POOL]   
 │               │
Burn / Lock     Contributors
 │               │
 └───────┬───────┘
         ↓
  SYSTEM BALANCE
```

**How it works:**
- Every tool/module use may have an MTX cost (dynamic, based on resource use or feature tier)
- MTX is split between:
  - **System Sink**: Burned or locked, reducing supply and increasing scarcity
  - **Reward Pool**: Distributed to contributors, developers, and active users
- This ensures:
  - Constant MTX circulation
  - Contributors are always incentivized
  - System remains balanced and sustainable

**Result:**
- The more the system is used, the more value flows to contributors and the more MTX is removed from circulation, reinforcing the ecosystem's health.

---

### 1. ENTRY (FREE → MTX)

- Site is usable without MTX
- MTX unlocks deeper layers
- No hard paywalls — only progression

**Result**: Low friction, high retention

---

### 2. ACTION → REWARD

Users earn MTX by:

- Creating accounts
- Using tools
- Testing beta features
- Reporting issues (GitHub → MTX rewards)

**Result**: Activity becomes growth fuel

---

### 3. WALLET PERMISSIONED ACCESS (MTX GATES)

```
[ WALLET CONNECTED ]
        ↓
[ MTX BALANCE READ ]
        ↓
[ PERMISSION CHECK ]
        ↓
┌───────────────────────┐
│  BASIC ACCESS (FREE)  │
│  ───────────────────  │
│  + Core tools         │
│  + Public modules     │
└───────────────────────┘
        ↓
┌───────────────────────┐
│  MTX UNLOCKED LAYERS  │
│  ───────────────────  │
│  + Advanced tools     │
│  + Priority queues    │
│  + Experimental mods  │
└───────────────────────┘
```

**How it works:**
- Users connect their wallet to Matrix-Hub
- The system reads the MTX balance (never takes custody)
- Permission check determines access tier:
  - **Basic**: Free, core tools and public modules
  - **MTX Unlocked**: Advanced tools, queues, experimental modules
- No hard paywalls, only progressive unlocks

---

### 4. FEEDBACK LOOP

**USE → EARN → UNLOCK → BUILD → REPEAT**

- Usage increases value
- Value attracts contributors
- Contributors build modules
- Modules increase usage

**Result**: Self-reinforcing ecosystem

---

### 5. MTX CIRCULATION INSIDE MATRIX-HUB

```
NEW USER
   ↓
FREE ACCESS
   ↓
VALUE DISCOVERED
   ↓
MTX ACQUIRED (DEX or Earned)
   ↓
ADVANCED USAGE
   ↓
CONTRIBUTION
   ↓
REWARDS
   ↓
RETENTION + SIGNAL
```

**Explanation:**
- **New users** start with free access, exploring core tools and modules.
- As they discover value, they acquire MTX (either by earning through activity or buying via DEX).
- MTX unlocks advanced features, deeper engagement, and higher-impact actions.
- Active users contribute (code, content, feedback), fueling the ecosystem.
- Contributors and engaged users receive MTX rewards, reinforcing positive behavior.
- This cycle drives retention and generates strong usage signals, attracting more users and contributors.

**Result:**
- MTX is always in motion—never idle—ensuring a vibrant, sustainable, and growing Matrix-Hub ecosystem.

---

### 6. GITHUB → MTX FEEDBACK LOOP

```
GitHub Issue / PR
        ↓
Reviewed & Accepted
        ↓
MTX GRANT
        ↓
Wallet Credit
        ↓
System Usage / Staking
```

**How it works:**
- Developers submit issues or pull requests to Matrix-Hub's GitHub repository
- When contributions are reviewed and accepted, the system grants MTX to the contributor
- MTX is credited directly to the contributor's wallet
- Contributors can use or stake MTX within Matrix-Hub, unlocking features or earning further rewards

**This turns GitHub into:**
- A recruitment funnel (attracts new devs)
- A contribution validator (ensures quality)
- A reward engine (direct, on-chain incentives)

---

### 7. FUTURE EXPANSION PATH

MTX later enables:

- Plugin marketplace
- App-to-app payments
- Partner integrations
- DAO-lite governance

**Only after real usage exists.**

---

### 🧠 DESIGN RULES (IMPORTANT)

- **MTX never required** for basic access
- **MTX never marketed** as profit
- **MTX only unlocks** real function
- **Growth follows usage**, not hype

---

```
SYSTEM GROWS BY USE.
MTX FLOWS WHERE SIGNAL EXISTS.
```

---

## 🚀 Quick Start: Getting MTX

New to Matrix-Hub? Here's how to get started with MTX:

### Optional n8n automation hook

For the n8n CTA flow, add a server-side webhook URL to your deployment environment:

```bash
N8N_WEBHOOK_URL=https://your-n8n.example.com/webhook/your-workflow-id
```

This lets the server API proxy on [src/server/n8n-webhook.ts](src/server/n8n-webhook.ts) forward a real JSON payload into your n8n workflow through the Node adapter runtime.

### ⚠️ MTX Contract Deployment Required

**IMPORTANT**: The MTX token contract must be deployed to Polygon to get a legitimate address before the platform can be used.

**Current Status**: Contract not yet deployed to live network.

**To Deploy**:
```bash
# Install dependencies
npm install

# Set up environment variables
# For GitHub Actions deployment: Configure secrets in repository settings
# See: docs/GITHUB_ACTIONS_SECRETS.md for detailed instructions
# For local development: Copy .env.example and add your values
cp .env.example .env
nano .env

# Deploy to Polygon Amoy Testnet (recommended first)
npm run deploy:sepolia

# Get testnet ETH from: https://faucet.polygon.technology/amoy/

# After testing, deploy to Polygon
npm run deploy:mainnet
```

**Deployment Documentation**:
- 🔐 [GitHub Actions Secrets Setup](docs/GITHUB_ACTIONS_SECRETS.md) - Configure secrets for automated deployment
- 🚀 [Quick Deploy Guide](docs/QUICK_DEPLOY.md) - Get started in 5 minutes
- 📋 [Deployment Checklist](docs/DEPLOYMENT_CHECKLIST.md) - Pre-deployment checklist
- 📖 [Amoy Deployment Guide](docs/SEPOLIA_DEPLOYMENT.md) - Detailed testnet deployment
- 📚 [Full Deployment Guide](docs/MTX_Deployment_Guide.md) - Complete instructions

### Once Deployed: Purchase Options

### Option 1: Direct Mint (Recommended for First-Time Users)

1. **Visit** [matrix-hub.org/buy-mtx](https://matrix-hub.org/buy-mtx)
2. **Connect** your Polygon wallet (MetaMask or compatible)
3. **Send MATIC** directly to the MTX contract to mint tokens
4. **Rate**: 1 MATIC = 1,000 MTX (fixed)
5. **Benefits**: Lower gas fees, instant minting, perfect for small purchases

### Option 2: QuickSwap DEX (For Market Trading)

1. **Visit** [QuickSwap](https://app.quickswap.exchange/)
2. **Connect** your wallet
3. **Swap** ETH or any token for MTX
4. **Benefits**: Market rates, high liquidity, flexible amounts

### Option 3: Earn MTX (No Purchase Required)

- Complete platform challenges
- Contribute to GitHub (merged PRs earn MTX)
- Report bugs and issues
- Test beta features
- Community participation

### MTX Contract Information

- **Network**: Polygon (Chain ID: 137)
- **Contract Address**: *To be updated after deployment*
- **Contract Owner**: 0x9fb4bb44d8d962d695fc93b3dc15f1b287391077
- **Symbol**: MTX
- **Decimals**: 18
- **Block Explorer**: Polygonscan

⚠️ **Always verify the contract address before sending funds!**

---

## Deployment

This starter can be deployed to any Node-compatible hosting provider that supports static + server output (for example: Vercel, Render, or self-hosted Node servers). If you previously used hosting-specific features (image proxy, provider extensions), these have been removed in favor of a generic Node setup.

If you want a one-click deploy experience, add your hosting provider's deploy button or instructions here.

## Astro Commands

All commands are run from the root of the project, from a terminal:

| Command                   | Action                                           |
| :------------------------ | :----------------------------------------------- |
| `npm install`             | Installs dependencies                            |
| `npm run dev`             | Starts local dev server at `localhost:4321`      |
| `npm run build`           | Build your production site to `./dist/`          |
| `npm run preview`         | Preview your build locally, before deploying     |
| `npm run astro ...`       | Run CLI commands like `astro add`, `astro check` |
| `npm run astro -- --help` | Get help using the Astro CLI                     |

## Smart Contract Commands

| Command                   | Action                                           |
| :------------------------ | :----------------------------------------------- |
| `npm run compile`         | Compile Solidity contracts                       |
| `npm run test`            | Run Hardhat tests                                |
| `npm run deploy:sepolia`  | Deploy MTX contract to Amoy testnet           |
| `npm run deploy:mainnet`  | Deploy MTX contract to Polygon          |
| `npm run verify:sepolia`  | Verify contract on Amoy Polygonscan            |
| `npm run verify:mainnet`  | Verify contract on Mainnet Polygonscan            |

## Content Workflow Commands

Matrix-Hub includes a powerful content management workflow for marketing, analytics, and SEO optimization.

| Command                    | Action                                           |
| :------------------------- | :----------------------------------------------- |
| `npm run content:scan`     | Scan and index all content files                 |
| `npm run content:generate` | Generate public JSON feeds from content          |
| `npm run content:analytics`| Generate detailed content analytics report       |
| `npm run content:watch`    | Watch for file changes and auto-update feeds     |
| `npm run content:help`     | Show content workflow help                       |

📚 **Full Documentation:** See [CONTENT_WORKFLOW.md](CONTENT_WORKFLOW.md) for detailed usage instructions, examples, troubleshooting, and advanced features.

---

## GitHub Actions & CI

Matrix-Hub includes GitHub Actions workflows for automated script execution and deployment.

### Run Scripts Workflow

The `run-scripts.yml` workflow allows you to manually trigger any npm script via GitHub Actions:

1. Go to **Actions** → **Run Scripts on Demand** in your GitHub repository
2. Click **Run workflow**
3. Select the script to run from the dropdown
4. Optionally choose whether to upload artifacts
5. Click **Run workflow** button to start

**Available Scripts:**
- `content:scan` - ✅ Works in CI
- `content:generate` - ✅ Works in CI
- `content:analytics` - ✅ Works in CI
- `content:help` - ✅ Works in CI
- `build` - ✅ Works in CI
- `compile` - ⚠️ May fail in CI (requires Solidity compiler download)
- `test` - ⚠️ May fail in CI (requires Solidity compiler download)

**Note:** The workflow will complete successfully even if compile/test scripts fail due to network restrictions. Check the workflow summary for detailed output and any informative error messages.

### CI Troubleshooting

**Issue: `compile` or `test` scripts fail in CI**

**Cause:** These scripts use Hardhat, which needs to download the Solidity compiler from the internet. Some CI environments have network restrictions or the download may fail.

**Solutions:**
1. **For compile:** Pre-compiled artifacts are committed to the `artifacts/` directory and can be used directly
2. **For test:** No test files currently exist in the project
3. **Workaround:** Run these scripts locally before deploying rather than in CI

**Issue: `npm ci` fails**

**Cause:** Missing or corrupted `package-lock.json` file.

**Solution:** 
```bash
rm package-lock.json
npm install
git add package-lock.json
git commit -m "Regenerate package-lock.json"
```

**Issue: Workflow shows "failed" status**

**Cause:** A script encountered a genuine error (not compile/test network issues).

**Solution:** Check the workflow summary for detailed error messages. The compile/test scripts are designed to succeed even when they can't download the compiler, so only genuine errors will cause workflow failure.

**Node.js Version:** The workflows use Node.js v20. Ensure your local environment matches for consistent results.

> **⚠️ Important:** Node.js v18.20.8 is not supported by Hardhat. If you're using Node.js v18, please upgrade to v20 or use a version manager like `nvm` to switch versions. Hardhat requires Node.js v18.15.0 or later for v18, or v20+ is recommended.

---

## Developing Locally

| Prerequisites                                                                |
| :--------------------------------------------------------------------------- |
| [Node.js](https://nodejs.org/) v20+ (recommended to match CI environment)    |
| (optional) [nvm](https://github.com/nvm-sh/nvm) for Node version management  |
| [Supabase account](https://supabase.com/)                                    |

### Set up the database

To use this template, you’ll need to set up and seed a new Supabase database.

1. Create a new Supabase project.
2. Run the SQL commands found in the `supabase/migrations` directory in the Supabase UI.
3. To seed the database with data, you can import the contents of the `supabase/seed.csv` file in the Supabase UI.

ℹ️ _Note: If you don’t use a Supabase hosting integration, set the `SUPABASE_DATABASE_URL` and `SUPABASE_ANON_KEY` environment variables in the `.env` file or in your host's environment settings._

### Install and run locally

1. Clone this repository, then run `npm install` in its root directory.

2. For local development, run the Astro dev server:

```
npm run dev
```

3. Code quality and linting:

The project includes comprehensive code quality tools that run automatically in CI:

```bash
npm run lint              # Run ESLint on JavaScript/TypeScript/Astro files
npm run lint:fix          # Auto-fix ESLint issues where possible
npm run lint:contracts    # Run Solhint on Solidity contracts
npm run typecheck         # Run TypeScript type checking
```

These scripts match the checks performed by the Code Quality Analysis workflow.

If you prefer to emulate a production-like environment locally, use your host's recommended tooling (for example, Vercel CLI or Render's local runner).

## Support

If you get stuck along the way, check the Astro docs: https://docs.astro.build/ or Supabase docs: https://supabase.com/docs
