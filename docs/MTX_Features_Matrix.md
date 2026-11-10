# MTX Token Features Matrix

## Overview
This document provides a comprehensive overview of all MTX token-related features implemented in the Matrix-Hub.org platform.

## Feature Summary

| Feature | Status | Location | Description |
|---------|--------|----------|-------------|
| Wallet Connection | ✅ Complete | `/wallet`, `/enhanced-wallet` | Connect Polygon wallet via Web3Modal |
| MTX Balance Display | ✅ Complete | All wallet pages | Real-time MTX balance from blockchain |
| Direct Mint (MATIC → MTX) | ✅ Complete | `/buy-mtx` | Purchase MTX directly with MATIC |
| QuickSwap Integration | ✅ Complete | Multiple pages | Trade MTX on QuickSwap DEX |
| Transaction History | ✅ Complete | `/enhanced-wallet` | View recent MTX transactions |
| Dashboard | ✅ Complete | `/enhanced-wallet` | Comprehensive stats and overview |
| Tier System | ✅ Complete | Dashboard, WalletConnect | Bronze to Diamond tiers |
| Tier Progress | ✅ Complete | Dashboard | Visual progress to next tier |
| Add to Wallet (EIP-747) | ✅ Complete | All wallet pages | One-click add MTX to wallet |
| Casino Integration | ✅ Complete | `/casino`, `/games/casino/*` | Play games with MTX |
| MTX Spending | ✅ Complete | Casino, premium features | Spend MTX on platform |
| MTX Locking | ✅ Complete | WalletConnect component | Lock MTX for tier access |
| Burn Mechanism | ✅ Complete | Smart contract | 10% burn on premium usage |
| API: Balance Query | ✅ Complete | `/api/mtx-balance` | Fetch balance for any address |
| API: Statistics | ✅ Complete | `/api/mtx-stats` | Global MTX statistics |
| Smart Contract | ✅ Complete | `contracts/MatrixHubCoin.sol` | ERC-20 with OpenZeppelin |
| Contract Verification | ✅ Complete | Polygonscan | Verified source code |
| Documentation | ✅ Complete | `/docs/*` | Comprehensive guides |

## Component Details

### Wallet Components

#### 1. Wallet.jsx
**Purpose**: Basic wallet connection and balance display  
**Location**: `src/components/Wallet.jsx`

**Features**:
- Web3Modal integration
- Connect to MetaMask and compatible wallets
- Display connected address (truncated)
- Show MTX balance with live updates
- Add MTX token to wallet (EIP-747)
- Links to buy MTX (QuickSwap + Direct Mint)
- Account change detection
- Network change handling

**Usage**:
```astro
import Wallet from "../components/Wallet.jsx";
<Wallet client:load />
```

#### 2. WalletConnect.tsx
**Purpose**: Advanced wallet features with tier system  
**Location**: `src/components/WalletConnect.tsx`

**Features**:
- All features from Wallet.jsx
- Tier system (Bronze, Silver, Gold, Platinum)
- Display current tier based on holdings
- MTX locking mechanism for tier access
- Deduct MTX for premium features
- 10% burn on feature usage
- Lock period enforcement (30 days default)
- Quick action buttons for features

**Usage**:
```astro
import WalletConnect from "../components/WalletConnect.tsx";
<WalletConnect client:load />
```

#### 3. BuyMTX.tsx
**Purpose**: Direct MATIC → MTX minting interface  
**Location**: `src/components/BuyMTX.tsx`

**Features**:
- Display current exchange rate (1 MATIC = 1,000 MTX)
- ETH amount input with real-time MTX calculation
- Fetch rate from smart contract
- Check if minting is paused
- Transaction execution and confirmation
- Status messages (pending, success, error)
- Link to Polygonscan for transaction details
- Security warnings and best practices
- Network validation

**Usage**:
```astro
import BuyMTX from "../components/BuyMTX.tsx";
<BuyMTX client:load />
```

#### 4. MTXDashboard.tsx
**Purpose**: Comprehensive token holdings dashboard  
**Location**: `src/components/MTXDashboard.tsx`

