# Responsible Play & Safety Controls

## Built-In Controls (verified in code)
- Max bet limits — BUILT: `minBet`/`maxBet` in `CasinoCore.sol`
  (governance-only `setBetLimits`; deploy defaults 1 / 1,000 MTX, Dice only)
- Emergency pause — BUILT: `setPaused` in `CasinoCore.sol`
  (governance-only; pauses new bets, settled wins remain claimable)

## Planned — not yet available
- Cooldown timers — PLANNED: no cooldown logic exists in any contract or
  frontend. Do not advertise a duration until it exists.
- Automatic scaling if reserve drops — PLANNED: no such logic exists in
  any contract.
- Self-exclusion — PLANNED: nothing in code.
- Loss limits / session limits — PLANNED: nothing in code.

The previous version of this page listed cooldowns, automatic scaling, and
the other controls above under "Built-In Controls". That was false and has
been corrected 2026-11-10: only max-bet limits and emergency pause are
built. The planned controls must not be presented as available until they
are implemented, tested on Amoy, and verified.

## Philosophy
Matrix Hub discourages [compulsive behavior](https://en.wikipedia.org/wiki/Problem_gambling).
Games are optional, transparent, and capped.

Entertainment, not exploitation.

---

**Related Documentation:**
- [Casino Games](/docs/casino-games)
- [Disclaimer](/docs/disclaimer)
