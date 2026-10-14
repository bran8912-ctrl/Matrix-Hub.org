# MTX Casino Architecture

## Initial release scope

The first VRF-backed release supports only a single-round Dice wager. Slots,
blackjack, roulette, mines, plinko, and crash remain disabled until their
game-specific outcomes and payouts are authoritative on-chain.

## Components

- **CasinoCore** validates Dice bets, records immutable bet parameters, reserves
  the worst-case payout, settles the roll after VRF fulfillment, and lets the
  winning player claim the payout.
- **RNGEngine** requests one random word from a Chainlink VRF v2.5 subscription
  using LINK billing, then forwards the verified result to CasinoCore.
- **CasinoReserve** accounts for MTX held for payouts and transfers a settled
  payout only when CasinoCore authorizes a player claim.
- **LiquidityRouter** records the liquidity portion of bet fees for a later
  owner-funded QuickSwap V2 liquidity operation.

## Bet lifecycle

1. The player approves CasinoCore to spend the wager and submits an amount and
   target.
2. CasinoCore checks the configured bet limits, target range, payout cap, and
   available reserve after accounting for existing payout liabilities.
3. CasinoCore stores the bet and requests Chainlink VRF randomness. The bet
   amount and target cannot be changed afterward.
4. The VRF callback records a roll from 1 to 100 and a win/loss result. It does
   not transfer tokens.
5. A winning player claims the payout in a separate transaction. A losing
   result releases its reserved payout capacity.

There is no cancellation or timeout refund for a pending request. Adding one
could allow players to discard an unfavorable result. The VRF subscription
must remain funded so requests can be fulfilled.

## Safety controls

- User-provided game data does not affect the random outcome.
- Worst-case payouts are reserved across pending requests and unclaimed wins.
- Governance changes to the RNG or reserve are blocked while they could
  invalidate outstanding requests or payout liabilities.
- The casino can pause new bets without preventing settlement or claims.
- The contracts and this design require independent security review before
  handling production funds.

---

**Related Documentation:**
- [Casino Games](/docs/casino-games)
- [Casino Game Math](/docs/casino-game-math)
- [Provably Fair System](/docs/provably-fair-system)
- [DAO Governance](/docs/dao-governance)
