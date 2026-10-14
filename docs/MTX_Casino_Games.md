# MTX Casino Games

## Available in the first VRF-backed release

### Dice Roll

The player chooses a wager and a target from 2 through 98. Chainlink VRF
provides the random word after the bet is recorded. The on-chain roll is from
1 to 100, and the player wins when the roll is below the selected target.
Winning MTX is claimed after settlement.

## Not yet available

Slots, blackjack, roulette, mines, plinko, and crash are disabled. Their current
browser-side game logic must not be used to determine paid outcomes. Each game
needs game-specific on-chain rules, asynchronous VRF settlement, payout
accounting, and tests before it can accept wagers.

---

**Related Documentation:**
- [Provably Fair System](/docs/provably-fair-system)
- [Casino Game Math](/docs/casino-game-math)
- [Casino Architecture](/docs/casino-architecture)
- [Responsible Play](/docs/responsible-play)
