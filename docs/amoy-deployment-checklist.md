# Amoy Testnet Deployment Checklist — Matrix Hub Casino

**Date:** 2026-11-10 · **Repo:** `bran8912-ctrl/Matrix-Hub.org`, branch Hub10 ·
**Status:** PREPARE ONLY — this checklist deploys nothing by itself and opens
nothing on mainnet. Phase 1 fixed all 6 casino blockers (compile clean,
38 tests green); Phase 3 packaged the Amoy run below.

**Golden rules**

1. **Amoy only.** Every command here uses `--network amoy` (chain 80002).
   Nothing in this file touches Polygon mainnet (137).
2. **Throwaway key only.** The signer is a fresh Amoy-only key. NEVER
   Brandon's mainnet deployer key (`0x9fb4bb44d8d962d695fc93b3dc15f1b287391077`)
   and NEVER the real MTX token
   (`0x53307e1db6c5cb6773c9495ca140372016dfe266`). Amoy uses a SEPARATE test
   MTX deployed by the bootstrap.
3. **Verify at deploy time.** The VRF addresses/keyHash below are the
   as-coded values — re-check them against
   [Chainlink docs](https://docs.chain.link/vrf) before signing anything.
   Never type an address from memory; copy it from the JSON artefacts.
4. **No real value.** Amoy POL and LINK are free faucet funds; test MTX is
   newly minted test tokens. Nothing here has real-world value.

## 0. Ground truth (verified 2026-11-10)

| Item | Value | Notes |
|---|---|---|
| Real MTX (mainnet — NEVER use on Amoy) | `0x53307e1db6c5cb6773c9495ca140372016dfe266` | Certified: mint LIVE, rate 1 POL = 1,000 MTX, MAX_SUPPLY 100,000,000, totalSupply 0, owner Brandon's MetaMask |
| Amoy VRF coordinator | `0x343300b5d84D444B2ADc9116FEF1bED02BE49Cf2` | As-coded in `scripts/deploy_casino.js`; verify vs Chainlink docs at deploy time |
| Amoy VRF keyHash | `0x816bedba8a50b294e5cbd47842baf240c2385f2eaf719edbd4f250a137a8c899` | As-coded; verify vs Chainlink docs |
| Amoy LINK token | `0x0fd9e8d3af1aaee056eb9e802c3a762a667b1904` | As-coded; verify vs Chainlink docs |
| Amoy VRF callback gas / confirmations | 250,000 / 3 | Immutable in `RNGEngine` — a wrong value means redeploying it |
| QuickSwap V2 router (Polygon mainnet, verified) | `0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff` | Mainnet only. **Amoy has no official QuickSwap** — the bootstrap deploys a `MockQuickSwapV2Router` (simulation only, see §1) |
| Reserve cap / min bet / max bet | 1,000,000 / 1 / 1,000 MTX | Hardcoded in `scripts/deploy_casino.js` (`DEPLOYMENT_CONFIG`) |
| Max payout per bet (Amoy) | 100 MTX | `CASINO_MAX_PAYOUT_PER_BET=100` (bootstrap default); Brandon's call on mainnet |
| Emergency-withdraw cap | 100 MTX per call | `CasinoCore` default; governance-settable via `setMaxEmergencyWithdraw` |
| Stuck-bet refund timeout | 1 hour | `CasinoCore.STUCK_BET_REFUND_TIMEOUT`; governance-only `refundStuckBet` |
| Fee routing (code, not a payout split) | 88 / 6 / 4 / 2 | 92% of each bet reaches the reserve (88 payout-routing + 4 reserve), 6% queues in LiquidityRouter, 2% to dev. Player payouts come only from dice maths (98% RTP) |
| Mainnet gate (NOT part of this checklist) | `POLYGON_CASINO_DEPLOYMENT_APPROVED=YES` + `node scripts/preflight_mainnet.js` exit 0 + Brandon's approval + ≥ 15 POL floor | Nothing in this Amoy run sets or satisfies any of these |

**Never use as an address:** fake MTX `0xDCb51dE3359C946364F707556aC8e6C6f2e69A8a`,
MTX copies `0x1d0787d70fc0d3111408c030e5c9de247dc0104b` /
`0xf92401e65236e8bb2f016742fe24a9a49969ee32`, RNGEngine copies
`0x70561ac30aedee7a09cb3840a1c7e441fd80195f` /
`0x2fbee7a063dafc8adadfaa1c351796407454a1e0`, candidate router
`0x80e59c11f4c94f3f80593895da300e1e7ec01aea`. The deploy script rejects
all of them as governance/dev addresses.

## 1. What the signer needs (before any command)

### 1a. A throwaway Amoy-only key

- Generate a **fresh** keypair used for Amoy only (e.g. a new MetaMask
  account, or `npx hardhat` throwaway). It must never have held mainnet
  funds and must never be reused on mainnet.
- Get Amoy POL from the faucet: https://faucet.polygon.technology/
  (a few POL is plenty — the whole Amoy run costs faucet funds only).
- Get **5 LINK** from the Chainlink Amoy faucet:
  https://faucets.chain.link/polygon-amoy (the bootstrap waits up to
  10 minutes for it to arrive, then funds the VRF subscription).
