# Casino Game Math

## Dice

The first VRF-backed game accepts integer targets from 2 through 98. The
settled roll is an integer from 1 through 100:

- Win when `roll < target`.
- Winning outcomes: `target - 1` of 100.
- Win probability: `(target - 1) / 100`.
- Gross winning payout: `floor(bet * 9800 / (100 * (target - 1)))` MTX base units.
- Theoretical return to player is 98%; the corresponding house edge is 2%,
  subject to integer rounding.

Payouts are gross amounts, including the wager value. CasinoCore rejects a bet
if its full potential payout exceeds the configured `maxPayoutPerBet`; it does
not silently lower or cap the promised payout. The reserve must cover each new
worst-case payout in addition to liabilities already locked for pending bets
and unclaimed wins.

The 88% payout allocation and 4% reserve allocation are accounted into
CasinoReserve; 6% is queued for liquidity and 2% is sent to the configured
developer address. Chainlink VRF subscription costs are paid separately in
LINK by the casino operator.

Only Dice is supported in the initial release. The math for other games is not
active casino behavior until each game's settlement is implemented on-chain.

---

**Related Documentation:**
- [Casino Games](/docs/casino-games)
- [Provably Fair System](/docs/provably-fair-system)
- [MTX Tokenomics](/docs/mtx-tokenomics)
- [Casino Architecture](/docs/casino-architecture)
