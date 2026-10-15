# GitHub Actions Workflows

This directory contains automated workflows for the Matrix-Hub.org project. These workflows enable running all project scripts automatically without requiring local setup.

## Available Workflows

### 1. CI - Build and Test (`ci.yml`)

**Triggers:** Push to main/Hub10/develop branches, Pull Requests, Manual

Runs comprehensive checks on every push and PR:
- ✅ **Build Job**: Compiles the Astro site
- 📝 **Content Workflow Job**: Runs content scan, feed generation, and analytics
- 🔨 **Smart Contracts Job**: Compiles Solidity contracts with Hardhat
- 🧪 **Test Job**: Runs Hardhat tests

**Artifacts Generated:**
- `astro-build`: Compiled site in `dist/`
- `content-workflow-outputs`: Generated feeds and analytics
- `contract-artifacts`: Compiled smart contracts

### 2. Run Scripts on Demand (`run-scripts.yml`)

**Triggers:** Manual only (workflow_dispatch)

Allows you to run any project script from the GitHub Actions UI:

**Available Scripts:**
- `content:scan` - Scan all content files
- `content:generate` - Generate public JSON feed
- `content:analytics` - Generate analytics report
- `content:help` - Show content workflow help
- `build` - Build the Astro site
- `compile` - Compile smart contracts
- `test` - Run Hardhat tests

**How to Use:**
1. Go to the "Actions" tab in GitHub
2. Select "Run Scripts on Demand"
3. Click "Run workflow"
4. Choose the script you want to run
5. Optionally enable artifact uploads
6. Click "Run workflow"

### 3. Scheduled Content Updates (`scheduled-content-update.yml`)

**Triggers:** Daily at 2 AM UTC, Manual

Automatically updates content feeds and analytics daily:
- Scans all content files
- Generates public feed
- Creates analytics reports
- Uploads results as artifacts
- Creates an issue if the workflow fails

**Artifacts Generated:**
- `scheduled-content-update-{run_number}`: All generated files

### 4. Smart Contract Deployment (`deploy-contracts.yml`)

**Triggers:** Manual only (workflow_dispatch)

⚠️ **DEPRECATED:** This workflow is for reference only. Use the new workflows instead:
- For testnet: Use `deploy-contracts-testnet.yml`
- For mainnet: Use **manual deployment** (see `DEPLOYMENT_GUIDE.md`)

Guided workflow for deploying smart contracts:

**Safety Features:**
- Requires confirmation for mainnet deployments
- Validates deployment parameters
- Provides deployment checklist
- Shows security notices

**Parameters:**
- `network`: Choose between `sepolia` (testnet) or `mainnet`
- `contract`: Choose between `mtx` or `casino`
- `confirm`: Must type "DEPLOY" for mainnet deployments

**Note:** This workflow compiles contracts and provides deployment instructions. Actual deployment requires setting up secrets (see below).

### 4a. Contract Deployment - Testnet (`deploy-contracts-testnet.yml`)

**Triggers:** Manual only (workflow_dispatch)

**NEW:** Comprehensive automated workflow for testnet deployments of MTX token, casino contracts, and token distribution.

**Features:**
- ✅ Automated deployment to Polygon Amoy testnet (chain ID 80002)
- ✅ Requires Amoy end-to-end testing and independent security-review confirmation
- ✅ Artifact uploads with deployment JSON files
- ✅ Detailed deployment summaries
- ✅ Safety checks and validations
- 🔒 **Testnet-only** - Mainnet is blocked

**Deployment Types:**
- `mtx-only` - Deploy only MTX token contract
- `casino-only` - Deploy only casino contracts (requires existing MTX deployment)
- `distribute-only` - Distribute tokens only (requires both deployments)
- `full-deployment` - Complete deployment sequence (recommended)

**Required Secrets:**
- `TESTNET_PRIVATE_KEY`: Deployer wallet private key (testnet only)
- `AMOY_RPC_URL`: RPC endpoint for Polygon Amoy (optional; public fallback is configured)
- `POLYGONSCAN_API_KEY`: For contract verification (optional)

