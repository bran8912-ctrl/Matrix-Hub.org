# MTX Token Integration Guide

## Overview

This guide covers the complete MTX (Matrix Hub Coin) token integration, including wallet connection, transaction tracking, and dashboard functionality.

## Architecture

### Frontend Components

#### 1. **Wallet.jsx** - Basic Wallet Connection
- Location: `src/components/Wallet.jsx`
- Purpose: Connect wallet and display MTX balance
- Features:
  - Web3Modal integration
  - MTX balance display
  - Add token to wallet (EIP-747)
  - Buy links (QuickSwap + Direct Mint)

#### 2. **WalletConnect.tsx** - Advanced Wallet Features
- Location: `src/components/WalletConnect.tsx`
- Purpose: Extended wallet functionality
- Features:
  - Tier system based on holdings
  - MTX locking mechanism
  - Deduct/spend MTX
  - Tier progress tracking

#### 3. **BuyMTX.tsx** - Direct Minting Interface
- Location: `src/components/BuyMTX.tsx`
- Purpose: Direct MATIC → MTX minting
- Features:
  - Live exchange rate display
  - ETH input with MTX calculation
  - Transaction status tracking
  - Security warnings
  - Link to Polygonscan

#### 4. **MTXDashboard.tsx** - Comprehensive Dashboard
- Location: `src/components/MTXDashboard.tsx`
- Purpose: Complete token holdings overview
- Features:
  - MTX and ETH balance cards
  - Current tier display with color coding
  - Progress bar to next tier
  - Quick action buttons
  - Total supply and percentage owned
  - Contract information

#### 5. **MTXTransactionHistory.tsx** - Transaction Viewer
- Location: `src/components/MTXTransactionHistory.tsx`
- Purpose: Display recent transactions
- Features:
  - Fetch Transfer events from blockchain
  - Categorize transactions (send, receive, mint, burn)
  - Display amounts and timestamps
  - Link to Polygonscan for details
  - Refresh capability
  - Last 10,000 blocks coverage

### Backend API Endpoints

#### 1. **GET /api/mtx-balance**
- Purpose: Fetch MTX balance for any address
- Parameters:
  - `address` (required): Polygon address
- Returns:
  ```json
  {
    "address": "0x...",
    "balance": "1000.0",
    "symbol": "MTX",
    "decimals": 18,
    "totalSupply": "100000000.0",
    "percentageOfSupply": "0.001000",
    "timestamp": 1234567890,
    "contractAddress": "0x...",
    "network": "Polygon",
    "chainId": 1
  }
  ```
- Cache: 10s with 30s stale-while-revalidate

#### 2. **GET /api/mtx-stats**
- Purpose: Get global MTX token statistics
- Parameters: None
- Returns:
  ```json
  {
    "name": "Matrix-HubCoin",
    "symbol": "MTX",
    "decimals": 18,
    "totalSupply": "100000000.0",
    "circulatingSupply": "99000000.0",
    "burnedSupply": "1000000.0",
    "mintingPaused": false,
    "ethToMtxRate": 100000,
    "contractAddress": "0x...",
    "network": "Polygon",
    "chainId": 1,
    "blockExplorer": "https://polygonscan.com/address/0x...",
    "uniswapUrl": "https://app.quickswap.exchange/...",
    "deployed": true,
    "timestamp": 1234567890,
    "lastBlockNumber": 12345678
  }
  ```
- Cache: 60s with 120s stale-while-revalidate

#### 3. **GET /api/daily-drops**
- Purpose: Affiliate deals and promotions
- Location: `src/pages/api/daily-drops.ts`
- Returns: Featured deals and discount codes

### Smart Contracts

#### 1. **MatrixHubCoin.sol** - ERC20 Token
- Location: `contracts/MatrixHubCoin.sol`
- Standard: ERC-20 with OpenZeppelin v5.4.0
- Features:
  - Direct MATIC → MTX minting
  - Owner-controlled minting pause
  - Adjustable exchange rate
  - Max supply cap
  - Burn functionality
  - ETH withdrawal for liquidity

