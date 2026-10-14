# Polygon Contract Verification Investigation

## Executive summary

The original bulk verification attempts did not verify contracts under their
configured names. The verifier has since been corrected and the user-selected
MTX token at `0x53307e1db6c5cb6773c9495ca140372016dfe266` was successfully
verified on Polygonscan. The expanded on-chain checks showed that the original
address map was materially wrong: its MTX address was not a standard ERC-20,
the separate `matrixHubCoin` address is a Safe multisig, three other
configured addresses contain identical MTX token code, and two contain
identical RNG engine code in the original labelled set. A complete scan of
the deployer's creation history found a third RNGEngine deployment, a fourth
MTX clone, and a separate misconfigured LiquidityRouter deployment.

Three MTX deployments are reported by Polygonscan as source-verified
`MatrixHubCoin` contracts. A fourth bytecode-identical MTX clone was found as
the constructor token of the bad router, but was not part of the verified
address set. The user designated
`0x53307e1db6c5cb6773c9495ca140372016dfe266` (previously labeled `rngEngine`)
as canonical MTX; the application uses that address by default. The
designation is the user's explicit selection, not a conclusion derivable from
bytecode or chain activity. All three RNG engine deployments have also been
source-verified under their actual type. One verified instance is mapped as the
RNG module, but it is not linked to a CasinoCore, so the casino remains
unavailable.

No new contracts were deployed. The token mapping was updated to record the
user's selection; casino module mappings remain unresolved and should not
be treated as operational.

### Canonical-address conclusion