**Required repository variables for casino deployments:**
- `AMOY_QUICKSWAP_V2_ROUTER_ADDRESS`: Amoy QuickSwap V2 router
- `AMOY_CASINO_MAX_PAYOUT_PER_BET`: Maximum payout in MTX
- `AMOY_VRF_SUBSCRIPTION_ID`: Existing, LINK-funded Amoy subscription owned by the deployer
- `AMOY_MTX_CONTRACT_ADDRESS`: Required for `casino-only`; `full-deployment` uses its newly deployed token

**Artifacts Generated:**
- `mtx-deployment-{network}-{run_number}` - MTX deployment info and logs
- `casino-deployment-{network}-{run_number}` - Casino deployment info and logs
- `mtx-distribution-{network}-{run_number}` - Distribution info and logs
- `compiled-contracts-{run_number}` - Compiled contract artifacts

**How to Use:**
1. Go to the "Actions" tab in GitHub
2. Select "Contract Deployment - Testnet"
3. Click "Run workflow"
5. Choose `full-deployment` to deploy an Amoy test token and casino, or `casino-only` to use an existing Amoy token
6. Optionally skip compilation if using cached artifacts
7. Click "Run workflow"
8. Monitor progress and download artifacts when complete

The workflow does not fund the reserve or seed liquidity. Test VRF-backed wagers and settlement on Amoy before a Polygon release.

**Output Files:**
- `deployments/mtx-amoy.json` - MTX contract address and metadata
- `deployments/casino-amoy.json` - Casino contract addresses and metadata
- `deployments/mtx-distribution-amoy.json` - Distribution records

See `DEPLOYMENT_GUIDE.md` for complete deployment documentation.

### 4b. Contract Deployment - Mainnet (`deploy-contracts-mainnet.yml`)

**Triggers:** Manual only (workflow_dispatch)

**🚨 CRITICAL:** Protected mainnet deployment workflow with multiple safeguards.

**Features:**
- ✅ Casino-only deployment to Polygon mainnet (chain ID 137), using the selected existing MTX token
- ✅ Multiple confirmation requirements before execution
- ✅ Sequential deployment: MTX → Casino → Distribution
- ✅ Artifact uploads with 90-day retention
- ✅ Detailed deployment summaries
- 🔒 **Requires three confirmation strings and should use a protected `polygon-production` GitHub environment**

**Required Confirmations:**
1. **confirmation_string:** Must type `DEPLOY-TO-POLYGON-CONFIRMED`
2. **double_check:** Must type `I-UNDERSTAND-THIS-IS-IRREVERSIBLE`
3. **casino_release_confirmation:** Must type `POLYGON-CASINO-AFTER-AMOY-AND-AUDIT` only after both release gates are complete

**Deployment Type:**
- `casino-only` - Deploy casino modules against the selected existing MTX token

**Required Secrets:**
- `POLYGON_PRIVATE_KEY`: Deployer wallet private key
- `POLYGON_RPC_URL`: Polygon RPC endpoint
- `POLYGONSCAN_API_KEY`: For contract verification

**Required repository variables:**
- `POLYGON_MTX_CONTRACT_ADDRESS`: The selected canonical MTX token
- `POLYGON_QUICKSWAP_V2_ROUTER_ADDRESS`: Polygon QuickSwap V2 router
- `POLYGON_CASINO_MAX_PAYOUT_PER_BET`: Owner-approved maximum payout in MTX
- `POLYGON_VRF_SUBSCRIPTION_ID`: Existing Polygon VRF v2.5 subscription owned by the deployer and funded with official Polygon LINK

**Security Features:**
- ⚠️ Requires exact confirmation strings
- ⚠️ Fails immediately if confirmations don't match
- ⚠️ Separate secrets for mainnet (never use testnet keys)
- ⚠️ 90-day artifact retention for critical mainnet deployments
- ⚠️ Detailed post-deployment action checklist

**Artifacts Generated:**
- `casino-deployment-polygon-{run_number}` - Casino deployment info and logs (90 days)
- `compiled-contracts-mainnet-{run_number}` - Compiled contract artifacts (7 days)