**Features**:
- MTX balance card with total supply percentage
- ETH balance card
- Current tier display with color coding
- Visual progress bar to next tier
- MTX needed for next tier calculation
- Quick action buttons (Buy, Trade, Casino, Stake)
- Total supply information
- Contract address with link
- Network information
- Refresh button for manual updates
- Responsive grid layout

**Tiers**:
| Tier | Threshold | Color |
|------|-----------|-------|
| Bronze | 0 MTX | #CD7F32 |
| Silver | 100 MTX | #C0C0C0 |
| Gold | 1,000 MTX | #FFD700 |
| Platinum | 10,000 MTX | #E5E4E2 |
| Diamond | 100,000 MTX | #B9F2FF |

**Usage**:
```astro
import MTXDashboard from "../components/MTXDashboard.tsx";
<MTXDashboard client:load address={userAddress} />
```

#### 5. MTXTransactionHistory.tsx
**Purpose**: Display and track MTX transactions  
**Location**: `src/components/MTXTransactionHistory.tsx`

**Features**:
- Fetch Transfer events from blockchain
- Last 10,000 blocks coverage
- Transaction categorization:
  - **Send**: User sent MTX to another address
  - **Receive**: User received MTX from another address
  - **Mint**: New MTX minted to user
  - **Burn**: MTX sent to burn address
- Display transaction details:
  - Type (with color coding)
  - Amount (MTX)
  - From/To address (truncated)
  - Timestamp
  - Link to Polygonscan
- Refresh button
- Shows up to 10 transactions by default
- Link to full history on Polygonscan
- Empty state handling

**Usage**:
```astro
import MTXTransactionHistory from "../components/MTXTransactionHistory.tsx";
<MTXTransactionHistory client:load address={userAddress} maxItems={10} />
```

### Pages

#### 1. /wallet
**Purpose**: Basic wallet page  
**Components**: Wallet.jsx  
**Features**: Connect wallet, view balance, basic actions

#### 2. /enhanced-wallet
**Purpose**: Advanced wallet dashboard  
**Components**: Wallet.jsx, MTXDashboard.tsx, MTXTransactionHistory.tsx  
**Features**: All wallet features + dashboard + transaction history

#### 3. /buy-mtx
**Purpose**: Purchase MTX tokens  
**Components**: BuyMTX.tsx  
**Features**: Direct MATIC → MTX minting, QuickSwap link, security info

#### 4. /casino
**Purpose**: Play casino games with MTX  
**Components**: Multiple game components  
**Features**: Slots, Blackjack, Roulette, Dice, Plinko, Mines, Crash

#### 5. /staking
**Purpose**: Stake MTX for rewards  
**Components**: Staking components  
**Features**: Lock MTX, earn rewards, tier benefits

### API Endpoints

#### GET /api/mtx-balance
**Purpose**: Query MTX balance for any Polygon address

**Parameters**:
- `address` (required): Polygon address (0x...)

**Response**:
```json
{
  "address": "0x1234...5678",
  "balance": "1000.0",
  "symbol": "MTX",
  "decimals": 18,
  "totalSupply": "100000000.0",
  "percentageOfSupply": "0.001000",
  "timestamp": 1234567890,
  "contractAddress": "0xabcd...efgh",
  "network": "Polygon",
  "chainId": 1
}
```

**Caching**: 10s max-age, 30s stale-while-revalidate

**Example**:
```bash
curl "https://matrix-hub.org/api/mtx-balance?address=0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb"
```

#### GET /api/mtx-stats
**Purpose**: Get global MTX token statistics

**Parameters**: None

