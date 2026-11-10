# QuickSwap Pool-Creation Runbook — MTX/WMATIC (Polygon)

**Status: PREPARE ONLY — no transaction has been executed. Nothing in this
runbook sends a transaction. Every step below is executed by Brandon (the
MTX owner) signing with his own wallet, or not at all.**

**Date prepared:** 2026-11-10
**Repo:** `bran8912-ctrl/Matrix-Hub.org`, branch `Hub10`
**Companion files:** `docs/quickswap-decision-sheet.md` (the open choices
Brandon must make first — no amount in this runbook is a decision),
`scripts/create_quickswap_pool.js` (the scripted form of this sequence,
`--dry-run` by default).

## 0. Ground truth (verified — do not re-derive)

| Item | Value |
|---|---|
| Network | Polygon mainnet, chain ID 137 |
| Real MTX (MatrixHubCoin) | `0x53307e1db6c5cb6773c9495ca140372016dfe266` |
| MTX owner / deployer (Brandon's MetaMask) | `0x9fb4bb44d8d962d695fc93b3dc15f1b287391077` |
| MTX mint state (certified run #7, block 97058365 @ 2026-11-10T06:43:24Z) | mintingPaused **false** (mint LIVE), rate **1 POL = 1,000 MTX**, MAX_SUPPLY **100,000,000**, totalSupply **0** |
| QuickSwap V2 factory | `0x5757371414417b8C6CAad45bAeF941aBc7d3Ab32` |
| WMATIC | `0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270` |
| QuickSwap pair `getPair(MTX, WMATIC)` | `0x0` — **NO pool exists** (certified run #7) |
| QuickSwap V2 router | `0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff` — see §1 |

**FORBIDDEN — never use under any circumstances:**
- `0x80e59c11f4c94f3f80593895da300e1e7ec01aea` — candidate LiquidityRouter,
  misconfigured (wrong MTX clone, `dexPool` = deployer, immutable).
- `0xDCb51dE3359C946364F707556aC8e6C6f2e69A8a` — fake/phishing MTX,
  flagged `Fake_Phishing8012348` / Phish-Hack.

## 1. Router verification — four-check verdict (dated 2026-11-10)

Candidate: **`0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff`**

| # | Check | Result (2026-11-10) |
|---|---|---|
| 1 | Contract exists on PolygonScan (code present) | **PASS.** PolygonScan page fetched 2026-11-10 06:50 UTC shows live transactions seconds old (latest block 97058629 at fetch time) and internal transactions to the WPOL Token contract. Full contract ABI is published on the page. |
| 2 | Source verified | **PASS.** PolygonScan shows Contract Name `UniswapV2Router02`, Compiler `v0.6.6+commit.6c089d02`, Optimization **Yes, 999999 runs**, License **GNU GPLv3**, with source/ABI published. |
| 3 | Contract name matches QuickSwap's V2 router | **PASS.** PolygonScan titles the page **"QuickSwap V2: Router"**. QuickSwap's official docs (`docs.quickswap.exchange/overview/contracts-and-addresses.md`, fetched 2026-11-10 06:50 UTC) list, under **"Polygon POS V2"**: "V2 router address `0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff`" and "V2 Factory address `0x5757371414417b8C6CAad45bAeF941aBc7d3Ab32`" — the factory matches the independently verified factory exactly. The contract is the `UniswapV2Router02` implementation QuickSwap forked/deployed for V2 (its `addLiquidityETH` signature is the one `LiquidityRouter.sol` calls). |
| 4 | No fake/phishing flag | **PASS.** No warning, flag, or phishing label appears on the PolygonScan page; it is labelled "QuickSwap V2: Router" with continuous live usage. |

**Verdict: VERIFIED 2026-11-10.** The router address above is the real
QuickSwap V2 router on Polygon.

**Corroboration (not the basis of the verdict):** QuickSwap's own core
repo (`QuickSwap/quickswap-core` README, via the `quickswap-core` commit
history) lists `QuickSwapRouter: 0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff`
next to `QuickSwapFactory: 0x5757371414417b8C6CAad45bAeF941aBc7d3Ab32`;
independent registries (Eco docs, Railgun cookbook, multiple codebases)
list the same pair of addresses.

**Not verified by this agent (deploy-time check, not a blocker for this
package):** no live on-chain read was possible from this VM (public
Polygon RPCs are blocked/rate-limited here — see the Treasury
certification packet). At deploy time, confirm on-chain before signing:
`router.factory()` must return `0x5757371414417b8C6CAad45bAeF941aBc7d3Ab32`
and `router.WETH()` must return `0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270`.
`scripts/deploy_casino.js` already enforces an on-chain bytecode check
for `QUICKSWAP_V2_ROUTER_ADDRESS`, and the `LiquidityRouter` constructor
reverts unless the router has code and its `WETH()` returns a contract
address — both are automatic guards at deploy time.

**Note on the older docs repo:** QuickSwap's legacy docs repo
(`QuickSwap/quickswap-docs`, `docs/V2/reference/smart-contracts/06-router02.md`)
only publishes the *Ethereum* Router02 address
(`0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D`) — it is a Uniswap-docs
fork and does not list Polygon addresses. The live docs site above is
the authoritative source for the Polygon address.

## 2. Prerequisites — read before any step

1. **Brandon's decisions first.** The amounts and the mint route are
   open choices in `docs/quickswap-decision-sheet.md`. Do not start
   this sequence until he has picked them. Nothing below picks them.
2. **The LiquidityRouter must be deployed first.** Pool creation goes
   through `LiquidityRouter.provideLiquidity` — the router contract does
   not exist on-chain yet (no casino contracts are deployed). Deploy it
   with `scripts/deploy_casino.js` (`--network polygon`), with
   `QUICKSWAP_V2_ROUTER_ADDRESS=0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff`
   in the environment. That script refuses a zero/invalid router and
   checks on-chain bytecode before deploying. Record the deployed
   LiquidityRouter address as `LIQUIDITY_ROUTER_ADDRESS` for §4 and for
   `scripts/create_quickswap_pool.js`.
3. **MTX must exist first.** `totalSupply` is **0**. There is no MTX to
   add to a pool until it is minted (§3).
4. **Hold enough POL.** The deployer wallet needs: the POL supplied as
   liquidity (his decision) + gas for the mint/approve/queue/provide
   transactions (planning range ~0.05–0.15 POL for the three pool
   transactions; mint transactions are gas-only on top). The 15 POL
   mainnet floor in `scripts/preflight_mainnet.js` applies to the casino
   deploy, not to this sequence alone.
5. **This sequence is optional for casino launch** (audit G-10,
   `needs-brandon.md` §8): Dice betting, VRF and payouts do not need the
   pool. It is required only for the "buy MTX on QuickSwap" story to be
   true and for the 6% fee MTX queued in the router to have somewhere
   to go.

## 3. Step A — Mint the MTX (totalSupply is 0)

Two routes. Both mint real MTX from the certified contract
`0x53307e1db6c5cb6773c9495ca140372016dfe266`. Which one is used is
Brandon's decision (decision sheet Q3). Either route must leave at
least **Y MTX** (his chosen liquidity amount) in the owner's wallet
before §4.

### Route A1 — `buyMTX` (direct mint, costs POL)

Exact signature (`contracts/MatrixHubCoin.sol:82`):

```solidity
function buyMTX() external payable
```

Mechanics: send POL, receive MTX at the certified rate
**1 POL = 1,000 MTX** (`maticToMtxRate = 1000`, `mintingPaused = false`).
Sending `P` POL mints `P × 1,000` MTX to the sender. Examples:
10 POL → 10,000 MTX; 50 POL → 50,000 MTX; 100 POL → 100,000 MTX.
(The `receive()` fallback, `MatrixHubCoin.sol:90`, does the same on a
plain POL transfer — prefer the explicit `buyMTX()` call.)

When it fits: Brandon wants the mint to be a purchase at the published
rate, with the POL paid sitting in the MTX contract as mint proceeds.

Cost warning: the POL paid for the mint is **in addition to** the POL
supplied as liquidity in §4. Route A1 total POL outlay = mint POL +
liquidity POL (e.g. 10,000 MTX + 10 POL liquidity = 10 POL mint +
10 POL liquidity = 20 POL, plus gas). The mint POL is held by the MTX
contract and is recoverable only by an owner-only
`withdrawMATIC(recipient)` call — it is not automatically returned.

Preconditions: `mintingPaused` must be `false` and the rate `1000`
(re-check on-chain before signing; both were certified 2026-11-10 —
if either changed, stop and re-certify).

### Route A2 — `mintToEcosystem` (owner mint, no POL cost)

Exact signature (`contracts/MatrixHubCoin.sol:157`):

```solidity
function mintToEcosystem(address to, uint256 amount) external onlyOwner
```

Mechanics: owner-only; mints `amount` MTX (18 decimals, i.e. pass
`Y × 10¹⁸` wei) directly to `to` — mint to the **owner's own wallet**,
not to the LiquidityRouter (the queue step in §4 pulls MTX from the
owner via `safeTransferFrom`).

When it fits: Brandon wants the liquidity MTX without spending POL to
mint it; the only POL spent is the liquidity side + gas.

Constraint: `totalSupply() + amount` must stay ≤ MAX_SUPPLY
100,000,000 MTX. With totalSupply 0, any Y ≤ 100,000,000 fits.

## 4. Step B — Queue and provide liquidity (the pool-creation sequence)

All three calls are owner-only on the deployed LiquidityRouter and are
signed by Brandon's wallet (`0x9fb4bb44d8d962d695fc93b3dc15f1b287391077`).
`Y` = MTX amount (whole MTX), `P` = POL amount (whole POL) — both
Brandon's decisions.

### B1 — Approve the LiquidityRouter to pull MTX

Standard ERC-20 approve on the MTX token — approve the
**LiquidityRouter**, not the QuickSwap router (the LiquidityRouter
approves QuickSwap internally with `forceApprove` and resets the
allowance to 0 afterwards):

```solidity
// MTX.approve(spender, amount)
MTX.approve(LIQUIDITY_ROUTER_ADDRESS, Y)
```

### B2 — Queue the MTX

Exact signature (`contracts/LiquidityRouter.sol`, `queueInitialLiquidity`):

```solidity
function queueInitialLiquidity(uint256 amount) external onlyOwner
```

Call: `LiquidityRouter.queueInitialLiquidity(Y)` (Y in wei, 18 decimals).
This pulls Y MTX from the owner into the router and increments
`pendingMtx` by Y. Emits `InitialLiquidityQueued(amount)`.
Recoverable: `withdrawPendingMtx(recipient, amount)` (owner-only)
pulls queued MTX back out at any time before providing liquidity.

Note: `depositLiquidity(uint256 amount)` (`LiquidityRouter.sol`) is
**CasinoCore-only** — it is for casino fee MTX later, not for this
initial pool. Do not call it here; it will revert for the owner.

### B3 — Provide liquidity (this CREATES the pair and SETS the price)

Exact signature (`contracts/LiquidityRouter.sol:169-177`, `provideLiquidity`):

```solidity
function provideLiquidity(
    uint256 amountMtxDesired,
    uint256 amountMtxMin,
    uint256 amountMaticMin,
    uint256 deadline
)
    external
    payable
    onlyOwner
    nonReentrant
    returns (uint256 amountMtx, uint256 amountMatic, uint256 liquidity)
```

Call: `LiquidityRouter.provideLiquidity(Y, minMtx, minPol, deadline)`
with **`msg.value = P` POL attached**. What happens inside:
the router calls QuickSwap's
`addLiquidityETH(MTX, Y, minMtx, minPol, msg.sender, deadline)`
with the attached POL; QuickSwap wraps the POL to WMATIC internally,
**creates the MTX/WMATIC pair** (it does not exist yet), mints LP
tokens to `msg.sender` (the owner — LP custody is decision-sheet Q4),
and returns any unused POL to the owner. Emits
`LiquidityProvided(provider, lpRecipient, amountMtx, amountMatic, liquidity)`.

**Do NOT pre-wrap POL → WMATIC.** The `addLiquidityETH` path takes
native POL and wraps it inside QuickSwap. Wrapping manually is only
needed for the ERC-20/ERC-20 `addLiquidity` path, which this contract
does not use. The WMATIC address
`0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270` matters for verification:
it is the pair's second token and must equal `router.WETH()`.

### Slippage (`minMtx` / `minPol`) and deadline guidance

- **First add sets the ratio exactly:** when no pair exists, QuickSwap
  adds exactly the amounts supplied, so the minimums are a guard
  against being sandwiched in the mempool, not against an existing
  price moving. Recommended default: **1% slippage** —
  `minMtx = 99% × Y`, `minPol = 99% × P`. Never use 0 for either
  minimum: a 0 minimum lets a sandwich take the whole move.
- **Deadline:** `deadline = block.timestamp + 1,200` (now + 20 minutes)
  at signing time. Never more than ~30 minutes. The contract reverts
  with `Expired()` if `deadline < block.timestamp`. Set the deadline
  from the clock at signing, not from when the runbook was written.
- **If the transaction reverts:** check `pendingMtx` — the router
  restores unspent MTX to pending on a revert path only if the call
  itself reverted before the QuickSwap call; if the QuickSwap call
  reverted, nothing was added and the MTX stays queued. Re-check
  balances before retrying; never re-send blindly.

### Abort conditions — STOP and do not proceed if any is true

- `getPair(MTX, WMATIC)` is already non-zero **before** B3: the pair
  (and its price) already exist — the first-add price decision is gone.
  Stop, read the existing reserves, and re-decide.
- `QUICKSWAP_V2_ROUTER_ADDRESS` is anything other than
  `0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff` — in particular never
  `0x80e59c11…` (forbidden, §0).
- The owner's MTX balance is < Y, or `mintingPaused` is `true`
  (Route A1), or `totalSupply() + Y` would exceed 100,000,000.
- The LiquidityRouter address is unset / has no code / its
  `QUICKSWAP_V2_ROUTER()` is not the verified router.

## 5. Price math — the first add SETS the MTX price

Uniswap V2 constant-product pricing: the first liquidity add fixes the
pool ratio, and that ratio **is** the opening price. There is no oracle
and no later correction — the market moves it from there.

Formulas (both reserves in wei, 18 decimals each; the ratio is what
matters):

```
price of 1 MTX in POL  =  POL reserve  /  MTX reserve
price of 1 POL in MTX  =  MTX reserve  /  POL reserve
LP tokens minted (≈)   =  sqrt(MTX amount × POL amount)   (whole tokens;
                         minus the 1,000-wei MINIMUM_LIQUIDITY locked
                         forever by Uniswap V2 — negligible)
```

The certified direct-mint rate is **1 POL = 1,000 MTX**, i.e. mint-rate
parity is **0.001 POL per MTX**. Pricing the pool at parity means a
buyer on QuickSwap initially pays the same as a direct minter.

### Candidate initial ratios (EXAMPLES ONLY — not decisions)

| MTX (Y) | POL (P) | Implied MTX price | 1 POL buys | LP minted (≈) | POL outlay, Route A1 buyMTX (mint + liquidity) | POL outlay, Route A2 mintToEcosystem (liquidity only) |
|---:|---:|---|---:|---:|---:|---:|
| 10,000 | 10 | 0.001 POL / MTX (parity) | 1,000 MTX | ~316.23 | 20 POL | 10 POL |
| 50,000 | 50 | 0.001 POL / MTX (parity) | 1,000 MTX | ~1,581.14 | 100 POL | 50 POL |
| 100,000 | 100 | 0.001 POL / MTX (parity) | 1,000 MTX | ~3,162.28 | 200 POL | 100 POL |
| 100,000 | 50 | **0.0005 POL / MTX (MTX half parity — cheaper MTX)** | 2,000 MTX | ~2,236.07 | 150 POL | 50 POL |
| 50,000 | 100 | **0.002 POL / MTX (MTX double parity — dearer MTX)** | 500 MTX | ~2,236.07 | 150 POL | 100 POL |

Notes:
- POL outlay columns exclude gas (~0.05–0.15 POL planning range for
  the three pool transactions, plus mint gas).
- All five rows use ≤ 100,000 MTX, far under the 100,000,000 cap and
  under the 1,000,000 MTX reserve cap (a separate casino number — the
  pool is not the reserve).
- The two off-parity rows show the lever plainly: the same MTX amount
  at half the POL starts MTX at half the mint-rate price; the same MTX
  at double the POL starts it at double. The choice is Brandon's
  (decision sheet Q2) — the table only prices the options.
- No USD price is given anywhere: POL is market-priced and no POL/USD
  rate is asserted here.

## 6. Step C — Verify on-chain (read-only)

Run after B3, with `$POLYGON_RPC_URL` set to a working Polygon RPC.
All of these are reads — no transaction, no key needed.

```bash
MTX=0x53307e1db6c5cb6773c9495ca140372016dfe266
WMATIC=0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270
FACTORY=0x5757371414417b8C6CAad45bAeF941aBc7d3Ab32
ROUTER=0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff
OWNER=0x9fb4bb44d8d962d695fc93b3dc15f1b287391077
# LIQUIDITY_ROUTER=<deployed address from deployments/casino-polygon.json>

# 1. Router sanity (also a pre-deploy check)
cast call $ROUTER "factory()(address)" --rpc-url $POLYGON_RPC_URL
#   expect: 0x5757371414417b8C6CAad45bAeF941aBc7d3Ab32
cast call $ROUTER "WETH()(address)" --rpc-url $POLYGON_RPC_URL
#   expect: 0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270

# 2. The pair now exists (was 0x0 before)
cast call $FACTORY "getPair(address,address)(address)" $MTX $WMATIC --rpc-url $POLYGON_RPC_URL
#   expect: a non-zero pair address — record it as PAIR

# 3. Reserves read back at the intended ratio
cast call $PAIR "token0()(address)" --rpc-url $POLYGON_RPC_URL
cast call $PAIR "token1()(address)" --rpc-url $POLYGON_RPC_URL
cast call $PAIR "getReserves()(uint112,uint112,uint32)" --rpc-url $POLYGON_RPC_URL
#   expect: reserves in the Y:P ratio (token0/token1 ordering tells
#   you which reserve is MTX — the lower address sorts first)

# 4. LP tokens are in the owner's wallet
cast call $PAIR "balanceOf(address)(uint256)" $OWNER --rpc-url $POLYGON_RPC_URL
#   expect: ≈ sqrt(Y × P) LP tokens (18 decimals), matching the
#   `liquidity` value in the LiquidityProvided event
cast call $PAIR "totalSupply()(uint256)" --rpc-url $POLYGON_RPC_URL

# 5. Router queue is drained of what was added
cast call $LIQUIDITY_ROUTER "pendingMtx()(uint256)" --rpc-url $POLYGON_RPC_URL
#   expect: 0 if all queued MTX was added (or the unspent remainder)

# 6. MTX supply check
cast call $MTX "totalSupply()(uint256)" --rpc-url $POLYGON_RPC_URL
#   expect: Y (if Route A2 minted exactly Y) or the Route A1 mint total
```

Pass criteria: pair non-zero; reserves match the chosen Y:P ratio;
LP balance in the owner's wallet equals the event's `liquidity`;
`pendingMtx` is 0 (or the known remainder). If any check fails, do
not add more liquidity — record the actual values and re-decide.

`scripts/create_quickswap_pool.js` performs steps 2–5 automatically in
its verify phase (execute mode) and prints the same checks in dry-run
mode without touching the network.

## 7. What this runbook does NOT cover

- Deploying the casino contracts (see `casino-deployment-plan.md` §3
  Phase C and `scripts/deploy_casino.js`).
- Funding the CasinoReserve (see `needs-brandon.md` §6).
- VRF subscription creation/funding (see `casino-deployment-plan.md` §2).
- Removing liquidity, or adding a second tranche later (a later add
  follows the *existing* pool ratio — it does not reset the price; the
  first add is the only price-setting one).
- Any frontend change: the site must not advertise the pool until §6
  passes and the frontend QA gate passes.