- Get Amoy POL for the **player** wallet too (a second throwaway account
  — the player needs gas for approve/bet/claim). The player needs no LINK.

### 1b. Environment variables (`.env`, local only, never committed)

| Variable | Value for the Amoy run | Notes |
|---|---|---|
| `PRIVATE_KEY` | `0x…` (throwaway Amoy key, no `0x` prefix issues — use the raw key) | The ONLY key this run ever uses |
| `AMOY_RPC_URL` | `https://rpc-amoy.polygon.technology/` (default in `hardhat.config.cjs` if unset) | Public Amoy RPC |
| `POLYGONSCAN_API_KEY` | Etherscan V2 key (already stored as GitHub secret; value never in chat/files) | Needed only for `hardhat verify` (§4) |
| `MTX_CONTRACT_ADDRESS` | *(unset on first run)* | Bootstrap deploys a test MTX (100M cap, deployer-owned) and records it |
| `VRF_SUBSCRIPTION_ID` | *(unset on first run)* | Bootstrap creates the subscription and records it |
| `QUICKSWAP_V2_ROUTER_ADDRESS` | *(unset on first run)* | Bootstrap deploys a **mock** router — simulation only |
| `CASINO_MAX_PAYOUT_PER_BET` | `100` | Bootstrap default; set explicitly to be sure |
| `AMOY_VRF_FUNDING_LINK` | `5` (default) | LINK to fund the subscription with |
| `GOVERNANCE_ADDRESS` | *(unset for a throwaway run)* | Unset ⇒ deployer is governance (single-key warning printed; acceptable on Amoy). Set to the Safe multisig `0x7Ee41D8A25641000661B1EF5E6AE8A00400466B0` ONLY to test the governance path — its signers/threshold are still unconfirmed, and §3 step 5 then becomes a manual governance step |
| `DEV_ADDRESS` | *(unset for a throwaway run)* | Same default/warning as governance |

**Mock-router warning:** Amoy has no official QuickSwap. The bootstrap's
`MockQuickSwapV2Router` (with a mock wrapped-native token as its `WETH`)
lets `LiquidityRouter` deploy and lets fee MTX queue — it proves the code
paths, not real QuickSwap behaviour. A real pool can only be created on
mainnet with the verified router above. Never present Amoy liquidity as
real liquidity.

### 1c. Pre-flight (local, no wallet, no network)

```bash
npx hardhat compile   # must be clean
npx hardhat test      # must be 38 passing, 0 failing — record the output
```

Optional, also with no network or wallet — the local dry run of the exact
deploy scripts (mock VRF coordinator, mock router, test MTX, in-memory
network). Use it to smoke-test the scripts before spending faucet funds:

```bash
CASINO_LOCAL_DRY_RUN=1 npx hardhat run scripts/amoy_bootstrap.js --network hardhat
```

