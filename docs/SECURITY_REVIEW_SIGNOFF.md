# Security Review Sign-Off — Casino Blockers G-01–G-05, G-12 (INTERNAL)

**Date:** 2026-11-10
**Reviewer:** Phase 1 Casino Blocker Fix Engineer (internal, Matrix Hub bot team)
**Scope:** the six go-live blockers from `bot-core/go-live/casino-contract-audit.md`
(G-01 fee split, G-02 ownership claims, G-03 multisig governance + capped
`emergencyWithdraw`, G-04 VRF-stuck bet recovery, G-05 Dice-only scope,
G-12 tests + sign-off). Local repo clone, branch Hub10, HEAD `25b2e18`.
No deploys, no fund movements, no wallet held, no private key requested.

## What was reviewed and changed

| Area | Files |
|---|---|
| Contracts | `contracts/CasinoCore.sol` (fee-routing NatSpec; `Bet.placedAt`/`requestId`; `BetStatus.Refunded`; `refundStuckBet` + `refundableAt`, 1-hour timeout; `emergencyWithdraw` capped at 100 MTX/call + event; `setMaxEmergencyWithdraw`; `GovernanceUpdated`/`DevUpdated` events), `contracts/CasinoReserve.sol` (`transferOwnership` + event; `refundBet` + event) |
| Deploy | `scripts/deploy_casino.js` (`GOVERNANCE_ADDRESS`/`DEV_ADDRESS` from env, forbidden-address rejection, loud single-key warning, Safe-multisig note, post-deploy reserve + router ownership transfer to governance), `scripts/amoy_bootstrap.js` (comment: `reserve.fund` must be signed by the reserve owner after transfer) |
| Frontend | Ownership panel hidden at `src/pages/home.astro` + `src/pages/mtx-casino.astro` (component kept for rewrite); split corrected + burn claims removed inside `src/components/MTXOwnershipPanel.astro`; `src/pages/games/casino/index.astro` pending-bet copy updated; `src/casino/mines/MinesGame.tsx` off-chain fallback removed, Mines hard-disabled; `src/casino/mines/MinesEngine.ts` header warning |
| Docs | `docs/MTX_Casino_Game_Math.md`, `docs/MTX_Tokenomics.md`, `docs/MTX_Features_Matrix.md` (fee split corrected to 88/6/4/2 routing, 92% to reserve; burn claim deleted), `docs/MTX_Casino_Responsible_Play.md` (built vs planned relabelled) |
| Tests | New `test/casino-governance-refund.test.cjs` (9 tests); `test/casino-config.test.js` (one address swapped so no forbidden address appears as a test value) |

## Verification performed (this machine, 2026-11-10)

- Baseline (before changes): `npx hardhat compile` clean — 35 files, Hardhat
  2.28.0; `npx hardhat test` — **29 passing, 0 failing**.
- After changes: `npx hardhat compile` clean; `npx hardhat test` —
  **38 passing, 0 failing** (29 pre-existing + 9 new).
- New tests cover: governance setters only from the configured governance
  address; `setGovernance`/`setDev` events + takeover; `emergencyWithdraw`
  cap (default 100 MTX), event, and cap change; `CasinoReserve`
  `transferOwnership` + owner-only `fund` after transfer; full-stake refund
  of a stuck bet after 1 hour (balances, `lockedPayouts`,
  `activeRandomnessRequests`, status `Refunded`, late VRF callback is a
  no-op); early-refund revert; settled/refunded/unknown-bet refund reverts;
  non-governance refund revert.
- Forbidden-address grep: fake token `0xDCb51dE…`, SafeProxy `0x7Ee41D8A…`
  as a token, candidate router `0x80e59c11…`, MTX copies, RNGEngine copies —
  **zero hits as config/token values**. SafeProxy appears only as the
  governance/multisig address in the deploy script (clearly labelled) and in
  pre-existing investigation docs describing it as not-a-token.
- `git status` shows only the files listed above (plus the pre-existing,
  untouched round-3 treasury files). Nothing was committed, pushed, stashed,
  or reset. `scripts/treasury_check.py`, `.github/workflows/treasury-check.yml`,
  `contracts/MatrixHubCoin.sol`, and `src/config/contracts.js` were not touched.

## Design decisions (with reasons)

- **G-01 — kept the code's numbers, corrected the copy.** The contract's
  88/6/4/2 routing stands; every published claim now says 92% of each bet
  lands in the reserve, player payout is dice maths (98% RTP), and nothing
  is burned. `payoutPercent` was NOT renamed: no frontend code or test reads
  it, but it is a public getter, so renaming would change the ABI for any
  off-repo reader; it is instead documented prominently in the contract as
  a reserve-routing share.