**How to Use:**
1. Go to the "Actions" tab in GitHub
2. Select "Contract Deployment - Mainnet (Protected)"
3. Click "Run workflow"
4. Choose deployment type
5. Type `DEPLOY-TO-POLYGON-CONFIRMED` in confirmation field
6. Type `I-UNDERSTAND-THIS-IS-IRREVERSIBLE` in double-check field
7. Type `POLYGON-CASINO-AFTER-AMOY-AND-AUDIT` only after completing Amoy testing and independent review
8. Ensure the `polygon-production` environment requires an authorized reviewer
9. Click "Run workflow" and download the deployment artifact
10. Verify contracts, fund the reserve, seed liquidity at the approved ratio, test live wagers, and only then update frontend addresses

**⚠️ WARNING:** Polygon transactions are irreversible. Contract deployment alone does not enable wagers; reserve funding, pool seeding, contract verification, and frontend configuration are separate release steps. Test the complete flow on Amoy first.

### 6. Content Validation (`content-validation.yml`)

**Triggers:** Pull Requests that change content files

Automatically validates content quality on PRs:
- Scans modified content files
- Generates analytics
- Checks content health metrics
- Posts results as PR comment
- Uploads error logs

### 7. Code Quality Analysis (`code-quality.yml`)

**Triggers:** Push to Hub10 branch, Pull Requests, Manual

Runs comprehensive code quality checks without requiring external services:

**Quality Checks:**
- 🔍 **TypeScript Type Checking**: Validates types with `@astrojs/check`
- 🔎 **ESLint Analysis**: Checks JavaScript/TypeScript/Astro code quality
- 🔐 **Solidity Linting**: Validates smart contracts with Solhint
- 🔨 **Contract Compilation**: Ensures contracts compile successfully

**Features:**
- No external service dependencies (replaces SonarCloud)
- Detailed job summaries with actionable feedback
- Continues on non-critical errors to provide full feedback
- Memory-optimized for large codebases

**Note:** This workflow replaces the previous `sonarcloud.yml` workflow, eliminating the need for external service tokens and signup.

### 8. Deploy Astro Site to GitHub Pages (`astro-gh-pages.yml`)

**Triggers:** Push to Hub10 branch, Manual

Deploys the Astro site to GitHub Pages:
- Builds the site
- Uploads to GitHub Pages
- Deploys to production

_Note: The `jekyll-gh-pages.yml` workflow is a pre-existing GitHub Pages deployment pipeline and is **not** added or modified by this PR._

### 9. Utility Scripts (`utility-scripts.yml`)

**Triggers:** Manual only (workflow_dispatch)

Runs utility scripts for password generation, music downloads, and deployment fixes:

**Available Scripts:**
- `generate-password-hash` - Generate SHA-256 hash for Owners Portal authentication
  - ⚠️ **Security Warning:** Do NOT pass real passwords via workflow inputs
  - This workflow uses an example password for demonstration only
  - **For real password hashes:** Run the script locally instead
  - **Note:** SHA-256 is vulnerable to brute-force attacks. Consider bcrypt, scrypt, or Argon2 for production
- `get-matrix-music` - Download Matrix Hub music assets from royalty-free sources
  - Downloads music files to `public/music/`
  - Creates credits and playlist files
- `fix-casino-deploy` - Placeholder for future casino deployment fix utility (currently minimal functionality)

**How to Use:**
1. Go to the "Actions" tab in GitHub
2. Select "Utility Scripts"
3. Click "Run workflow"
4. Choose the utility script you want to run
5. Click "Run workflow"

**Artifacts Generated:**
- Script output files
- Metadata files (credits, playlists) for music downloads

### 10. Music Track Scripts (`music-scripts.yml`)

**Triggers:** Manual only (workflow_dispatch)

Runs Python scripts for scraping, parsing, and testing music tracks:

**Available Scripts:**
- `scrape-mixkit-tracks` - Scrape ambient music tracks from Mixkit
  - Requires: Python with `requests` and `beautifulsoup4`
  - Generates: `matrix_tracks_snippet.txt` with track data and `/tmp/matrix_new_tracks.txt`