Proved 2026-11-10: full bootstrap end to end locally (mock router + test
MTX + mock VRF coordinator → all four casino contracts → reserve funded
with 5,000 test MTX), plus a bet that settled and paid out on the deployed
contracts, plus the governance path (§3 step 5). What it could NOT prove:
real VRF consumer registration (`addConsumer` — the mock has no
subscription model), real LINK funding, or any real-network behaviour. See
§8 for the full proved / not-proved table.

## 2. Commands, in order (Amoy)

```bash
# 0. From the repo root (branch Hub10), .env set per §1b
npx hardhat compile
npx hardhat test

# 1. One-command bootstrap: test MTX + VRF subscription + 5 LINK funding
#    + casino deploy + wire + reserve funded with 5,000 test MTX.
#    Safe to re-run: each step is skipped if already done (state in
#    deployments/amoy-bootstrap.json).
npx hardhat run scripts/amoy_bootstrap.js --network amoy
```

**Step-by-step alternative** (only if the bootstrap is not wanted — same
result, more manual work):

```bash
# a. Create the VRF subscription in the Chainlink VRF UI (vrf.chain.link,
#    Polygon Amoy) and fund it with 5 LINK from the faucet via
#    transferAndCall to the coordinator with the subscription id encoded.
#    Record the subscription id.
# b. Deploy the casino (env: MTX_CONTRACT_ADDRESS=<test MTX>,
#    QUICKSWAP_V2_ROUTER_ADDRESS=<mock router or leave unset in the
#    bootstrap>, VRF_SUBSCRIPTION_ID=<id>, CASINO_MAX_PAYOUT_PER_BET=100)
npx hardhat run scripts/deploy_casino.js --network amoy
# c. Fund the reserve (deployer signs; only if governance IS the deployer):
#    MTX.mintToEcosystem(<deployer>, 5000 MTX) -> MTX.approve(<reserve>, 5000)
#    -> CasinoReserve(<reserve>).fund(5000)
```

Do NOT use: `scripts/deploy_casino.cjs` (disabled), `scripts/deploy_rng.js`
(stale), `scripts/deploy_casino_reserve.js` (browser script, old bytecode),
`scripts/deploy_mtx.js` on Polygon (would mint a second MTX).

## 3. What to observe after each step

After the bootstrap, expect these artefacts (all gitignored, keep copies):

| Artefact | Must show |
|---|---|
| `deployments/amoy-bootstrap.json` | `mtxToken`, `mockRouter`, `vrfSubscriptionId`, `casino` (all four addresses), `completedAt` |
| `deployments/casino-amoy.json` | `status: "deployed"`, `dryRun: false`, all four addresses in `contracts`, and in `parameters`: `reserveCapFormatted: "1000000.0 MTX"`, `minBetFormatted: "1.0 MTX"`, `maxBetFormatted: "1000.0 MTX"`, `maxPayoutPerBetFormatted: "100.0 MTX"`, `governanceAddress` / `devAddress` as decided, `governanceIsDeployer` / `devIsDeployer`, `ownershipTransferredToGovernance`, `maxEmergencyWithdrawPerCall: "100 MTX (CasinoCore default; governance-settable)"`, `stuckBetRefundTimeout: "1 hour (CasinoCore STUCK_BET_REFUND_TIMEOUT)"`, `vrfSubscriptionId`, `vrfKeyHash`, `vrfRequestConfirmations: 3`, `vrfCallbackGasLimit: 250000` |
| Console output | `Deployed MockQuickSwapV2Router …`, `Deployed test MTX: …`, `Created VRF subscription: …`, `Funded subscription … with 5 LINK`, `✅ RNGEngine / CasinoReserve / LiquidityRouter / CasinoCore deployed successfully`, `Funded reserve with 5000 test MTX`, `Amoy casino is live on testnet.` |
| On-chain (Amoy PolygonScan) | All four contracts have bytecode; `CasinoCore.mtx()/reserve()/liquidity()/rng()` read back as the other three addresses; `CasinoReserve.casinoCore()`, `RNGEngine.casinoCore()`, `LiquidityRouter.casinoCore()` all equal CasinoCore; `CasinoReserve.reserveHealth()` == 5,000 MTX; RNGEngine is listed as a consumer on the funded subscription |

