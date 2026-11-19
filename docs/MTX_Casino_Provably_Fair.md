# Provably Fair System

The initial on-chain Dice game uses Chainlink VRF v2.5. It does not use a
browser-generated result, player-controlled seed, or the former synchronous
hash-based `RNGEngine`.

## Dice request and settlement

1. CasinoCore records the player's amount and target, reserves the maximum
   possible payout, and asks RNGEngine for one random word.
2. RNGEngine submits the request to the configured Chainlink VRF coordinator
   using the funded subscription. The request ID links the response to the
   original bet.
3. Chainlink verifies the VRF proof and calls RNGEngine. RNGEngine forwards the
   random word to CasinoCore.
4. CasinoCore derives the roll and stores the final result. The result and
   payout can be checked on-chain through the bet state and events.
5. A winner claims the recorded payout in a separate transaction.

The bet is immutable after the randomness request is submitted, and a
player cannot cancel or reroll it. If the VRF callback never arrives, the
bet becomes refundable after 1 hour (`STUCK_BET_REFUND_TIMEOUT`):
governance may then refund the player's full stake from the reserve via
`CasinoCore.refundStuckBet` — the share already routed to liquidity/dev is
absorbed by the house, not deducted from the player. Requests may remain
pending if the VRF subscription is underfunded or the oracle cannot
fulfill them; subscription health must be monitored.

Chainlink VRF proves that a requested random word was produced according to
the coordinator's key and proof. It does not audit the casino's bet logic,
reserve solvency, frontend, or governance configuration. The casino is live
on mainnet: the contracts passed an internal audit and a full testnet
rehearsal on Amoy, but they have not yet had an independent external audit
(see /security).

---

**Related Documentation:**
- [Casino Games](/docs/casino-games)
- [Casino Architecture](/docs/casino-architecture)
- [Casino Game Math](/docs/casino-game-math)
