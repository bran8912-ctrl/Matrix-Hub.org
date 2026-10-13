# MTX Wallet and Transfer Utilities

This document describes the MTX wallet integration components and utilities added to the Matrix Hub project.

## MTX Contract Information

- **Status**: ⚠️ **Pending Deployment** - Contract not yet deployed to mainnet
- **Network**: Polygon (Chain ID: 137) - Target network for deployment
- **Symbol**: MTX
- **Decimals**: 18
- **Name**: Matrix Hub Coin
- **Deployment Guide**: See [MTX Deployment Guide](./MTX_Deployment_Guide.md) for deployment instructions

> **Note**: The contract address will be updated here once deployment is complete. Currently using placeholder address in configuration.

## Wallet Connection - Reown AppKit (formerly Web3Modal v3)

Matrix Hub uses [Reown AppKit](https://docs.reown.com/appkit) (formerly Web3Modal v3) for wallet connections. This provides a modern, user-friendly interface for connecting various Polygon wallets.

### Migration from Web3Modal v1

As of January 2026, Matrix Hub has migrated from web3modal v1.9.12 to Reown AppKit v1.8.16. Key changes:

- **New Package**: `@reown/appkit` and `@reown/appkit-adapter-ethers`
- **React Hooks**: Components use `useAppKit`, `useAppKitAccount`, and `useAppKitProvider` hooks
- **Global State**: AppKitProvider wraps the application for shared wallet state
- **WalletConnect Project ID**: Required for production use (get from https://cloud.reown.com)

### Configuration

The wallet configuration is split across two files:

**src/config/appkit.ts** - Core configuration:
```typescript
export const projectId = import.meta.env.PUBLIC_WALLETCONNECT_PROJECT_ID || 'YOUR_PROJECT_ID_HERE'
export const metadata = {
  name: 'Matrix Hub',
  description: 'Matrix Hub - Tools, Modules, and MTX Token Ecosystem',
  url: 'https://matrix-hub.org',
  icons: ['https://matrix-hub.org/favicon.ico']
}
```

**src/components/AppKitProvider.tsx** - Provider component:
- Initializes AppKit modal on client side only
- Configures Polygon connection
- Sets dark theme with Matrix Hub branding

### Environment Variables

Add to your `.env` file:

```bash
PUBLIC_WALLETCONNECT_PROJECT_ID=your_project_id_here
```

Get a free project ID from [Reown Cloud](https://cloud.reown.com) (formerly WalletConnect Cloud).

## Components

### Wallet.jsx

A React island component that provides wallet connection and MTX token balance management using Reown AppKit.

**Features:**
- Connect Polygon wallet via Reown AppKit modal
- Display connected wallet address
- Display MTX token balance
- Add MTX token to wallet (EIP-747)
- Buy MTX on QuickSwap
- **NEW**: Buy MTX via Direct Mint
- Automatic network switching to Polygon
- Handle account and network changes

**Implementation:**
```typescript
import { useAppKitProvider, useAppKitAccount, useAppKit } from '@reown/appkit/react'

const { address, isConnected } = useAppKitAccount()
const { walletProvider } = useAppKitProvider('eip155')
const { open } = useAppKit()
```

**Usage in Astro pages:**
```astro
---
import Wallet from "../components/Wallet.jsx";
---

<Wallet client:only="react" />
```

> **Note**: Must use `client:only="react"` to avoid SSR issues with AppKit hooks.

### BuyMTX.tsx

A React component for purchasing MTX directly with MATIC using the direct mint feature.

**Features:**
- Display current ETH to MTX exchange rate
- Calculate MTX amount based on ETH input
- Send MATIC to contract to mint MTX
- Transaction status feedback
- Security guidance and warnings
- Testnet/Mainnet compatibility

**Usage in Astro pages:**
```astro
---
import BuyMTX from "../components/BuyMTX.tsx";
---

<BuyMTX client:load />
```

## Purchasing MTX

Matrix Hub offers two ways to purchase MTX tokens:

### Option 1: Direct Mint (Recommended for Onboarding)

**How it works:**
1. User sends ETH directly to the MTX contract
2. Contract mints MTX at a fixed rate (1 MATIC = 1,000 MTX)
3. MTX tokens are instantly credited to user's wallet

**Advantages:**
- Lower gas costs (single transaction)
- Fixed, predictable pricing
- Instant minting
- Perfect for small purchases and first-time users
- No slippage or liquidity concerns

**How to use:**
1. Visit `/buy-mtx` page on Matrix Hub
2. Connect your Polygon wallet
3. Enter amount of ETH to spend
4. Click "Buy MTX with MATIC"
5. Confirm transaction in wallet
6. Receive MTX instantly

**Technical details:**
- Contract function: `buyMTX()` (payable)
- Fallback function: `receive()` also works (Send MATIC directly to contract)
- Rate can be updated by contract owner if needed
- Minting can be paused by owner (e.g., for transition to DEX-only)

**Code example:**
```typescript
import { BrowserProvider, Contract, parseEther } from 'ethers';
import { MTX } from '../config/mtx';
import mtxAbi from '../abi/mtx.json';

async function buyMTXDirectMint(ethAmount: string) {
  const provider = new BrowserProvider(window.ethereum);
  const signer = await provider.getSigner();
  const mtxContract = new Contract(MTX.address, mtxAbi, signer);
  
  // Send MATIC to buyMTX function
  const tx = await mtxContract.buyMTX({ value: parseEther(ethAmount) });
  await tx.wait();
  
  return tx.hash;
}
```

### Option 2: QuickSwap DEX (Public Market)

**How it works:**
1. User swaps ETH or other tokens for MTX on QuickSwap
2. Pricing determined by liquidity pool (market rates)
3. Instant settlement

**Advantages:**
- Market-based pricing
- High liquidity for large purchases
- Can swap from any ERC-20 token
- Trusted, battle-tested platform

**How to use:**
1. Visit QuickSwap link from Matrix Hub
2. Connect wallet
3. Select input token and amount
4. Review swap details
5. Confirm transaction

## Utilities

### mtxTransfer.ts

Provides utility functions for MTX token transfers and network management.

#### spendMTX(to, amount)

Transfers MTX tokens from the connected wallet to a specified address.

**Parameters:**
- `to` (string): Recipient Polygon address (e.g., casino vault address)
- `amount` (string): Amount of MTX to transfer in human-readable format (e.g., "10" for 10 MTX)

**Returns:**
- `Promise<string>`: Transaction hash on success

**Throws:**
- Error if wallet not found
- Error if insufficient MTX balance
- Error if user rejects transaction
- Error if transaction fails

**Example:**
```typescript
import { spendMTX } from '../utils/mtxTransfer';

// Transfer 10 MTX to casino vault
try {
  const txHash = await spendMTX('0xCasinoVaultAddress', '10');
  console.log('Transaction successful:', txHash);
} catch (error) {
  console.error('Transfer failed:', error.message);
}
```

#### ensurePolygon()

Ensures the user is connected to the correct Polygon network (based on config). Automatically attempts to switch networks if needed.

**Returns:**
- `Promise<void>`

**Throws:**
- Error if wallet not found
- Error if network not added to wallet
- Error if user rejects network switch

**Example:**
```typescript
import { ensurePolygon } from '../utils/mtxTransfer';

// Ensure correct network before performing operations
try {
  await ensurePolygon();
  // Proceed with blockchain operations
} catch (error) {
  console.error('Network check failed:', error.message);
}
```

## ABI (src/abi/mtx.json)

The MTX token ABI includes the following methods:

**ERC-20 Standard:**
- `balanceOf(address account)`: Read token balance
- `transfer(address to, uint256 amount)`: Transfer tokens
- `decimals()`: Get token decimals (18 for MTX)
- `symbol()`: Get token symbol ("MTX")
- `name()`: Get token name ("Matrix Hub Coin")
- `totalSupply()`: Get total MTX supply
- `burn(uint256 amount)`: Burn MTX tokens

**Direct Mint Features:**
- `buyMTX()`: Purchase MTX with MATIC (payable)
- `ethToMtxRate()`: Get current ETH to MTX exchange rate
- `mintingPaused()`: Check if direct minting is paused
- `MAX_SUPPLY()`: Get maximum MTX supply
- `receive()`: Fallback function for direct ETH sends

**Events:**
- `MTXPurchased(address indexed buyer, uint256 ethAmount, uint256 mtxAmount)`: Emitted on successful purchase

## Configuration

The MTX token configuration is located in `src/config/mtx.ts`:

```typescript
export const MTX = {
  address: "0x0000000000000000000000000000000000000000", // Placeholder until MTX is deployed
  symbol: "MTX",
  decimals: 18,
  chainId: 137, // Polygon
  name: "Matrix Hub Coin",
  maticToMtxRate: 1000, // 1 MATIC = 1,000 MTX
  get uniswapUrl() {
    return `https://app.quickswap.exchange/#/swap?outputCurrency=${this.address}&chain=ethereum`;
  }
};
```

## Integration Example: Casino Betting

Here's an example of how to integrate MTX transfers in a casino game:

```typescript
import { spendMTX } from '../utils/mtxTransfer';
import { MTX } from '../config/mtx';

const CASINO_VAULT_ADDRESS = '0xCasinoVaultAddress'; // Replace with actual vault

async function placeBet(betAmount: number) {
  try {
    // Transfer MTX to casino vault
    const txHash = await spendMTX(CASINO_VAULT_ADDRESS, betAmount.toString());
    
    // Once transaction is confirmed, proceed with game logic
    console.log('Bet placed successfully. TX:', txHash);
    
    // Call backend to record bet and start game
    // ...
    
    return txHash;
  } catch (error) {
    console.error('Failed to place bet:', error.message);
    throw error;
  }
}
```

## Security Considerations

1. **Balance Checking**: The `spendMTX` function checks the user's balance before attempting a transfer to provide better error messages.

2. **Transaction Confirmation**: Transactions wait for 1 block confirmation before returning, ensuring the transaction is mined.

3. **Error Handling**: All functions include comprehensive error handling for common scenarios (wallet not found, insufficient balance, user rejection).

4. **Network Verification**: The `ensurePolygon` function ensures users are on the correct network before performing operations.

5. **No Private Keys**: The utilities never request or handle private keys; all signing is done through the user's wallet.

## Browser Compatibility

Requires:
- Modern browser with ES2020+ support
- MetaMask or compatible Polygon wallet extension
- User approval for wallet connection and transactions

## Dependencies

- ethers.js v6.16.0
- @reown/appkit v1.8.16
- @reown/appkit-adapter-ethers v1.8.16
- React 19.2.3

## Migration Notes

### From Web3Modal v1 to Reown AppKit

**Breaking Changes:**
1. **Package Name**: `web3modal` → `@reown/appkit` + `@reown/appkit-adapter-ethers`
2. **Initialization**: No longer use `new Web3Modal()` - use React hooks instead
3. **Project ID**: WalletConnect Project ID now required
4. **SSR Compatibility**: Components must use `client:only="react"` in Astro

**Code Changes:**
```typescript
// Old (web3modal v1)
import Web3Modal from 'web3modal';
const web3Modal = new Web3Modal();
const connection = await web3Modal.connect();

// New (Reown AppKit)
import { useAppKit, useAppKitAccount, useAppKitProvider } from '@reown/appkit/react'
const { open } = useAppKit()
const { address, isConnected } = useAppKitAccount()
const { walletProvider } = useAppKitProvider('eip155')
```

**Benefits of Migration:**
- Modern, responsive UI with better UX
- Support for more wallets out of the box
- Better mobile wallet support
- Active maintenance and updates
- Improved TypeScript support

### Deprecated Dependencies

See [DEPRECATED_DEPENDENCIES.md](./DEPRECATED_DEPENDENCIES.md) for information about transitive deprecated dependencies (inflight, lodash.isequal, glob) that need parent package updates.