**Step-5 governance case (only when `GOVERNANCE_ADDRESS` names a
non-deployer address):** `deploy_casino.js` transfers `CasinoReserve` +
`LiquidityRouter` ownership to governance after wiring, so the deployer
**cannot** call `reserve.fund()` — it reverts `NotAuthorized`. The
bootstrap handles this (it does not crash): it mints the 5,000 test MTX to
the governance address, saves `pendingReserveFunding` in
`deployments/amoy-bootstrap.json`, prints the two exact calls below, and
exits WITHOUT `completedAt`. The casino is then **deployed but not
playable** until the governance key signs:

```
1. From governance <GOVERNANCE_ADDRESS>:
   MTX.approve(<CASINO_RESERVE_ADDRESS>, 5000000000000000000000 /* 5000 MTX */)
2. From governance <GOVERNANCE_ADDRESS>:
   CasinoReserve(<CASINO_RESERVE_ADDRESS>).fund(5000000000000000000000)
3. Re-run the bootstrap: it detects reserveHealth() and completes.
```

If governance is the Safe multisig, step 1–2 are multisig transactions
(propose → collect signatures → execute). Until they land, every bet
reverts with `MaxPayoutExceedsReserve` on the empty reserve.

## 4. Verification commands (Amoy PolygonScan)

Run after the deploy. `<ADDR>` values come from
`deployments/casino-amoy.json` — never type addresses from memory.
Amounts are in wei (18 decimals). The deploy script prints these same
commands; this section is the copy to run from.

```bash
# RNGEngine: coordinator, subscription id, keyHash, callback gas, confirmations
npx hardhat verify --network amoy <RNG_ENGINE> \
  "0x343300b5d84D444B2ADc9116FEF1bED02BE49Cf2" "<SUBSCRIPTION_ID>" \
  "0x816bedba8a50b294e5cbd47842baf240c2385f2eaf719edbd4f250a137a8c899" \
  "250000" "3"

# CasinoReserve: MTX, reserve cap (1,000,000 MTX in wei), CasinoCore wired
# afterwards via setCasinoCore — so the third constructor arg is 0x0 here.
npx hardhat verify --network amoy <CASINO_RESERVE> \
  "<TEST_MTX>" "1000000000000000000000000" \
  "0x0000000000000000000000000000000000000000"

# LiquidityRouter: MTX, QuickSwap router (on Amoy: the MOCK router address)
npx hardhat verify --network amoy <LIQUIDITY_ROUTER> \
  "<TEST_MTX>" "<MOCK_ROUTER>"

# CasinoCore: MTX, router, reserve, RNG, min bet (1 MTX), max bet
# (1,000 MTX), max payout (100 MTX), dev, governance — all in wei where
# amounts are concerned.
npx hardhat verify --network amoy <CASINO_CORE> \
  "<TEST_MTX>" "<LIQUIDITY_ROUTER>" "<CASINO_RESERVE>" "<RNG_ENGINE>" \
  "1000000000000000000" "1000000000000000000000" "100000000000000000000" \
  "<DEV_ADDRESS>" "<GOVERNANCE_ADDRESS>"
```

Compiler settings must match the build (0.8.20 for the casino contracts;
see `hardhat.config.cjs`). All four must show as verified on
https://amoy.polygonscan.com before the playthrough. Record the four
verification URLs.

## 5. Amoy playthrough (testnet only — throwaway deployer key + a second test wallet as "player")

Player setup: the player wallet holds Amoy POL (faucet) and test MTX.
The deployer (test-MTX owner) mints to the player:
`MTX.mintToEcosystem(<player>, <amount>)`. The player then approves
CasinoCore: `MTX.approve(<CASINO_CORE>, <amount>)`.

Dice maths reference: `previewPayout(amount, target)` is exact. A 10 MTX
bet at target 50 pays 20 MTX if it wins (98% RTP). `getBet(betId)`
returns `(player, amount, target, roll, status, win, payout)` with status
`0 None, 1 Pending, 2 Settled, 3 Claimed, 4 Refunded`. A win is
`roll < target` with `roll` in 1–100.

