# MTX Tokenomics

## Contract Information
- **Status**: 🔄 **Deploying to Polygon** — Contract address will be published on launch
- **Network**: Polygon (Chain ID: 137)
- **Symbol**: MTX
- **Decimals**: 18

## Supply
- Fixed Max Supply
- No infinite minting (capped at deployment)
- No [rebasing](https://en.wikipedia.org/wiki/Rebase_token)
- Direct mint available at fixed rate until max supply reached

## Distribution
- [Liquidity](https://en.wikipedia.org/wiki/Market_liquidity) Bootstrap
- Ecosystem Reserve
- Development Allocation
- Community Incentives
- Direct mint purchases (MATIC → MTX)

## Acquisition Methods

### 1. Direct Mint (Primary Onboarding Method)
- **Rate**: 1 MATIC = 1,000 MTX (fixed)
- **Method**: Send MATIC to contract, receive MTX instantly
- **Advantages**: 
  - Lower gas costs than DEX swaps
  - Predictable pricing
  - Perfect for small purchases
  - Instant settlement
- **Limitations**: Subject to max supply cap
- **Owner Controls**: Can pause minting or adjust rate if needed

### 2. QuickSwap DEX (Public Market)
- **Rate**: Market-determined via liquidity pool
- **Method**: Swap ETH or any ERC-20 for MTX
- **Advantages**:
  - High liquidity
  - Trusted platform
  - Flexible amounts
  - Any token swap
- **Considerations**: Subject to slippage on large trades

### 3. Earn Through Platform (Free)
- Usage milestones
- Bug reports and testing
- GitHub contributions (merged PRs)
- Community participation
- Casino winnings

## Emissions
- No staking inflation
- No [yield farming](https://en.wikipedia.org/wiki/Yield_farming) emissions
- Circulation driven by usage
- Direct mint provides controlled token distribution
- Collected ETH can fund liquidity and operations

## Token Sinks (Supply Reduction)
- Lock mechanism for tier access
- Casino gameplay (balanced by casino payouts)

No burn is currently wired into any live flow: `MatrixHubCoin.burn()`
exists but nothing calls it, so do not present burning as an active sink
until a burn is actually implemented and verified.

## Casino fee routing (verified against CasinoCore.sol)

Each Dice bet's MTX is routed on receipt: 88% reserve-routing share
(`payoutPercent` — a reserve-routing share, not a player payout) + 4%
reserve share = **92% to CasinoReserve**; 6% queued for liquidity; 2% to
the developer address. Winning players are paid from the reserve per dice
maths (98% RTP), not from a percentage split. The previously published
85/10/3/2 split was false. No MTX is burned by the casino.

## Economic Design
- Direct mint provides onboarding liquidity while maintaining price stability
- DEX provides exit liquidity and market discovery
- Dual purchase options reduce friction for new users
- Fixed rate mint prevents speculative pumps during onboarding phase
- Owner can pause minting to transition to DEX-only if needed

MTX value is supported by [utility](https://en.wikipedia.org/wiki/Utility_token) and liquidity — not hype.

---

**Related Documentation:**
- [MTX Whitepaper](/docs/mtx-whitepaper)
- [MTX Wallet Integration](/docs/MTX_Wallet_Integration)
- [Casino Game Math](/docs/casino-game-math)
- [DAO Governance](/docs/dao-governance)