- **G-03 — cap 100 MTX/call.** CasinoCore normally holds only rounding dust
  (sub-1-MTX remainders), so 100 MTX is ~100x any legitimate dust recovery
  and far below reserve scale (1M MTX cap). The cap is a speed bump + audit
  trail, not a substitute for multisig: a compromised governance key can
  raise it. Governance/dev come from env with a loud single-key warning when
  left as the deployer; the Safe multisig is accepted as the governance
  address but Brandon has NOT confirmed its signers/threshold.
- **G-04 — 1-hour timestamp timeout.** VRF on Polygon normally fulfils in
  minutes (3 confirmations + callback); 1 hour is ~12x normal latency, so a
  bet still Pending is genuinely stuck (dead subscription, misconfigured
  consumer, coordinator outage), while the player's stake is never stranded
  for a day. Refund returns the FULL stake from the reserve; the 8% already
  routed to liquidity/dev is absorbed by the house.

## What was NOT done — read this before mainnet

- **NO EXTERNAL AUDIT was performed. This file is an INTERNAL review only.**
  No independent security firm reviewed these contracts. The preflight gate
  (`scripts/preflight_mainnet.js`) asks for an independent review; this
  sign-off does NOT satisfy that gate and must never be presented as an
  external audit.
- No Amoy deployment was run here (no signing wallet was available or used);
  the deploy script changes are code-reviewed only and must be exercised on
  Amoy before any mainnet use.
- No on-chain verification was performed; no contract addresses were set in
  `src/config/contracts.js` (owned by the sweep).

## Residual risks (open, in priority order)

1. **Single-key governance until Brandon picks the multisig.** If
   `GOVERNANCE_ADDRESS` is left unset, the deployer EOA governs everything:
   pause, percentages, bet limits, `setGovernance`, capped (but raisable)
   `emergencyWithdraw`. The cap limits one call to 100 MTX from Core, but
   the reserve itself is only protected by who holds the governance key.
   Mitigation: set `GOVERNANCE_ADDRESS` to the Safe multisig and confirm
   its signers/threshold with Brandon before mainnet.
2. **No external review.** See above. Smart-contract risk (reentrancy in new
   paths, accounting edge cases in `refundStuckBet`/`refundBet`) has had
   only internal review + the Hardhat suite.
3. **Out of scope, still open (audit G-06/G-07/G-08):** reserve accounting is
   bookkeeping, not balance-checked; no house-profit sweep exists (losing
   bets accumulate in the reserve indefinitely); `setMaxBetsPerBlock(0)`
   would brick betting and `updatePercentages` has no economic bounds —
   all rely on governance discipline.
4. **VRF + QuickSwap parameters unverified here** (audit G-09/G-10): the
   coordinator/keyHash/LINK addresses and the QuickSwap V2 router address
   must be verified against Chainlink/QuickSwap official docs at deploy
   time; a wrong keyHash or router means redeploy. Amoy has no official
   QuickSwap — the bootstrap mock router is a simulation only.
5. **No Crash page exists in the repo** — the reported aspirational "Min 1
   MTX bet" line was not found anywhere, so there was nothing to fix; if a
   Crash page is added later it must carry no bet line until a contract
   exists. Slots/Blackjack/Roulette/Plinko/Mines pages render "Game
   unavailable" via `CasinoGameWrapper` (only Dice passes `game="dice"`);
   Mines' component-level disable is defence-in-depth.
6. **MinesEngine still contains `Math.random` mine placement.** It is now
   unreachable with funds (the component refuses to start a game, and the
   page wrapper blocks non-Dice games), but the engine file itself was not
   deleted — it must never be re-wired to real funds.
7. **`npm ci` does not work in this VM as-is** (pre-existing environment
   issue, not a code issue): the lockfile's transitive git dependency
   (`@zksync/contracts` via `@chainlink/contracts@1.5.0`) fails in pacote's
   nested install with an EPERM chown. `node_modules` for this review was
   installed in a scratch copy with a `file:` stub override for that one
   unused dependency and copied into the repo (gitignored). Anyone
   re-running `npm ci` here will hit the same failure until the lockfile
   or environment is fixed.

## Bottom line

The six blockers are fixed in code, docs, and tests to the extent an
internal pass can fix them. **Mainnet is still gated on:** Brandon's
multisig custody decision, an independent security review (or his explicit
documented decision to proceed without one), Amoy end-to-end evidence
(including a losing bet, a winning bet + claim, a pause test, and a
stuck-bet refund drill), and the remaining preflight checks.