**Record LINK consumption:** read the subscription before and after each
bet (`getSubscription(<id>)` on the coordinator, or the VRF UI) and log
`LINK before → LINK after → LINK per bet`. That number sets the mainnet
funding budget (planning range 10–25 LINK).

| # | Test | Exact steps | Expected result | Record |
|---|---|---|---|---|
| 1 | Fund player | Deployer: `mintToEcosystem(player, 100 MTX)`; player: `approve(core, 100 MTX)` | Player MTX balance 100; allowance 100 | Player address, tx hashes |
| 2 | Winning bet + claim | Player: `placeDiceBet(10 MTX, 50)` → wait for VRF fulfilment (3 confirmations + callback; normally minutes) → `getBet(1)` → `claimPayout(1)` if win | `BetPlaced` + `BetRequested` events; `getBet` goes Pending → Settled with roll/win/payout; `lockedPayouts` 20 while pending, released on settle; `activeRandomnessRequests` 1 → 0; after claim, player +20 MTX, reserve −20 MTX, status Claimed (3) | Bet id, roll, payout, LINK used, tx hashes |
| 3 | Losing bet | Player: `placeDiceBet(10 MTX, 50)` again; wait for VRF | Settles with `win=false`, `payout=0`; `lockedPayouts` released; nothing claimable (`claimPayout` reverts `BetNotClaimable`) | Bet id, roll, LINK used |
| 4 | Pause test | Governance: `setPaused(true)` → player tries `placeDiceBet` → governance: `setPaused(false)` | New bet reverts `CasinoPaused` while paused; settled wins remain claimable while paused (claims still work); betting resumes after unpause | Tx hashes |
| 5 | Reserve-exhaustion revert | With the reserve funded at 5,000 MTX and max payout 100 MTX: place repeated max-payout bets until `lockedPayouts` leaves less headroom than the next bet's potential payout, then place one more | That bet reverts `MaxPayoutExceedsReserve` (no funds move, no bet created). (A single bet can never exceed the 100 MTX max payout, so exhaustion only shows under concurrent locked payouts.) | Reserve `reserveHealth()`, `lockedPayouts`, bet count at failure |
| 6 | Percentage-sum revert | Governance: `updatePercentages(88, 6, 4, 3)` (sums to 101), then `updatePercentages(88, 6, 4, 2)` | First call reverts `InvalidPercentageSum`; second succeeds and emits `PercentagesUpdated` | Tx hashes |
| 7 | Stuck-bet refund | See procedure below — run it the moment any bet stays Pending past its `refundableAt` | Full-stake refund, status Refunded (4), `BetRefunded` event | Bet id, `refundableAt`, balances before/after, tx hash |
| 8 | Kill-switch rehearsal | §6 | — | — |

**Test 7 — stuck-bet refund procedure (G-04).** The refund path is
covered by unit tests (`test/casino-governance-refund.test.cjs`: refund too
early reverts `RefundTooEarly`, non-governance reverts `NotGovernance`, a
settled bet reverts `BetNotRefundable`, full-stake refund, late VRF
callback is a no-op). On Amoy, VRF normally fulfils within minutes, so a
stuck bet may never occur naturally — do NOT break the deployment to fake
one. Instead, monitor every bet: if any bet is still Pending after its
`refundableAt` (query `CasinoCore.refundableAt(betId)` — placement time +
1 hour), run:

```
1. Governance: CasinoCore.refundStuckBet(<betId>)
   (reverts RefundTooEarly before refundableAt; only governance may call it)
2. Verify: getBet(<betId>) status == Refunded (4); player balance is up by
   the FULL stake (the reserve absorbs the 8% already routed to
   liquidity/dev — the player is never shorted); reserveHealth() down by
   the stake; lockedPayouts released by the bet's reserved payout;
   activeRandomnessRequests decremented; BetRefunded event emitted.
3. Verify the late callback is harmless: when/if VRF later fulfils that
   requestId, fulfillRandomness returns early (bet is no longer Pending)
   and nothing changes.
```