#### 2. **CasinoCore.sol** - Casino Integration
- Location: `contracts/CasinoCore.sol`
- Purpose: MTX-based casino operations
- Features:
  - MTX betting
  - Percentage-based fund distribution
  - Integration with RNG and reserve

### Utility Functions

#### mtxTransfer.ts
- Location: `src/utils/mtxTransfer.ts`
- Functions:
  - `spendMTX(to, amount)`: Transfer MTX tokens
  - `ensurePolygon()`: Verify/switch to correct network
- Used by: Casino games, premium features

### Configuration

#### mtx.ts
- Location: `src/config/mtx.ts`
- Exports: `MTX` configuration object
- Properties:
  - `address`: Contract address
  - `symbol`: "MTX"
  - `decimals`: 18
  - `chainId`: 1 (Polygon)
  - `ethToMtxRate`: 100000
  - `rpcUrls`: Public RPC endpoints
  - `blockExplorerUrls`: Polygonscan
  - `uniswapUrl`: QuickSwap swap link
  - `isDeployed`: Deployment status

### ABI Files

- Location: `src/abi/`
- Files:
  - `mtx.json`: MatrixHubCoin ABI
  - `CasinoCore.json`: Casino contract ABI
  - `CasinoReserve.json`: Reserve contract ABI
  - `RNGEngine.json`: RNG contract ABI

## User Flows

### 1. Connecting Wallet

```
User → Click "Connect Wallet"
     → Web3Modal opens
     → Select wallet (MetaMask, etc.)
     → Approve connection
     → Automatic network check/switch
     → Display address and balance
```

### 2. Buying MTX (Direct Mint)

```
User → Visit /buy-mtx page
     → Enter ETH amount
     → See calculated MTX amount
     → Click "Buy MTX with MATIC"
     → Approve transaction in wallet
     → Wait for confirmation
     → MTX minted to wallet
     → Success message + Polygonscan link
```

### 3. Viewing Dashboard

```
User → Connect wallet
     → Visit /enhanced-wallet
     → Dashboard loads automatically
     → See balance, tier, progress
     → View recent transactions
     → Use quick action buttons
```

### 4. Tracking Transactions

```
User → Connect wallet
     → Dashboard fetches Transfer events
     → Events processed and categorized
     → Display in table format
     → Click "View" for Polygonscan details
     → Click "Refresh" for latest data
```

## Tier System

| Tier | Threshold | Color | Benefits |
|------|-----------|-------|----------|
| Bronze | 0 MTX | #CD7F32 | Basic access |
| Silver | 100 MTX | #C0C0C0 | Standard features |
| Gold | 1,000 MTX | #FFD700 | Premium features |
| Platinum | 10,000 MTX | #E5E4E2 | Advanced features |
| Diamond | 100,000 MTX | #B9F2FF | All features unlocked |

## Security Considerations

### Smart Contracts
- Uses OpenZeppelin v5.4.0 (audited libraries)
- Owner-controlled functions for safety
- Max supply cap prevents unlimited minting
- Custom errors for gas efficiency

### Frontend
- Non-custodial (never stores private keys)
- Direct blockchain interaction
- Client-side signing only
- Network validation before transactions
- Address validation on all inputs

### API
- Rate limiting via cache headers
- Input validation on all endpoints
- Error handling and logging
- No authentication required (public data)

## Deployment Checklist

### Prerequisites
- [ ] Node.js v18.14+
- [ ] Polygon wallet with MATIC for gas
- [ ] Polygonscan API key (for verification)
- [ ] RPC endpoint (or use public)

### Contract Deployment
1. Set environment variables:
   ```bash
   PRIVATE_KEY=your_private_key_without_0x
   ETHERSCAN_API_KEY=your_etherscan_api_key
   ```

2. Deploy MTX token:
   ```bash
   npm run deploy:amoy  # Testnet first!
   # OR
   npm run deploy:polygon  # Production
   ```

3. Verify contract:
   ```bash
   npm run verify:amoy CONTRACT_ADDRESS "100000000" "0xOWNER_ADDRESS"
   ```