- `parse-mixkit-tracks` - Parse Mixkit track data into JavaScript objects
  - Reads from `/tmp/matrix_new_tracks.txt` (generated by `scrape-mixkit-tracks`)
  - Must be run **after** `scrape-mixkit-tracks` has completed successfully
  - Outputs JavaScript-formatted track objects
- `scrape-and-parse-mixkit` - Chain scrape and parse together (recommended)
  - Runs both scrape and parse in sequence with real data
  - No manual chaining required
  - Processes live track data from Mixkit
- `test-tracks` - Test music track URLs from `docs/index.html`
  - Validates track URLs are accessible
  - Checks HTTP status and content type
- `test-corsproxy-tracks` - Test CORS proxy track URLs
- `test-fma-tracks` - Test Free Music Archive track URLs
- `test-pixabay-tracks` - Test Pixabay track URLs

**How to Use:**
1. Go to the "Actions" tab in GitHub
2. Select "Music Track Scripts"
3. Click "Run workflow"
4. Choose the music script you want to run
5. Click "Run workflow"

**Artifacts Generated:**
- Script output files
- Generated track data files

## Running Workflows

### From GitHub UI

1. Navigate to the "Actions" tab in the repository
2. Select the workflow you want to run
3. Click "Run workflow" button
4. Fill in any required parameters
5. Click "Run workflow" to start

### Viewing Results

1. Go to the "Actions" tab
2. Click on a workflow run
3. View the summary and logs
4. Download artifacts if available

## Setting Up Secrets for Deployment

For smart contract deployments, you need to set up repository secrets:

1. Go to Settings → Secrets and variables → Actions
2. Add the following secrets:
   - `PRIVATE_KEY`: Deployer wallet private key
   - `INFURA_API_KEY` or `ALCHEMY_API_KEY`: RPC provider API key
   - `ETHERSCAN_API_KEY`: For contract verification

**Security Warning:** Never commit private keys to the repository!

## Workflow Status Badges

Add these to your README to show workflow status:

```markdown
![CI](https://github.com/bran8912-ctrl/Matrix-Hub.org/actions/workflows/ci.yml/badge.svg)
![Code Quality](https://github.com/bran8912-ctrl/Matrix-Hub.org/actions/workflows/code-quality.yml/badge.svg)
![Content Validation](https://github.com/bran8912-ctrl/Matrix-Hub.org/actions/workflows/content-validation.yml/badge.svg)
![Deploy to GitHub Pages](https://github.com/bran8912-ctrl/Matrix-Hub.org/actions/workflows/jekyll-gh-pages.yml/badge.svg)
```

## Artifacts

Workflows generate artifacts that can be downloaded:

- **Build Artifacts** (7 days retention):
  - Compiled Astro site
  - Script outputs
  - Compiled smart contracts

- **Content Artifacts** (30 days retention):
  - Public feeds
  - Analytics reports
  - Error logs

To download artifacts:
1. Go to a workflow run
2. Scroll to the "Artifacts" section at the bottom
3. Click on an artifact to download

## Troubleshooting

### Workflow Failed

1. Check the workflow logs in the Actions tab
2. Look for error messages in the failed job
3. Check if dependencies need updating
4. Verify that all required secrets are set

### Script Not Running

1. Ensure the script exists in `package.json`
2. Check that dependencies are installed correctly
3. Verify Node.js version compatibility (requires Node 18+)

### Deployment Issues

1. Verify all secrets are configured correctly
2. Check network configuration in `hardhat.config.js`
3. Ensure deployer wallet has sufficient funds
4. Review Hardhat documentation for network-specific issues

## Best Practices

1. **Use workflow_dispatch** for potentially destructive operations
2. **Review logs** for all workflow runs
3. **Download artifacts** for important builds
4. **Monitor scheduled workflows** to ensure they run successfully
5. **Update workflows** when adding new scripts or changing project structure

## Contributing

When adding new scripts or workflows:

1. Add the script to `package.json`
2. Update the "Run Scripts on Demand" workflow options
3. Update this README with documentation
4. Test the workflow before merging

## Support

For issues with workflows:
- Check workflow logs in the Actions tab
- Review this README for common solutions
- Open an issue if you need help

---

**Matrix-Hub.org** - Signal Over Noise 🌟