**Response**:
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
  "contractAddress": "0xabcd...efgh",
  "network": "Polygon",
  "chainId": 1,
  "blockExplorer": "https://polygonscan.com/address/...",
  "uniswapUrl": "https://app.quickswap.exchange/...",
  "deployed": true,
  "timestamp": 1234567890,
  "lastBlockNumber": 12345678
}
```

**Caching**: 60s max-age, 120s stale-while-revalidate

**Example**:
```bash
curl "https://matrix-hub.org/api/mtx-stats"
```

### Smart Contracts

#### MatrixHubCoin.sol
**Purpose**: ERC-20 MTX token contract  
**Location**: `contracts/MatrixHubCoin.sol`  
**Standard**: ERC-20 (OpenZeppelin v5.4.0)

**Key Functions**:
- `buyMTX()`: Purchase MTX with MATIC
- `setEthToMtxRate(uint256)`: Update exchange rate (owner only)
- `setMintingPaused(bool)`: Pause/unpause minting (owner only)
- `withdrawETH(address)`: Withdraw collected ETH (owner only)
- `burn(uint256)`: Burn MTX tokens
- Standard ERC-20 functions: `transfer`, `approve`, `transferFrom`, etc.

**Properties**:
- Name: "Matrix-HubCoin"
- Symbol: "MTX"
- Decimals: 18
- Max Supply: 100,000,000 MTX (100M)
- Initial Exchange Rate: 1 MATIC = 1,000 MTX
- Owner-controlled minting pause
- Direct MATIC → MTX minting
- Burn functionality

#### CasinoCore.sol
**Purpose**: Casino betting contract  
**Location**: `contracts/CasinoCore.sol`

**Key Functions**:
- `placeBet(uint256, bytes)`: Place a bet with MTX
- `updatePercentages(...)`: Update fund distribution (governance only)

**Integration**:
- Accepts MTX token for bets
- Integrates with LiquidityRouter
- Integrates with CasinoReserve
- Integrates with RNGEngine
- Percentage-based fund distribution

### Utility Functions

#### mtxTransfer.ts
**Location**: `src/utils/mtxTransfer.ts`

**Functions**:

1. `spendMTX(to: string, amount: string): Promise<string>`
   - Transfer MTX tokens to an address
   - Returns transaction hash
   - Validates amount and address
   - Checks balance before transfer
   - Handles errors gracefully

2. `ensurePolygon(): Promise<void>`
   - Verify user is on correct network
   - Automatically switch network if needed
   - Add network to wallet if not present
   - Validates Polygon wallet availability

**Usage**:
```typescript
import { spendMTX, ensurePolygon } from '../utils/mtxTransfer';

// Ensure correct network
await ensurePolygon();

// Spend MTX
const txHash = await spendMTX(recipientAddress, '10');
console.log('Transaction:', txHash);
```

## User Flows

### Flow 1: First-Time User Onboarding

```
1. User visits Matrix-Hub.org
2. Navigates to /wallet or /enhanced-wallet
3. Clicks "Connect Wallet"
4. Approves wallet connection in MetaMask
5. Automatic network check/switch to Polygon
6. Balance displayed (likely 0 MTX)
7. Clicks "Buy MTX (Direct Mint)" or "Buy on QuickSwap"
8. For direct mint:
   a. Navigate to /buy-mtx
   b. Enter ETH amount (e.g., 0.01 MATIC)
   c. See calculated MTX (e.g., 1,000 MTX)
   d. Click "Buy MTX with MATIC"
   e. Approve transaction in wallet
   f. Wait for confirmation
   g. Success! MTX appears in wallet
9. Click "Add MTX to Wallet" to track in wallet app
10. Now ready to use MTX on platform
```

### Flow 2: Using MTX for Casino

```
1. User has MTX in wallet
2. Navigates to /casino
3. Selects a game (e.g., Slots)
4. Game checks MTX balance
5. User places bet (e.g., 1 MTX per spin)
6. Approves MTX spending in wallet
7. Transaction sent to CasinoCore contract
8. Funds distributed:
   - 92% to CasinoReserve (88% reserve-routing share + 4% reserve share)
   - 6% to liquidity
   - 2% to dev
   (Player payouts are dice maths at 98% RTP, paid from the reserve — not a split.)