4. Update `src/config/mtx.ts` with deployed address

### Frontend Configuration
1. Set `MTX_CONTRACT_ADDRESS` environment variable
2. Or update `src/config/mtx.ts` directly
3. Build and deploy:
   ```bash
   npm run build
   ```

### Testing
1. Connect testnet wallet (Amoy)
2. Test wallet connection
3. Test direct mint with testnet ETH
4. Verify balance updates
5. Check transaction history
6. Test tier progress
7. Verify Polygonscan links

## Usage Examples

### Using MTX in Custom Components

```typescript
import { MTX } from '../config/mtx';
import { spendMTX } from '../utils/mtxTransfer';

// Check if user has enough MTX
async function checkBalance(userAddress: string): Promise<boolean> {
  const response = await fetch(`/api/mtx-balance?address=${userAddress}`);
  const data = await response.json();
  return parseFloat(data.balance) >= requiredAmount;
}

// Spend MTX for a feature
async function useFeature() {
  try {
    const txHash = await spendMTX(recipientAddress, '10');
    console.log('MTX spent! Tx:', txHash);
    // Activate feature
  } catch (error) {
    console.error('Failed to spend MTX:', error);
  }
}
```

### Fetching MTX Stats

```typescript
// Get global stats
async function getStats() {
  const response = await fetch('/api/mtx-stats');
  const stats = await response.json();
  
  console.log('Total Supply:', stats.totalSupply);
  console.log('Burned:', stats.burnedSupply);
  console.log('Minting Paused:', stats.mintingPaused);
}
```

### Adding MTX to Wallet

```typescript
async function addTokenToWallet() {
  if (!window.ethereum) return;
  
  await window.ethereum.request({
    method: 'wallet_watchAsset',
    params: {
      type: 'ERC20',
      options: {
        address: MTX.address,
        symbol: MTX.symbol,
        decimals: MTX.decimals,
      },
    },
  });
}
```

## Troubleshooting

### Issue: "Contract not deployed"
- **Solution**: Deploy contract first or update address in `src/config/mtx.ts`

### Issue: "Failed to connect wallet"
- **Solution**: Install MetaMask or compatible wallet
- Check network (should be Polygon)
- Try refreshing the page

### Issue: "Insufficient MTX balance"
- **Solution**: Buy MTX via direct mint or QuickSwap
- Check you're on the correct network
- Verify wallet is connected

### Issue: "Transaction failed"
- **Solution**: Check you have enough ETH for gas
- Verify contract address is correct
- Ensure minting is not paused (for direct mint)
- Try increasing gas price

### Issue: "No transactions showing"
- **Solution**: Transactions may not have occurred in last 10k blocks
- Check Polygonscan for full history
- Click "Refresh" to fetch latest data
- Ensure wallet is connected

## API Reference

### Fetch Balance
```bash
curl "https://matrix-hub.org/api/mtx-balance?address=0xYOUR_ADDRESS"
```

### Fetch Stats
```bash
curl "https://matrix-hub.org/api/mtx-stats"
```

## Related Documentation

- [MTX Tokenomics](/docs/MTX_Tokenomics.md)
- [MTX Whitepaper](/docs/MTX_Whitepaper.md)
- [Deployment Guide](/docs/MTX_Deployment_Guide.md)
- [Casino Architecture](/docs/MTX_Casino_Architecture.md)
- [Wallet Integration](/docs/MTX_Wallet_Integration.md)

## Support

For issues or questions:
- GitHub Issues: [Matrix-Hub.org Issues](https://github.com/bran8912-ctrl/Matrix-Hub.org/issues)
- Documentation: [docs/](https://matrix-hub.org/docs/)
- Community: [Telegram](https://t.me/matrixhub)

## Version History

- **v1.0.0** (2024-01-05): Initial integration
  - Basic wallet connection
  - Direct mint interface
  - Dashboard and transaction history
  - API endpoints
  - Complete documentation

---

**Last Updated**: January 5, 2026
**Status**: ✅ Production Ready