The three source-verified candidates share the same creation input, owner,
supply cap, zero total supply, and runtime; a fourth bytecode-identical clone
was found in router constructor data. None has any ERC-20 transfer
transaction. Chain evidence alone cannot choose among them. The user designated
`0x53307e1db6c5cb6773c9495ca140372016dfe266` as canonical in this conversation
on 2026-10-14. This is a recorded user choice, not on-chain proof of ownership.
It was previously labeled `rngEngine` in the configuration and
in the [owner-provided address mapping in PR #165](https://github.com/bran8912-ctrl/Matrix-Hub.org/pull/165#issuecomment-6157957328).
That mapping's `mtxToken` address remains the unrelated `POL`-symbol contract,
and `matrixHubCoin` remains a Safe multisig.

## Observed addresses and configuration status

The [contract configuration](../src/config/contracts.js) uses the designated
MTX token and leaves unvalidated casino modules unset:

| Configuration name | Polygon address | Confirmed on-chain evidence |
|---|---|---|
| `mtxToken` (user-designated canonical token) | `0x53307e1db6c5cb6773c9495ca140372016dfe266` | Polygonscan-verified `MatrixHubCoin`; compiler 0.8.34, optimizer 200, EVM `osaka`, constructor `(100000000, deployer)`. Currently zero supply. Previously labeled `rngEngine`. |
| `matrixHubCoin` | `0x7Ee41D8A25641000661B1EF5E6AE8A00400466B0` | Verified `SafeProxy`, with verified `SafeL2` implementation at `0x29fcb43b46531bca003ddc8fcb67ffe91900c762`; six owners, threshold three. It is a multisig, not the MTX token. |
| `casinoReserve` | Unset | No valid deployment found in the deployer's Polygon creation history. The previous `0x70561ac30aedee7a09cb3840a1c7e441fd80195f` assignment is a verified `RNGEngine`, not a reserve. |
| `rngEngine` | `0xe523dc928bf6f0406a4912d8bd722329f11d1c0c` | Verified `RNGEngine`, Solidity 0.8.34, runtime 1,106 bytes; owner is the configured deployer, but its `casinoCore` is zero. |
| `liquidityRouter` | Unset | A Router deployment exists at `0x80e59c11f4c94f3f80593895da300e1e7ec01aea`, but its MTX constructor argument is clone `0xf3854238fcd54ecf3594280687efa8b293913284` and its `dexPool` is the deployer, not a DEX pool. It cannot be changed after deployment. |
| `casinoCore` | Unset | No valid deployment found in the deployer's Polygon creation history. The previous `0x2fbee7a063dafc8adadfaa1c351796407454a1e0` assignment is a verified `RNGEngine`, not a casino core. |
| `interfaces` | `0xf92401e65236e8bb2f016742fe24a9a49969ee32` | Source-verified `MatrixHubCoin`, not an interfaces contract. |

The application uses the user-designated token, maps the verified but unlinked
RNGEngine, and leaves casino core, reserve, and router unset. The distinct
`matrixHubCoin` and `interfaces` entries still need to be reconciled with the
intended deployment inventory.
The corrected [verification script](../scripts/verify_all_polygon.js)
preflights the selected token on-chain and verifies only that token; casino
modules are explicitly excluded until valid deployments are identified.

## Bytecode and source findings

Deployed runtime code was fetched from Polygon through dRPC. The bytecode
lengths and Solidity compiler versions encoded in their metadata were:

| Configured address name | Runtime length | Metadata compiler marker |
|---|---:|---|
| `mtxToken` | 1,667 bytes | 0.8.35 |
| `casinoReserve` | 1,106 bytes | 0.8.34 |
| `rngEngine` | 3,995 bytes | 0.8.34 |
| `liquidityRouter` | 3,995 bytes | 0.8.34 |
| `casinoCore` | 1,106 bytes | 0.8.34 |

The 1,106-byte runtime at `casinoReserve` and `casinoCore` matches the full
runtime, including Solidity metadata, of the historical `RNGEngine` source at
commit `5428e50bd6f48c2a4abb5d36117f24f38cdfb1f6`, compiled with Solidity
0.8.34, optimizer runs 200, and EVM target `osaka`. A third deployment at
`0xe523dc928bf6f0406a4912d8bd722329f11d1c0c` has the same verified runtime.
All three creation transactions pass a zero address to the one-address
`RNGEngine` constructor. On-chain reads for the mapped instance show owner
`0x9fb4bb44d8d962d695fc93b3dc15f1b287391077`, zero casino-core address, zero
client seed, zero server seed hash, and nonce 0.

The three identical 3,995-byte runtimes at `rngEngine`, `liquidityRouter`, and
`interfaces` match the executable bytecode of the historical `MatrixHubCoin`
source at commit `5d72375643d8ec1728b5078b9d320ac6a43ad5f4`, compiled with
Solidity 0.8.34, optimizer runs 200, and EVM target `osaka`. The canonical
candidate was successfully verified on Polygonscan with those settings and
the current source, which is byte-for-byte identical to that historical
source. The explorer source endpoint now reports all three addresses as
verified `MatrixHubCoin` contracts. All three creation transactions pass
constructor arguments `100000000` and
`0x9fb4bb44d8d962d695fc93b3dc15f1b287391077`. On-chain getters report name
`Matrix-HubCoin`, symbol `MTX`, maximum supply `100000000000000000000000000`
(100 million MTX at 18 decimals), and current total supply zero.

The creation transaction inputs for all three MatrixHubCoin deployments are
exactly identical (5,202 bytes; SHA-256
`6aabebcaef35dbd5292aec51ee9d2abb75c7af715528f2357b0782deeb4fd183`).
They were submitted by the same deployer at transaction nonces 2, 3, and 5,
respectively. This supports that they are duplicate instances of the same
deployment input, not distinct candidate configurations. The matching
addresses were originally entered in the owner-provided mapping as ecosystem
modules, not as the core MTX token.

The deployed `LiquidityRouter` candidate is at
`0x80e59c11f4c94f3f80593895da300e1e7ec01aea` (455 runtime bytes). Its
constructor input decodes to MTX `0xf3854238fcd54ecf3594280687efa8b293913284`,
not the user-selected canonical token, and `dexPool`
`0x9fb4bb44d8d962d695fc93b3dc15f1b287391077`, the deployer address. Neither
value can be changed after deployment, so the candidate must not be configured
or used.

The deployed candidate is immutable and unusable. The replacement source now
targets QuickSwap V2: CasinoCore transfers its MTX fee allocation into a
pending balance, while the owner separately supplies native POL through
`addLiquidityETH`. This avoids spending or assuming a paired-asset balance
during player bets. The first successful V2 liquidity call can create the
MTX/WMATIC pair. The new router and casino modules have not been deployed, so
their live configuration remains unset.

The deployment script now requires explicit MTX, QuickSwap V2 router, and
maximum-payout settings for the selected network, validates contract code
before sending deployments, and wires the module permissions after CasinoCore
is deployed. It does not submit transactions unless explicitly run.

The [MTX configuration](../src/config/mtx.ts) now defaults to the user's
designated clone, while `MTX_CONTRACT_ADDRESS` can override it. The standalone
Remix deployment helper [deploy_mtx_remix.js](../scripts/deploy_mtx_remix.js)
specifies a one-billion-token cap, while the three on-chain clones use
100 million. That inconsistency means the helper is not evidence that a
different canonical token was deployed.

The originally configured `mtxToken` address (no longer configured as MTX) is
different from the selected token: its runtime metadata indicates
compiler 0.8.35, and its decoded symbol is `POL`. Public selector lookups
identify its two nonstandard transfer methods as `transferOne(address,address,uint256)`
and `transfer(address[],address[],uint256[])`. Read-only calls to standard
ERC-20 methods `balanceOf`, `totalSupply`, and `transfer(address,uint256)` do
not succeed. No matching project source was found for this address.

The historical scan covered 33 project Solidity source variants. Fifty-eight
source/compiler combinations compiled using cached Solidity 0.8.34 and 0.8.35
compilers, optimizer enabled with 200 runs, and EVM version `osaka`. The scan
found the MatrixHubCoin and RNGEngine matches described above, but no matching
project-source runtime for the originally configured `mtxToken` address.
Eight variants
did not compile because they had source errors or missing context; all
compilable variants were compared against the configured runtimes.

The Remix artifacts found in the workspace use compiler 0.8.31, optimizer
enabled with 200 runs, and EVM version `osaka`. Their recorded runtime lengths
were:

| Remix artifact | Runtime length |
|---|---:|
| `MatrixHubCoin` | 3,995 bytes |
| `CasinoReserve` | 971 bytes |
| `RNGEngine` | 915 bytes |
| `LiquidityRouter` | 455 bytes |
| `CasinoCore` | 1,910 bytes |

The Remix artifact source hashes identify source snapshots also present in Git
history, including `MatrixHubCoin.sol` at commit `fb5312e` and several casino
sources at commit `ba3e62d`. Those snapshots did not establish that the
corresponding configured addresses were deployed from those named contracts.
Matching compiler settings alone is not sufficient to verify a contract;
the source, imports, constructor arguments, and deployed bytecode must agree.

## Verification and network status

- The Polygonscan API key loaded from the local, ignored `.env` file and was
  confirmed active through Etherscan V2 API responses. The key is intentionally
  not recorded here.
- [hardhat.config.cjs](../hardhat.config.cjs) uses the Etherscan V2-compatible
  single API key setting. `MatrixHubCoin` is compiled with Solidity 0.8.34,
  optimizer runs 200, and EVM `osaka` to match the deployed bytecode; other
  project contracts retain the 0.8.20 compiler profile.
- The default Polygon RPC URL, `https://polygon-rpc.com/`, returned a
  tenant-disabled 403 for `eth_getCode` in this environment. The application
  now defaults to the working endpoint below; a `POLYGON_RPC_URL` override is
  still supported.
- `https://polygon.drpc.org` successfully returned contract code and was used
  for the bytecode checks and the verification preflight.

- The previous bulk verification attempts completed with **0 of 5 contracts
  verified**. After identifying the actual deployed types, the historical
  `RNGEngine` source was successfully verified on Polygonscan for
  `0x70561ac30aedee7a09cb3840a1c7e441fd80195f`; the explorer then reported the
  matching `0x2fbee7a063dafc8adadfaa1c351796407454a1e0` deployment as already
  verified. Both explorer records show Solidity 0.8.34, optimizer runs 200,
  EVM `osaka`, and `RNGEngine`.
- On 2026-10-14, the corrected script successfully verified the selected
  `MatrixHubCoin` source at
  [`0x53307e1db6c5cb6773c9495ca140372016dfe266`](https://polygonscan.com/address/0x53307e1db6c5cb6773c9495ca140372016dfe266#code).
- The corrected verification script preflights Polygon chain ID, token name,
  symbol, decimals, owner, and supply cap. It submits only the selected MTX
  token with constructor arguments `100000000` and the configured deployer.
  It does not submit verification for any casino module.
- Polygonscan accepted the selected token as `MatrixHubCoin`; its V2 source
  endpoint confirms compiler `v0.8.34+commit.80d5c536`, optimizer enabled with
  200 runs, EVM `osaka`, and published source. This confirms successful source
  verification, not operational readiness or token liquidity.
- `npx hardhat compile --force` succeeded with the restored project compiler
  configuration. A local build succeeding does not establish that its output
  matches any of the deployed runtimes.

## Other searches completed

- Inspected the Remix artifact and build-info directories and the cached
  dependency/source snapshots under `.deps` and related folders.
- Searched Git history for project Solidity source versions and compared
  compiled runtimes across the historical variants.
- Extracted the Solidity IPFS metadata identifiers from the deployed bytecode.
  Public IPFS gateways tried during the investigation were rate-limited,
  unavailable, timed out, or required payment.
- Checked Sourcify full and partial match records for the investigated
  addresses; no records were found.
- Queried Etherscan V2 contract source and creation records for the investigated
  addresses. The selected MTX token, Safe proxy, and all three RNGEngine instances
  are source-verified. The Etherscan V2 endpoint now reports all three
  MatrixHubCoin clones as source-verified with compiler 0.8.34, optimizer
  200, and EVM `osaka`. Creation transactions and receipts were also checked
  through Polygon RPC.
- Submitted the exact historical RNGEngine standard JSON source and zero
  constructor argument for the `casinoReserve` address. Polygonscan returned
  `Pass - Verified`; it identifies the contract as RNGEngine, not CasinoReserve.
- Submitted source verification for the user-selected MTX candidate using the
  historical constructor arguments and matching compiler settings; Polygonscan
  returned success. No separate submissions were made for the other MTX clones
  or the casino module addresses.
- The shared `file_package.json` snapshot describes OpenZeppelin Contracts
  version 5.4.0 package metadata. It is dependency information, not a Remix
  deployment artifact or a record of deployed contract addresses.

## Deployment transaction observations

All creation receipts for the following transactions succeeded. The four
module-labeled addresses and the `interfaces` address were created by the
configured deployer in a short sequence on 2026-10-12; their observed runtime
types and constructor arguments are shown below.

| Configured label | Creation time (UTC) | Creation transaction | Observed type / constructor |
|---|---|---|---|
| `mtxToken` | 2026-10-12 13:58:09 | [`0x290120…0adcd`](https://polygonscan.com/tx/0x290120b133ae6dfea40d5d75e2b6fb318a032990700513e7d25b47d3c1b0adcd) | Creator is `0x43b2f01186fda9814c5f40770554ac68fd8304bd`; symbol `POL`, not a standard ERC-20 |
| `matrixHubCoin` | 2025-09-02 17:06:08 | [`0x6f7fdf…02aa`](https://polygonscan.com/tx/0x6f7fdf5f1848e174c53944ef579648c8e0f53c9479f9dfff2022cdf3781e02aa) | Safe proxy creation through factory `0x4e1dcf7ad4e460cfd30791ccc4f9c8a4f820ec67`; singleton is SafeL2 |
| `casinoReserve` | 2026-10-12 21:10:08 | [`0xc35da4…ef01`](https://polygonscan.com/tx/0xc35da432aa4ab30790f491bc4ab87b044cffae940df04966438e216a489cef01) | `RNGEngine(address(0))` |
| `rngEngine` | 2026-10-12 21:10:12 | [`0xf7aebc…21ef1`](https://polygonscan.com/tx/0xf7aebcb5df8aa402ad96ef88deb64a84df606545e641da7863e05e748af21ef1) | `MatrixHubCoin(100000000, deployer)` |
| `liquidityRouter` | 2026-10-12 21:10:17 | [`0x206bbb…a5c9`](https://polygonscan.com/tx/0x206bbb10e54e2b937b90611b31d1954ebaca9e4acf9b62cbb38a9591495aa5c9) | `MatrixHubCoin(100000000, deployer)` |
| `casinoCore` | 2026-10-12 21:10:20 | [`0xfc56fa…0f36`](https://polygonscan.com/tx/0xfc56fa068238a4ab9637c71892c6cbc202ed9c18bdd18e024428b016c4500f36) | `RNGEngine(address(0))` |
| `interfaces` | 2026-10-12 21:10:29 | [`0x3918d3…d2f5`](https://polygonscan.com/tx/0x3918d3b526e26fe4b6c718e4c86f99d0ff5f80d1bef6435fed70e9a93c60d2f5) | `MatrixHubCoin(100000000, deployer)` |

Scanning all 15 contract-creation transactions from the deployer found two
additional relevant deployments omitted from the old mapping:

| Actual type | Address | Creation transaction | Constructor evidence |
|---|---|---|---|
| `RNGEngine` | `0xe523dc928bf6f0406a4912d8bd722329f11d1c0c` | [`0x4915ac…2326`](https://polygonscan.com/tx/0x4915ac24ca2933261d1b6f0f0679c0f5fb99cf398963c3b5a88e7825d922326f) | Verified source, nonce 0; zero `casinoCore`; selected as the correct-type RNG address. |
| `LiquidityRouter` | `0x80e59c11f4c94f3f80593895da300e1e7ec01aea` | [`0x86ed04…2dd7`](https://polygonscan.com/tx/0x86ed0419d93512a2b39f286245dd9ec2da39f6a4dce5e4d69a0775ba95a82dd7) | MTX constructor argument is clone `0xf3854238fcd54ecf3594280687efa8b293913284`; `dexPool` is the deployer EOA. |

The deployed router is not safe to configure: neither constructor address can
be updated. Its implementation only transfers MTX directly to `dexPool`; it
does not call a DEX router, pair, or position manager and does not supply the
paired asset.
The QuickSwap V2 factory currently returns the zero address for a pair between
the canonical MTX token and WMATIC; no MTX/WMATIC V2 pool exists yet.

The three source-verified MatrixHubCoin deployments have identical runtime
bytes and identical constructor arguments; the three RNGEngine deployments
have identical runtime bytes and constructor arguments. This confirms
duplicated deployments but does not independently identify the canonical
token; the user's selection is recorded above.

The router's MTX constructor argument,
`0xf3854238fcd54ecf3594280687efa8b293913284`, is a fourth MTX clone (creation
nonce 6) with 3,995-byte runtime. It is not the canonical token and should not
be configured.

## Current mainnet launch readiness (checked 2026-10-14)

Read-only RPC checks at Polygon block `95505363` confirmed:

| Check | Result |
|---|---|
| Chain | Polygon, chain ID 137 |
| Canonical MTX owner | `0x9fb4bb44d8d962d695fc93b3dc15f1b287391077`, matching the configured deployer |
| Maximum supply / current supply | 100,000,000 MTX / 0 MTX |
| Direct mint rate / minting | 1,000 MTX per POL / not paused |
| Owner native balance | About 45.10 POL at check time |
| QuickSwap V2 MTX/WMATIC pair | Does not exist |
| Local deployer key | Not configured in this workspace; no transaction can be signed here |
| Effective router / max-payout deployment settings | Not configured |

The Polygon QuickSwap V2 Router02 address in `.env.example` was checked on
Polygon and has contract code; its `WETH()` returns WMATIC
`0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270`. This is a router dependency,
not a pool address. The pool must be bootstrapped with an initial token/native
ratio, which establishes the market price. The existing MTX direct-purchase
rate is 1,000 MTX per POL, but matching it with a pool ratio is a financial
choice, not an automatically approved funding instruction.

The production `/mtx-contract` and `/buy-mtx` pages returned HTTP 200 but still
omit the canonical token address and use MATIC wording. The local production
build includes the canonical address and POL wording on both pages; it has not
been published. The full Hardhat suite passes (28 tests), and `npm run build`
completes successfully.

The code changes since the preceding investigation update are source changes
only; no contracts have been deployed. `LiquidityRouter` now has an
owner-only initial MTX queue and QuickSwap V2 liquidity flow; `CasinoCore`
must be redeployed because its liquidity interface changed. `CasinoReserve`
has an owner-funded, balance-accounted bootstrap method, and bet reserve
allocations now transfer MTX before being credited. CasinoCore house-result
accounting is signed so a winning payout larger than one wager does not revert.
These changes are covered by local tests, but are not yet independently
audited or tested against a real pool.

The old synchronous `RNGEngine` and its Polygon deployment are not configured
for use. The replacement source now uses Chainlink VRF v2.5 and asynchronous
bet settlement. The user selected a limited initial release: single-round
Dice only. The Dice UI submits an MTX approval/bet, waits for the VRF result,
shows the on-chain roll, and requires winners to claim payouts. Other browser-
random game pages are disabled. The helper no longer transfers MTX directly
to the reserve, and the `/api/place-bet` route explicitly reports that it does
not submit wagers.

This is a source-code conversion, **not a live deployment or launch approval**.
The contracts have not yet been tested against a real VRF subscription or
audited. The deployment script supports Polygon and Amoy, automatically
registers the RNG consumer, and requires a Polygon release flag after Amoy
end-to-end testing and independent security review.

### Chainlink VRF v2.5 configuration

The following values were checked against Chainlink's
[current supported-networks reference](https://docs.chain.link/vrf/v2-5/supported-networks):

| Network | Coordinator | Key hash / gas lane | Official LINK token |
|---|---|---|---|
| Polygon (137) | `0xec0Ed46f36576541C75739E915ADbCb3DE24bD77` | 200 gwei: `0x0ffbbd0c1c18c0263dd778dadd1d64240d7bc338d95fec1cf0473928ca7eaf9e` | `0xb0897686c545045aFc77CF20eC7A532E3120E0F1` |
| Amoy (80002) | `0x343300b5d84D444B2ADc9116FEF1bED02BE49Cf2` | 500 gwei: `0x816bedba8a50b294e5cbd47842baf240c2385f2eaf719edbd4f250a137a8c899` | `0x0fd9e8d3af1aaee056eb9e802c3a762a667b1904` |

The consumer requests one word with three confirmations, a 250,000 gas
callback limit, and LINK subscription billing. Polygon bridge LINK is not
ERC-677 compatible for Chainlink; fund the subscription with the official
Polygon LINK token listed above. Recheck the official table before deployment
because coordinator parameters can change.

Before Amoy deployment, the deployer must create and LINK-fund a VRF
subscription, deploy an MTX test token, configure the Amoy QuickSwap V2 router
and `CASINO_MAX_PAYOUT_PER_BET`, and use a local signing key that is never
shared in chat. Before Polygon deployment, select reserve funding and pool
seed amounts/ratio, review the maximum payout, complete end-to-end Amoy tests,
and complete an independent contract security review. No transaction has
been sent from this workspace.

To proceed after the randomness redesign and Amoy test, the owner must
configure the deployer key in a secure local secret store (never send it in
chat), choose initial pool and reserve funding amounts, and provide the
maximum-payout policy. The launch then requires minting within the token cap,
funding the reserve, seeding the initial pool, deploying and verifying the
modules, and only then updating frontend addresses. The current deployer
balance is a read-only snapshot and is not authorization to spend it.

## Files relevant to the investigation

- [Contract address configuration](../src/config/contracts.js)
- [Hardhat configuration](../hardhat.config.cjs)
- [Bulk Polygon verification script](../scripts/verify_all_polygon.js)
- [Remix artifacts](../_.artifacts/)
- [Contract sources](../contracts/)