The realistic Amoy trigger is a VRF outage or a subscription that runs
dry mid-flight (an empty subscription = bets that never resolve). If no
bet ever sticks on Amoy, record "no stuck bet occurred; refund path
verified by unit tests + local dry run" — do not invent a result.

## 6. Kill-switch rehearsal

1. Governance signs `CasinoCore.setPaused(true)` on Amoy; confirm
   `paused() == true` and that a new `placeDiceBet` reverts
   `CasinoPaused` (test 4 above).
2. Confirm settled wins remain claimable while paused (claim one if any
   is outstanding).
3. Frontend revert path (staging build only, never production): unset the
   four casino env vars (or set them back to `0x0`), rebuild, redeploy to
   staging — the Dice page must return to its disabled "Coming Soon" copy.
4. Resume: governance signs `setPaused(false)`; confirm betting works again.
5. Record who holds the pause key on Amoy (throwaway deployer vs multisig)
   and the time from decision to paused.

## 7. Rollback note (Amoy)

- **Immediate:** governance `setPaused(true)` — new bets stop, settled
  wins remain claimable.
- **Full:** unset the four env vars (`CASINO_CORE_ADDRESS`,
  `CASINO_RESERVE_ADDRESS`, `LIQUIDITY_ROUTER_ADDRESS`,
  `RNG_ENGINE_ADDRESS`), rebuild, redeploy. The site returns to its
  disabled state.
- **In-flight bets:** keep the VRF subscription funded until
  `activeRandomnessRequests == 0` so pending bets can settle; only then
  consider letting funding lapse. Any bet still Pending after 1 hour can
  be refunded by governance (§5 test 7).
- **Reserve funds** stay in `CasinoReserve` on rollback; they are test MTX
  with no value. Nothing here touches mainnet state.

## 8. What the local dry run proved — and what it could not prove

Run 2026-11-10 with `CASINO_LOCAL_DRY_RUN=1 ... --network hardhat`
(Hardhat in-memory network, throwaway local accounts, no network, no wallet).

| Proved locally | Evidence |
|---|---|
| `deploy_casino.js` deploys + wires end to end (RNGEngine → CasinoReserve → LiquidityRouter → CasinoCore, `setCasinoCore` ×3) | `deployments/casino-hardhat.json` status `deployed`, all four addresses; `dryRun: true` |
| Deployments JSON captures cap / timeout / governance | `reserveCapFormatted 1000000.0 MTX`, `maxPayoutPerBetFormatted 100.0 MTX`, `maxEmergencyWithdrawPerCall 100 MTX`, `stuckBetRefundTimeout 1 hour`, `governanceIsDeployer`, `ownershipTransferredToGovernance` |
| Bootstrap runs steps 1–5 end to end, including reserve funding | `amoy-bootstrap-local-dryrun.json` with `completedAt`; "Funded reserve with 5000 test MTX" |
| Governance-owned reserve path works and does not crash | With `GOVERNANCE_ADDRESS` set to a second account: ownership transferred, 5,000 test MTX minted to governance, `pendingReserveFunding` saved, no `completedAt`, exact manual steps printed, exit 0 |
| The printed manual fund() steps are correct | Probe: deployer `fund()` reverts `NotAuthorized` (true); governance `approve` + `fund` succeeds, `reserveHealth()` == 5,000 MTX |
| A bet settles and pays on the deployed contracts | 10 MTX @ target 50 → Pending, `lockedPayouts` 20 → mock VRF fulfill → roll 49, win, payout 20, Settled → `claimPayout` → player +20 MTX, reserve 4,989.2 MTX; `setPaused(true)` blocks new bets (`CasinoPaused`) |
| The old import bug is fixed | Previously `await import("./deploy_casino.js")` let it `process.exit(0)` inside the bootstrap, silently skipping step 5. Now `deploy_casino.js` only auto-runs as the entrypoint and the bootstrap calls the exported `deployCasino()` — step 5 ran in the dry run |
| The old mock-router bug is fixed | `MockQuickSwapV2Router` deployed with `ZeroAddress` as `WETH` made `LiquidityRouter`'s constructor revert `ZeroAddress()` (it requires a non-zero `WETH()` with code). Both scripts now deploy a mock wrapped-native token first |

