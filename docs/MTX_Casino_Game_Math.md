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

## Fee routing (verified against CasinoCore.sol)

Every bet's MTX is routed on receipt — this is a routing split, NOT a
player-payout split:

- 88% — reserve-routing share (`payoutPercent` in the contract; the name is
  a legacy label for a reserve-routing share, NOT a player payout — the
  public getter keeps the name to avoid breaking the ABI) — transferred to
  CasinoReserve.
- 4% — reserve share — transferred to CasinoReserve.
- Together: **92% of every bet lands in CasinoReserve**.
- 6% — queued in the LiquidityRouter for MTX/WMATIC liquidity.
- 2% — sent to the configured developer address.

Player payouts are NOT a percentage of the bet: a winning Dice bet is paid
from the reserve per the dice maths above (98% RTP). No MTX is ever burned
by the casino flow — nothing calls `burn()`. The previously published
85/10/3/2 split was false and has been removed wherever it appeared.

Chainlink VRF subscription costs are paid separately in LINK by the casino
operator.

## Stuck bets (VRF failure)

If a bet's VRF callback never arrives, the bet stays Pending. Governance
may refund it in full via `CasinoCore.refundStuckBet` once it has been
Pending for 1 hour (`STUCK_BET_REFUND_TIMEOUT`). The player gets their whole
stake back from the reserve; the 8% already routed to liquidity/dev is
absorbed by the house, not deducted from the player. Settled bets can never
be refunded, and a refund before the timeout reverts.

Only Dice is supported in the initial release. The math for other games is not
active casino behavior until each game's settlement is implemented on-chain.

---

**Related Documentation:**
- [Casino Games](/docs/casino-games)
- [Provably Fair System](/docs/provably-fair-system)
- [MTX Tokenomics](/docs/mtx-tokenomics)
- [Casino Architecture](/docs/casino-architecture)
