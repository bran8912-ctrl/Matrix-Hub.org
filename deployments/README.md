# Deployments Directory

This directory stores deployment artifacts for Matrix-Hub.org smart contracts.

## Files

After deployment, you will find the following JSON files here:

- `mtx-{network}.json` - MTX token deployment info
- `casino-{network}.json` - Casino contracts deployment info
- `mtx-distribution-{network}.json` - Token distribution records

Where `{network}` is one of: `amoy`, `polygon`, `localhost`

## Structure

Each deployment file contains:

```json
{
  "network": "amoy",
  "chainId": 80002,
  "contractAddress": "0x...",
  "deployer": "0x...",
  "deploymentTime": "2026-01-06T...",
  "transactionHash": "0x...",
  "blockNumber": 12345,
  ...
}
```

## Usage

These files are:

1. **Used by deployment scripts** - Later scripts read earlier deployment files to get contract addresses
2. **Uploaded as artifacts** - GitHub Actions uploads these as downloadable artifacts
3. **Git-ignored by default** - Not committed to repository (see `.gitignore`)
4. **Essential for verification** - Used for Polygonscan contract verification

## Security Note

⚠️ **Important:** While these files contain public blockchain data (addresses, transaction hashes), they should be:

- Backed up securely
- Reviewed before sharing
- Kept private until contracts are verified on block explorer

Never share files containing private keys or sensitive configuration.

---

**Matrix-Hub.org** - Signal Over Noise 🌟