| NOT proved locally — needs the real Amoy run | Why |
|---|---|
| Real VRF subscription creation + LINK funding + `addConsumer` registration | `MockVRFCoordinator` has no subscription model (`createSubscription` / `getSubscription` / `addConsumer` / LINK do not exist on it); the scripts skip those checks in dry-run mode and record it in the JSON |
| Real VRF fulfilment latency and per-bet LINK cost | No coordinator, no LINK, no confirmations on the in-memory network |
| Real Amoy RPC / faucet / PolygonScan verification behaviour | No network access in the dry run by design |
| Multisig (Safe) signing flow | Local governance test used a plain EOA; the Safe's propose/sign/execute steps are untested |

## 9. Mainnet stays gated

Nothing in this checklist, the scripts, or the dry run opens mainnet.
Mainnet needs, in order: Amoy evidence from §5 (written results,
including a losing bet, a winning bet + claim, a pause test, and per-bet
LINK cost) + `docs/SECURITY_REVIEW_SIGNOFF.md` (internal review exists;
no external audit) + the go/no-go list in
`bot-core/go-live/casino-deployment-plan.md` §5 + Brandon's explicit
go-live approval + `POLYGON_CASINO_DEPLOYMENT_APPROVED=YES` +
`node scripts/preflight_mainnet.js` exiting 0 (which enforces the ≥ 15 POL
floor, canonical MTX, verified router, funded VRF subscription, Amoy
deployment artefact, and GitHub environment reviewers).

## 10. Evidence to file after the Amoy run

- `deployments/casino-amoy.json` + `deployments/amoy-bootstrap.json`
  (copies, not just the live files)
- The four Amoy PolygonScan verification URLs
- VRF subscription id + LINK balance before/after the playthrough
- The §5 playthrough log: bet ids, rolls, payouts, LINK per bet, tx hashes
  for tests 2–7, and the kill-switch rehearsal times from §6
- Any failure, with the exact revert/error text — do not re-run past a
  failure without recording it first

## Appendix — script changes made in Phase 3 (for the reviewer)

- `scripts/deploy_casino.js`
  - Only auto-runs `main()` when it is the `hardhat run` entrypoint
    (`process.argv[1]` is the script path); exports `main` as
    `deployCasino` for importers. Fixes the import-kills-caller bug.
  - `CASINO_LOCAL_DRY_RUN=1` mode (`--network hardhat` only): deploys a
    mock VRF coordinator, a mock QuickSwap router (with a mock
    wrapped-native token), and a test MTX when the env does not supply
    them; skips the LINK/subscription checks the mock cannot satisfy;
    records `dryRun: true` and the mock caveats in the deployment JSON.
  - Mock router now gets a mock wrapped-native token instead of
    `ZeroAddress` (fixes the `ZeroAddress()` revert in
    `LiquidityRouter`'s constructor).
- `scripts/amoy_bootstrap.js`
  - Step 4 now calls the exported `deployCasino()` instead of a bare
    import (step 5 runs again).
  - Step 5 is governance-aware: if the reserve owner is not the deployer
    it mints test MTX to governance, saves `pendingReserveFunding`, and
    prints the exact manual `approve` + `fund` calls instead of reverting;
    re-runs detect `reserveHealth()` and complete. Also skips re-funding
    when the reserve is already funded.
  - Mock router fix as above; deployment file is now read by network name
    (`casino-<network>.json`).
  - `CASINO_LOCAL_DRY_RUN=1` mode (`--network hardhat` only): mock VRF
    coordinator with subscription id 1, no LINK step, separate state file
    `deployments/amoy-bootstrap-local-dryrun.json` so a dry run can never
    clobber real Amoy state.
- No other files were changed by Phase 3. `contracts/*`,
  `docs/quickswap-*.md`, `scripts/create_quickswap_pool.js`,
  `scripts/treasury_check.py`, and `.github/workflows/treasury-check.yml`
  were not touched.