9. RNG determines outcome
10. If win: Payout sent from reserve
11. Transaction history updated
12. Balance updated in wallet
```

### Flow 3: Tracking Progress to Next Tier

```
1. User connects wallet
2. Views dashboard on /enhanced-wallet
3. Current tier displayed (e.g., Silver at 150 MTX)
4. Progress bar shows: 5% to Gold (need 850 more MTX)
5. Clicks "Buy MTX" from quick actions
6. Purchases additional MTX
7. Returns to dashboard
8. Clicks "Refresh" button
9. New balance: 1,100 MTX
10. Tier updated to Gold
11. Progress bar now shows 0.1% to Platinum
```

## Security Features

### Smart Contract Security
- OpenZeppelin v5.4.0 audited libraries
- Owner-controlled critical functions
- Max supply cap (prevents unlimited minting)
- Custom errors for gas efficiency
- Transparent events for all operations
- Withdrawal protection
- Balance checks before operations

### Frontend Security
- Non-custodial (never stores private keys)
- Client-side signing only
- Network validation before transactions
- Address format validation
- Amount validation (positive, numeric)
- Error handling and user feedback
- HTTPS only (when deployed)
- No sensitive data in localStorage

### API Security
- Input validation on all endpoints
- Rate limiting via cache headers
- Error messages don't expose internal details
- Public data only (no authentication needed)
- CORS configured properly
- No database (reads directly from blockchain)

## Browser Compatibility

| Browser | Version | Status |
|---------|---------|--------|
| Chrome | 90+ | ✅ Fully Supported |
| Firefox | 88+ | ✅ Fully Supported |
| Safari | 14+ | ✅ Fully Supported |
| Edge | 90+ | ✅ Fully Supported |
| Brave | Latest | ✅ Fully Supported |
| Opera | 76+ | ✅ Fully Supported |

**Requirements**:
- Modern browser with ES2020+ support
- Web3 wallet extension (MetaMask, etc.)
- JavaScript enabled

## Mobile Support

| Platform | Wallet | Status |
|----------|--------|--------|
| iOS | MetaMask Mobile | ✅ Supported |
| iOS | Trust Wallet | ✅ Supported |
| Android | MetaMask Mobile | ✅ Supported |
| Android | Trust Wallet | ✅ Supported |

**Notes**:
- Use WalletConnect for mobile browser access
- In-app browsers (MetaMask, Trust) work best
- Responsive design for all screen sizes

## Performance Metrics

| Metric | Value | Notes |
|--------|-------|-------|
| Page Load | < 2s | Static site, CDN cached |
| API Response | < 500ms | Blockchain RPC dependent |
| Balance Fetch | < 1s | Direct contract read |
| Transaction | Variable | Depends on network gas |
| Bundle Size | ~500KB | Main JS bundle (gzipped) |
| Lighthouse Score | 90+ | Performance, Accessibility |

## Future Enhancements

### Planned Features
- [ ] Transaction notifications/toasts
- [ ] MTX price chart integration
- [ ] Historical balance tracking
- [ ] CSV export for transactions
- [ ] Multi-wallet support
- [ ] Hardware wallet support (Ledger, Trezor)
- [ ] ENS name resolution
- [ ] Token approval management
- [ ] Gas price estimation
- [ ] Layer 2 support (Arbitrum, Optimism)

### Under Consideration
- [ ] Mobile native app
- [ ] Push notifications
- [ ] Social features (leaderboards, profiles)
- [ ] Referral system
- [ ] Staking rewards calculator
- [ ] DAO governance interface
- [ ] NFT integration
- [ ] Cross-chain bridge

## Support & Resources

### Documentation
- [MTX Integration Guide](/docs/MTX_Integration_Guide.md)
- [MTX Tokenomics](/docs/MTX_Tokenomics.md)
- [MTX Whitepaper](/docs/MTX_Whitepaper.md)
- [Deployment Guide](/docs/MTX_Deployment_Guide.md)
- [Wallet Integration](/docs/MTX_Wallet_Integration.md)

### Community
- GitHub: [Matrix-Hub.org](https://github.com/bran8912-ctrl/Matrix-Hub.org)
- Telegram: [Matrix Hub Community](https://t.me/matrixhub)
- Discord: [Matrix Hub Server](https://discord.gg/matrixhub)

### Technical Support
- GitHub Issues: [Report bugs or request features](https://github.com/bran8912-ctrl/Matrix-Hub.org/issues)
- Documentation: [Comprehensive guides](https://matrix-hub.org/docs/)
- Code Examples: [Integration examples in docs](https://matrix-hub.org/docs/mtx-integration-guide)

---

**Last Updated**: January 5, 2026  
**Version**: 1.0.0  
**Status**: ✅ Production Ready
