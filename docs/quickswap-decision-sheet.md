# QuickSwap Decision Sheet — Needs Brandon

**Date prepared:** 2026-11-10
**Owner:** Brandon David Letourneau — only he can make these choices.
No bot may decide any item below. Every amount is **TBD** until he says
otherwise; the example ratios in the runbook
(`docs/quickswap-pool-creation-runbook.md` §5) are illustrations, not
recommendations and not decisions.

**Status of the facts (not decisions):** the QuickSwap V2 router is
verified — `0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff` (official
QuickSwap docs + PolygonScan four-check, 2026-11-10, runbook §1).
Real MTX `0x53307e1db6c5cb6773c9495ca140372016dfe266`, mint LIVE at
1 POL = 1,000 MTX, MAX_SUPPLY 100,000,000, totalSupply 0 (certified
run #7, block 97058365 @ 2026-11-10T06:43:24Z). No MTX/WMATIC pool
exists yet. The LiquidityRouter is not deployed yet — pool creation
needs it deployed first (runbook §2).

**Scope reminder:** this item is optional for casino launch
(`needs-brandon.md` §8). Dice betting, VRF and payouts do not need
the pool. Deciding "not now" is a valid answer and leaves the casino
unaffected — it only means MTX has no QuickSwap liquidity and the
"buy on QuickSwap" fallback stays dead.

---

## Q1 — How much POL goes into the pool as liquidity?

**What it decides:** the POL side of the first liquidity add (call it
P POL), and therefore the depth of the pool: how much MTX a buyer can
buy (or a seller can sell) before the price moves sharply. More POL =
deeper pool, less slippage for traders, more of his capital locked in
the pool.

**What happens if he picks differently:**
- *Smaller P:* less capital at risk, but a thin pool — even modest
  buys/sells swing the MTX price hard, and the pool looks (and is)
  illiquid.
- *Larger P:* a deeper, more credible market, but more POL locked in
  the pool as capital at risk (recoverable only by removing liquidity
  later, at whatever the price is then — not guaranteed to return the
  same POL).

**Constraints:** P must be held in the deployer wallet alongside gas
(planning range ~0.05–0.15 POL for the three pool transactions).
There is no minimum imposed by the contracts.

**Brandon's answer: 100 POL (decided 2026-11-10)**

## Q2 — What initial MTX price (which MTX:POL ratio)?

**What it decides:** the opening market price of MTX. The first
`provideLiquidity` call **creates the pair and sets its price from the
ratio supplied** — there is no oracle and no later reset. The price
is `P ÷ Y` POL per MTX, where Y is the MTX amount from Q3's mint.

**What happens if he picks differently:**
- *At mint-rate parity (1 POL = 1,000 MTX, i.e. 0.001 POL/MTX):*
  QuickSwap opens at exactly the direct-mint price — a buyer pays the
  same on the DEX as minting directly.
- *Cheaper MTX (more MTX per POL, e.g. 1 POL = 2,000 MTX):* MTX opens
  below the mint price. Early DEX buyers get MTX cheaper than minters;
  the mint rate then looks expensive by comparison.
- *Dearer MTX (less MTX per POL, e.g. 1 POL = 500 MTX):* MTX opens
  above the mint price. Early DEX buyers pay more than minters; the
  pool may sit unsold while direct mint is cheaper.

**Priced examples (not picks):** runbook §5 table — parity rows and
one cheaper / one dearer row, each with its implied price, LP minted,
and POL outlay under either mint route.

**Brandon's answer: 100,000 MTX (Y) + 100 POL (P) — i.e. 0.001 POL per MTX, mint-rate parity (decided 2026-11-10)**

## Q3 — How is the liquidity MTX created: `buyMTX` or `mintToEcosystem`?

**What it decides:** where the Y MTX comes from, and what it costs.
`totalSupply` is currently 0 — the MTX must be minted first either way.

**Option A — `buyMTX()` (direct mint, costs POL):**
- Send POL, receive MTX at the certified rate 1 POL = 1,000 MTX.
- **If he picks this:** total POL outlay is mint POL **plus** liquidity
  POL (e.g. minting the MTX for a parity pool roughly doubles the POL
  committed versus the liquidity side alone). The mint POL sits in the
  MTX contract as mint proceeds, recoverable only by a separate
  owner-only `withdrawMATIC` call.
- Fits if he wants the mint to be a purchase at the published rate.

**Option B — `mintToEcosystem(owner, Y)` (owner mint, no POL cost):**
- Owner-only mint straight to his wallet; costs gas only.
- **If he picks this:** the only POL spent is the liquidity side (Q1)
  plus gas. No POL is locked up as mint proceeds.
- Fits if he wants the liquidity MTX without spending POL to create it.
- Constraint: `totalSupply + Y` must stay ≤ 100,000,000 MTX cap
  (totalSupply is 0, so any Y up to the cap fits).

**Brandon's answer: Option B (`mintToEcosystem`) (decided 2026-11-10)**

## Q4 — LP-token custody: his wallet, or somewhere else?

**What it decides:** who holds the LP tokens — i.e. who can remove
the liquidity (and its accumulated 0.3% trading fees) later.

**Default behaviour of the code (not a choice made here):**
`LiquidityRouter.provideLiquidity` sends the LP tokens to `msg.sender`
— the owner wallet that signs the transaction
(`0x9fb4bb44d8d962d695fc93b3dc15f1b287391077`). That is where they land
unless Brandon moves them afterwards.

**What happens if he picks differently:**
- *Leave them in his wallet (default):* simplest; he alone can remove
  liquidity. Single-key custody — the same single-key pattern the
  audit flags for governance (G-03).
- *Transfer them to the multisig afterwards:* LP control moves to the
  SafeProxy multisig (`0x7Ee41D8A25641000661B1EF5E6AE8A00400466B0` —
  confirm its signers/threshold first; never pass it as a token
  address). Requires one extra signed transfer of the LP tokens after
  the pool is created, and the multisig must be able to sign a future
  `removeLiquidity` call.
- *Timelock / treasury contract:* only if such a contract exists and
  is configured — none exists today, so this would be new work, not a
  same-day choice.

**Brandon's answer: his wallet (decided 2026-11-10)**

## Q5 — The wallet steps he will sign (in order)

These are the transactions only his wallet can sign. Nothing here is
signed by a bot. Costs are **gas only** unless a step names capital
(Q1/Q3 above).

| # | Step | Cost |
|---|---|---|
| 1 | (If not already done) Deploy the casino contracts with `scripts/deploy_casino.js --network polygon` — includes the LiquidityRouter, deployed with `QUICKSWAP_V2_ROUTER_ADDRESS=0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff`. Record the LiquidityRouter address. (Also needs the VRF subscription + `POLYGON_CASINO_DEPLOYMENT_APPROVED=YES`; see `needs-brandon.md` §2–§4.) | Gas ~0.35–0.95 POL for the deploy + wiring txs (planning range) |
| 2 | Mint the liquidity MTX — Q3: **either** `MTX.buyMTX()` with POL attached (Option A: mint POL = Y ÷ 1,000) **or** `MTX.mintToEcosystem(owner, Y)` (Option B: gas only). | Gas only (A) / gas only (B) — plus the mint POL in Option A |
| 3 | `MTX.approve(LiquidityRouter, Y)` | Gas only |
| 4 | `LiquidityRouter.queueInitialLiquidity(Y)` | Gas only |
| 5 | `LiquidityRouter.provideLiquidity(Y, minMtx, minPol, deadline)` with **P POL attached** (`minMtx`/`minPol` at 99% of Y/P, deadline now + 20 min — see runbook §4). **This creates the pair and sets the price.** LP tokens arrive in his wallet. | Gas only + P POL as liquidity capital |
| 6 | Verify (read-only, no signature): pair exists, reserves match the chosen ratio, LP balance in his wallet — runbook §6, or the script's verify phase. | 0 POL |
| 7 | (Only if Q4 = multisig) Transfer the LP tokens to the multisig. | Gas only |

**If he does nothing:** no pool is created, no POL or MTX moves, and
the casino can still launch without it. The 6% fee MTX will queue in
the LiquidityRouter with nowhere to go until a pool exists.

---

## Record of answers (fill in when Brandon replies)

| Question | Answer | Date |
|---|---|---|
| Q1 — POL for liquidity (P) | 100 POL | 2026-11-10 |
| Q2 — Initial ratio (Y MTX + P POL) | 100,000 MTX + 100 POL (0.001 POL/MTX, parity) | 2026-11-10 |
| Q3 — Mint route (buyMTX / mintToEcosystem) | mintToEcosystem (owner mint, gas only) | 2026-11-10 |
| Q4 — LP custody | his wallet (default, LP to msg.sender) | 2026-11-10 |
| Q5 — Signed steps | (steps above; execution TBD — gated on Amoy evidence + mainnet preflight) | — |
