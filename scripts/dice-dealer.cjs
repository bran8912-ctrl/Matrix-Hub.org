#!/usr/bin/env node
/**
 * dice-dealer.cjs — Dice dealer for Matrix Hub (HUB task 133, first dealer).
 *
 * WHAT THIS IS
 *   A READ-ONLY monitor for Dice bets on CasinoCore (Polygon mainnet).
 *   It enumerates every Dice bet from contract state, classifies each one,
 *   and files a written refund-evidence report for any bet that is still
 *   Pending past CasinoCore's on-chain refund timeout
 *   (STUCK_BET_REFUND_TIMEOUT, 1 hour — see contracts/CasinoCore.sol,
 *   refundStuckBet / refundableAt). Governance can act on that evidence
 *   with refundStuckBet(betId); this script never does.
 *
 * HARD RULE — READ-ONLY BY CONSTRUCTION
 *   - No private keys, no signer, no wallet, no env secrets.
 *   - Only eth_call / eth_getLogs / eth_blockNumber via JsonRpcProvider.
 *   - It NEVER sends a transaction and cannot move funds.
 *   If a future step seems to need a key or a transaction, stop and report
 *   it instead — dealers never touch player funds.
 *
 * HOW BET ENUMERATION WORKS (grounded in the real CasinoCore ABI,
 * artifacts/contracts/CasinoCore.sol/CasinoCore.json — note that
 * src/abi/CasinoCore.json is a stale pre-Dice ABI and is NOT used):
 *   - Bet ids are sequential: placeDiceBet does `betId = ++nextBetId`, so
 *     the full bet set is exactly ids 1..nextBetId(). State enumeration is
 *     authoritative and does not depend on log availability.
 *   - getBet(betId) returns (player, amount, target, roll, status, win,
 *     payout) with status 0=None 1=Pending 2=Settled 3=Claimed 4=Refunded.
 *     It does NOT return placedAt or requestId, so those are enriched from
 *     events: BetPlaced (its block timestamp == bet.placedAt, which is set
 *     to block.timestamp in the same transaction) and BetRequested
 *     (betId -> VRF requestId + reservedPayout). Fallback for placedAt when
 *     the BetPlaced log is outside the lookback window:
 *     refundableAt(betId) - STUCK_BET_REFUND_TIMEOUT().
 *   - "Randomness never landed" evidence for a STUCK bet: status is still
 *     Pending at the scan block, no BetResolved log exists for the betId in
 *     the scanned window, and (when the requestId is known)
 *     requestToBetId(requestId) still maps to the betId — the mapping is
 *     only cleared by fulfillRandomness or refundStuckBet.
 *
 * USAGE
 *   node scripts/dice-dealer.cjs [--rpc <url>] [--core <address>]
 *     [--lookback-blocks <n>] [--from-block <n>] [--chunk-size <n>]
 *     [--timeout-seconds <n>] [--report-dir <path>] [--no-write]
 *
 *   Env equivalents: DICE_DEALER_RPC_URL, DICE_DEALER_CORE,
 *   DICE_DEALER_LOOKBACK_BLOCKS, DICE_DEALER_REPORT_DIR.
 *   Defaults: Polygon mainnet CasinoCore
 *   0x8a3dBD4BECcAAC89F818E7cB0246241c40938DcA via
 *   https://polygon-bor-rpc.publicnode.com, 250,000-block event lookback
 *   (~5.8 days at ~2s/block — covers the 2026-11-10 mainnet deployment;
 *   state classification never depends on it, events only enrich).
 *
 * OUTPUT
 *   - Console summary (counts: found / settled / pending / stuck / refunded).
 *   - Every run writes a dated run log to the report dir.
 *   - Each STUCK bet additionally gets its own dated evidence report.
 *   Exit code is 0 on a successful scan (STUCK findings are reported, not
 *   treated as a crash); 1 on scan failure.
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { ethers } = require('ethers');

// ---------------------------------------------------------------- config

const DEFAULTS = {
  rpcUrl: 'https://polygon-bor-rpc.publicnode.com',
  coreAddress: '0x8a3dBD4BECcAAC89F818E7cB0246241c40938DcA',
  lookbackBlocks: 250000,
  chunkSize: 2000,
  // Fallback only — the authoritative value is read on-chain from
  // STUCK_BET_REFUND_TIMEOUT() every run.
  timeoutSeconds: 3600,
};

function parseArgs(argv) {
  const opts = {
    rpcUrl: process.env.DICE_DEALER_RPC_URL || DEFAULTS.rpcUrl,
    coreAddress: process.env.DICE_DEALER_CORE || DEFAULTS.coreAddress,
    lookbackBlocks:
      Number(process.env.DICE_DEALER_LOOKBACK_BLOCKS) || DEFAULTS.lookbackBlocks,
    fromBlock: null,
    chunkSize: DEFAULTS.chunkSize,
    timeoutSeconds: null, // null = use on-chain value
    reportDir: process.env.DICE_DEALER_REPORT_DIR || null,
    write: true,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => {
      if (i + 1 >= argv.length) throw new Error(`Missing value for ${a}`);
      return argv[++i];
    };
    switch (a) {
      case '--rpc': opts.rpcUrl = next(); break;
      case '--core': opts.coreAddress = next(); break;
      case '--lookback-blocks': opts.lookbackBlocks = Number(next()); break;
      case '--from-block': opts.fromBlock = Number(next()); break;
      case '--chunk-size': opts.chunkSize = Number(next()); break;
      case '--timeout-seconds': opts.timeoutSeconds = Number(next()); break;
      case '--report-dir': opts.reportDir = next(); break;
      case '--no-write': opts.write = false; break;
      case '--help':
        console.log('Usage: node scripts/dice-dealer.cjs [--rpc <url>] [--core <address>] [--lookback-blocks <n>] [--from-block <n>] [--chunk-size <n>] [--timeout-seconds <n>] [--report-dir <path>] [--no-write]');
        process.exit(0);
        break;
      default:
        throw new Error(`Unknown argument: ${a} (see --help)`);
    }
  }
  if (!ethers.isAddress(opts.coreAddress)) {
    throw new Error(`Invalid CasinoCore address: ${opts.coreAddress}`);
  }
  return opts;
}

function defaultReportDir() {
  // Workspace layout: <matrix-hub>/repo/scripts/ -> <matrix-hub>/bot-core/games/dealer-reports
  const workspaceCandidate = path.resolve(
    __dirname, '..', '..', 'bot-core', 'games', 'dealer-reports'
  );
  if (fs.existsSync(path.resolve(__dirname, '..', '..', 'bot-core'))) {
    return workspaceCandidate;
  }
  // Standalone repo checkout: keep reports inside the repo.
  return path.resolve(__dirname, '..', 'dealer-reports');
}

// ------------------------------------------------------------------- ABI
// Minimal read-only ABI, copied from the compiled CasinoCore artifact
// (artifacts/contracts/CasinoCore.sol/CasinoCore.json). View/pure + events
// only — no state-changing function is even declared here.

const CASINO_CORE_ABI = [
  'function nextBetId() view returns (uint256)',
  'function totalBets() view returns (uint256)',
  'function totalWagered() view returns (uint256)',
  'function activeRandomnessRequests() view returns (uint256)',
  'function STUCK_BET_REFUND_TIMEOUT() view returns (uint256)',
  'function governance() view returns (address)',
  'function getBet(uint256 betId) view returns (address player, uint256 amount, uint8 target, uint8 roll, uint8 status, bool win, uint256 payout)',
  'function refundableAt(uint256 betId) view returns (uint256)',
  'function requestToBetId(uint256 requestId) view returns (uint256)',
  'event BetPlaced(uint256 indexed betId, address indexed player, uint256 amount, uint8 target)',
  'event BetRequested(uint256 indexed betId, uint256 indexed requestId, address indexed player, uint256 reservedPayout)',
  'event BetResolved(uint256 indexed betId, uint8 roll, bool win, uint256 payout)',
  'event BetRefunded(uint256 indexed betId, address indexed player, uint256 amount)',
  'event PayoutClaimed(uint256 indexed betId, address indexed player, uint256 payout)',
];

const STATUS_NAMES = ['None', 'Pending', 'Settled', 'Claimed', 'Refunded'];

// -------------------------------------------------------------- log scans

async function fetchLogsChunked(contract, filterFactory, fromBlock, toBlock, chunkSize, warnings) {
  const logs = [];
  for (let start = fromBlock; start <= toBlock; start += chunkSize) {
    const end = Math.min(start + chunkSize - 1, toBlock);
    try {
      const part = await contract.queryFilter(filterFactory(), start, end);
      logs.push(...part);
    } catch (err) {
      warnings.push(
        `eth_getLogs failed for blocks ${start}-${end}: ${err.shortMessage || err.message}. ` +
        'Event enrichment for that range is missing; state classification is unaffected.'
      );
    }
  }
  return logs;
}

// ------------------------------------------------------------------ main

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const reportDir = opts.reportDir || defaultReportDir();
  const warnings = [];

  const provider = new ethers.JsonRpcProvider(opts.rpcUrl);
  const network = await provider.getNetwork();
  if (network.chainId !== 137n) {
    warnings.push(`RPC reports chainId ${network.chainId}, expected 137 (Polygon mainnet). Continuing — verify the RPC URL.`);
  }
  const core = new ethers.Contract(opts.coreAddress, CASINO_CORE_ABI, provider);

  const latestBlock = await provider.getBlock('latest');
  if (!latestBlock) throw new Error('Could not read latest block from RPC.');
  const nowTs = latestBlock.timestamp; // scan "now" = chain time, not wall clock
  const nowIso = new Date(nowTs * 1000).toISOString();

  // --- authoritative counters + the on-chain timeout -------------------
  const [nextBetId, totalBets, totalWagered, activeRequests, onChainTimeout, governance] =
    await Promise.all([
      core.nextBetId(),
      core.totalBets(),
      core.totalWagered(),
      core.activeRandomnessRequests(),
      core.STUCK_BET_REFUND_TIMEOUT().catch(() => BigInt(DEFAULTS.timeoutSeconds)),
      core.governance().catch(() => null),
    ]);
  const timeoutSeconds =
    opts.timeoutSeconds != null ? opts.timeoutSeconds : Number(onChainTimeout);
  const betCount = Number(nextBetId);
  if (betCount > 100000) {
    throw new Error(`nextBetId=${betCount} is implausibly large for this monitor; refusing to iterate. Investigate before raising the cap.`);
  }

  // --- event enrichment (skipped entirely when there are no bets) ------
  const placedByBet = new Map();   // betId -> {blockNumber, txHash, timestamp|null, amount, target, player}
  const requestByBet = new Map();  // betId -> {requestId, reservedPayout, blockNumber, txHash}
  const resolvedBetIds = new Set();
  const refundedBetIds = new Set();
  let scanFromBlock = latestBlock.number;
  let scanToBlock = latestBlock.number;

  if (betCount > 0) {
    scanToBlock = latestBlock.number;
    scanFromBlock =
      opts.fromBlock != null
        ? opts.fromBlock
        : Math.max(0, scanToBlock - opts.lookbackBlocks + 1);

    const [placedLogs, requestedLogs, resolvedLogs, refundedLogs] = await Promise.all([
      fetchLogsChunked(core, () => core.filters.BetPlaced(), scanFromBlock, scanToBlock, opts.chunkSize, warnings),
      fetchLogsChunked(core, () => core.filters.BetRequested(), scanFromBlock, scanToBlock, opts.chunkSize, warnings),
      fetchLogsChunked(core, () => core.filters.BetResolved(), scanFromBlock, scanToBlock, opts.chunkSize, warnings),
      fetchLogsChunked(core, () => core.filters.BetRefunded(), scanFromBlock, scanToBlock, opts.chunkSize, warnings),
    ]);

    // Block timestamps for BetPlaced blocks (placedAt == that block's timestamp).
    const placedBlocks = [...new Set(placedLogs.map((l) => l.blockNumber))];
    const blockTs = new Map();
    for (const bn of placedBlocks) {
      const b = await provider.getBlock(bn);
      if (b) blockTs.set(bn, b.timestamp);
    }

    for (const log of placedLogs) {
      const betId = Number(log.args.betId);
      placedByBet.set(betId, {
        blockNumber: log.blockNumber,
        txHash: log.transactionHash,
        timestamp: blockTs.get(log.blockNumber) ?? null,
        player: log.args.player,
        amount: log.args.amount,
        target: Number(log.args.target),
      });
    }
    for (const log of requestedLogs) {
      requestByBet.set(Number(log.args.betId), {
        requestId: log.args.requestId.toString(),
        reservedPayout: log.args.reservedPayout,
        blockNumber: log.blockNumber,
        txHash: log.transactionHash,
      });
    }
    for (const log of resolvedLogs) resolvedBetIds.add(Number(log.args.betId));
    for (const log of refundedLogs) refundedBetIds.add(Number(log.args.betId));
  }

  // --- per-bet state read + classification ------------------------------
  const bets = [];
  for (let betId = 1; betId <= betCount; betId++) {
    const b = await core.getBet(betId);
    const status = Number(b.status);
    const statusName = STATUS_NAMES[status] || `Unknown(${status})`;

    // placedAt: event block timestamp first, refundableAt()-timeout fallback.
    let placedAt = placedByBet.get(betId)?.timestamp ?? null;
    let placedAtSource = placedAt != null ? 'BetPlaced event block timestamp' : null;
    if (placedAt == null && status !== 0) {
      try {
        placedAt = Number(await core.refundableAt(betId)) - timeoutSeconds;
        placedAtSource = 'refundableAt(betId) - STUCK_BET_REFUND_TIMEOUT';
      } catch {
        warnings.push(`Bet ${betId}: could not derive placedAt (no BetPlaced log in window, refundableAt reverted). Age unknown.`);
      }
    }

    const ageSeconds = placedAt != null ? nowTs - placedAt : null;
    let classification;
    if (status === 2 || status === 3) classification = 'settled'; // Settled or Claimed
    else if (status === 4) classification = 'refunded';
    else if (status === 1 && ageSeconds != null && ageSeconds > timeoutSeconds) classification = 'STUCK';
    else if (status === 1) classification = 'pending-within-timeout';
    else classification = 'unknown';

    const req = requestByBet.get(betId) || null;
    const bet = {
      betId,
      player: b.player,
      amountWei: b.amount.toString(),
      amountMtx: ethers.formatEther(b.amount),
      target: Number(b.target),
      roll: Number(b.roll),
      status,
      statusName,
      win: Boolean(b.win),
      payoutMtx: ethers.formatEther(b.payout),
      placedAt,
      placedAtIso: placedAt != null ? new Date(placedAt * 1000).toISOString() : null,
      placedAtSource,
      placedBlock: placedByBet.get(betId)?.blockNumber ?? null,
      placedTxHash: placedByBet.get(betId)?.txHash ?? null,
      requestId: req?.requestId ?? null,
      reservedPayoutMtx: req ? ethers.formatEther(req.reservedPayout) : null,
      refundableAt: placedAt != null ? placedAt + timeoutSeconds : null,
      refundableAtIso:
        placedAt != null ? new Date((placedAt + timeoutSeconds) * 1000).toISOString() : null,
      ageSeconds,
      classification,
      resolvedEventSeen: resolvedBetIds.has(betId),
    };

    // Extra STUCK evidence: the VRF request mapping is only cleared by
    // fulfillRandomness or refundStuckBet — if it still points at this bet,
    // the randomness callback demonstrably never landed.
    if (classification === 'STUCK' && bet.requestId != null) {
      try {
        bet.requestMappingStillOpen =
          (await core.requestToBetId(BigInt(bet.requestId))).toString() === String(betId);
      } catch {
        bet.requestMappingStillOpen = null;
      }
    }
    bets.push(bet);
  }

  const counts = {
    found: bets.length,
    settled: bets.filter((b) => b.classification === 'settled').length,
    pendingWithinTimeout: bets.filter((b) => b.classification === 'pending-within-timeout').length,
    stuck: bets.filter((b) => b.classification === 'STUCK').length,
    refunded: bets.filter((b) => b.classification === 'refunded').length,
    unknown: bets.filter((b) => b.classification === 'unknown').length,
  };
  const stuckBets = bets.filter((b) => b.classification === 'STUCK');

  const summary = {
    dealer: 'dice-dealer',
    game: 'Dice',
    contract: opts.coreAddress,
    chainId: Number(network.chainId),
    rpc: opts.rpcUrl,
    scanBlock: latestBlock.number,
    scanTimeUtc: nowIso,
    eventScanFromBlock: betCount > 0 ? scanFromBlock : null,
    eventScanToBlock: betCount > 0 ? scanToBlock : null,
    timeoutSeconds,
    timeoutSource: opts.timeoutSeconds != null ? 'CLI override' : 'on-chain STUCK_BET_REFUND_TIMEOUT()',
    nextBetId: betCount,
    totalBetsOnChain: totalBets.toString(),
    totalWageredMtx: ethers.formatEther(totalWagered),
    activeRandomnessRequests: activeRequests.toString(),
    governance,
    counts,
    warnings,
  };

  // --- console summary ---------------------------------------------------
  console.log('=== Dice Dealer — read-only scan ===');
  console.log(`Contract:        ${opts.coreAddress} (Polygon, chainId ${summary.chainId})`);
  console.log(`Scan block/time: ${latestBlock.number} / ${nowIso}`);
  console.log(`Refund timeout:  ${timeoutSeconds}s (${summary.timeoutSource})`);
  console.log(`nextBetId:       ${betCount}  totalBets: ${totalBets}  activeRandomnessRequests: ${activeRequests}`);
  console.log(`Bets found:      ${counts.found}`);
  console.log(`  settled:       ${counts.settled}`);
  console.log(`  pending (within timeout): ${counts.pendingWithinTimeout}`);
  console.log(`  STUCK (>timeout, refundable): ${counts.stuck}`);
  console.log(`  refunded:      ${counts.refunded}`);
  if (counts.unknown) console.log(`  unknown:       ${counts.unknown}`);
  for (const w of warnings) console.log(`WARNING: ${w}`);
  for (const bet of stuckBets) {
    console.log(
      `STUCK bet #${bet.betId}: player ${bet.player}, ${bet.amountMtx} MTX, ` +
      `placed ${bet.placedAtIso}, age ${bet.ageSeconds}s, VRF requestId ${bet.requestId ?? 'unknown'}`
    );
  }
  if (counts.found === 0) {
    console.log('No Dice bets exist on-chain yet (nextBetId = 0). Nothing to flag.');
  }

  // --- file output --------------------------------------------------------
  const stamp = nowIso.replace(/[:.]/g, '-');
  const written = [];
  if (opts.write) {
    fs.mkdirSync(reportDir, { recursive: true });

    const runLogPath = path.join(reportDir, `dice-dealer-run-${stamp}.md`);
    const lines = [
      `# Dice Dealer — run log`,
      ``,
      `- Scan time (chain): ${nowIso} (block ${latestBlock.number})`,
      `- Contract: \`${opts.coreAddress}\` (Polygon mainnet, chainId ${summary.chainId})`,
      `- RPC: ${opts.rpcUrl}`,
      `- Refund timeout: ${timeoutSeconds}s — source: ${summary.timeoutSource}`,
      `- Event scan window: ${betCount > 0 ? `blocks ${scanFromBlock}–${scanToBlock}` : 'skipped (nextBetId = 0, no bets can exist)'}`,
      `- On-chain counters: nextBetId=${betCount}, totalBets=${totalBets}, totalWagered=${summary.totalWageredMtx} MTX, activeRandomnessRequests=${activeRequests}`,
      `- Governance (only address that can call refundStuckBet): ${governance ?? 'unread'}`,
      ``,
      `## Counts`,
      ``,
      `| Class | Count |`,
      `|---|---|`,
      `| Bets found | ${counts.found} |`,
      `| Settled (incl. Claimed) | ${counts.settled} |`,
      `| Pending, within timeout | ${counts.pendingWithinTimeout} |`,
      `| STUCK (Pending past timeout) | ${counts.stuck} |`,
      `| Refunded | ${counts.refunded} |`,
      ...(counts.unknown ? [`| Unknown | ${counts.unknown} |`] : []),
      ``,
    ];
    if (bets.length) {
      lines.push(`## Bets`, ``, `| Bet | Player | Amount (MTX) | Target | Status | Placed (UTC) | Age (s) | VRF requestId | Class |`, `|---|---|---|---|---|---|---|---|---|`);
      for (const bet of bets) {
        lines.push(`| ${bet.betId} | ${bet.player} | ${bet.amountMtx} | ${bet.target} | ${bet.statusName} | ${bet.placedAtIso ?? 'unknown'} | ${bet.ageSeconds ?? 'unknown'} | ${bet.requestId ?? 'unknown'} | ${bet.classification} |`);
      }
      lines.push(``);
    } else {
      lines.push(`No Dice bets exist on-chain yet (nextBetId = 0). Nothing to flag.`, ``);
    }
    if (warnings.length) {
      lines.push(`## Warnings`, ``, ...warnings.map((w) => `- ${w}`), ``);
    }
    lines.push(`Read-only scan: no keys used, no transactions sent.`, ``);
    fs.writeFileSync(runLogPath, lines.join('\n'));
    written.push(runLogPath);

    const jsonPath = path.join(reportDir, `dice-dealer-run-${stamp}.json`);
    fs.writeFileSync(jsonPath, JSON.stringify({ summary, bets }, null, 2));
    written.push(jsonPath);

    for (const bet of stuckBets) {
      const evidencePath = path.join(reportDir, `dice-dealer-STUCK-bet-${bet.betId}-${stamp}.md`);
      const evidence = [
        `# Refund evidence — Dice bet #${bet.betId} (STUCK)`,
        ``,
        `Filed by the Dice dealer (read-only monitor). This report is evidence`,
        `for governance to evaluate \`refundStuckBet(${bet.betId})\` on CasinoCore.`,
        `The dealer does not and cannot execute the refund.`,
        ``,
        `## Bet`,
        ``,
        `- Bet id: ${bet.betId}`,
        `- Player: ${bet.player}`,
        `- Amount: ${bet.amountMtx} MTX (${bet.amountWei} wei)`,
        `- Dice target: ${bet.target}`,
        `- Status on-chain at scan: ${bet.statusName} (${bet.status})`,
        `- Placed at: ${bet.placedAtIso} (unix ${bet.placedAt}, block ${bet.placedBlock ?? 'unknown'}${bet.placedAtSource ? `, source: ${bet.placedAtSource}` : ''})`,
        `- Placement tx: ${bet.placedTxHash ?? 'unknown (outside event lookback window)'}`,
        `- VRF request id: ${bet.requestId ?? 'unknown (BetRequested log outside lookback window)'}`,
        `- Reserved payout at placement: ${bet.reservedPayoutMtx ?? 'unknown'} MTX`,
        ``,
        `## Why it is stuck`,
        ``,
        `- Scan time: ${nowIso} (block ${latestBlock.number}); bet age ${bet.ageSeconds}s exceeds the on-chain refund timeout of ${timeoutSeconds}s (refundable since ${bet.refundableAtIso}).`,
        `- Status is still Pending: \`fulfillRandomness\` never transitioned the bet to Settled.`,
        `- BetResolved event seen in scanned window for this bet: ${bet.resolvedEventSeen ? 'yes' : 'no'}.`,
        ...(bet.requestMappingStillOpen != null
          ? [`- \`requestToBetId(${bet.requestId})\` still maps to bet ${bet.betId}: ${bet.requestMappingStillOpen} — the mapping is cleared only by fulfilment or refund, so the VRF callback demonstrably never landed.`]
          : []),
        ``,
        `## Suggested action (governance only)`,
        ``,
        `Governance (${governance ?? 'see CasinoCore.governance()'}) may call`,
        `\`refundStuckBet(${bet.betId})\`, which refunds the player's full stake`,
        `from CasinoReserve and marks the bet Refunded. A late VRF callback`,
        `afterwards is a harmless no-op in the contract.`,
        ``,
        `Read-only evidence: gathered with eth_call/eth_getLogs only; no keys,`,
        `no transactions.`,
        ``,
      ];
      fs.writeFileSync(evidencePath, evidence.join('\n'));
      written.push(evidencePath);
    }
    for (const p of written) console.log(`Wrote: ${p}`);
  }

  return { summary, bets, written };
}

main().catch((err) => {
  console.error(`Dice dealer scan FAILED: ${err.shortMessage || err.message}`);
  process.exit(1);
});
