// The Glass Wall — Clubhouse Phase 2, the live transparency room.
//
// This room's whole job is to show real numbers or say it couldn't.
// Chain figures come from the MTX Live Terminal lib
// (src/lib/mtxTerminal.ts): fresh eth_calls against Polygon mainnet
// with keyless-endpoint failover, per-field nulls on total failure —
// the panel renders an explicit "read failed" state for a null field
// and never backfills it with prose or a remembered number.
//
// The two JSON feeds (status, crew log) are configured in
// src/config/glass-wall.ts, which also documents their contracts.
// Fetchers here validate and normalize whatever arrives: an entry
// that doesn't parse is dropped, a feed that doesn't answer returns
// null, and the panel shows an honest "feed unreachable" state —
// distinct from the "not wired yet" state an empty config URL gives.
import { Contract, JsonRpcProvider, formatUnits } from 'ethers';
import {
  fetchTerminalSnapshot,
  scanUrl,
  TERMINAL_CONTRACTS,
  TERMINAL_RPCS,
  type TerminalSnapshot,
} from './mtxTerminal';

export { fetchTerminalSnapshot, scanUrl, TERMINAL_CONTRACTS };
export type { TerminalSnapshot };

/** The five live contracts the /security proof pack publishes. */
export const VERIFIED_CONTRACT_COUNT = 5;

// ---------------------------------------------------------------------------
// Receipts — claim-badges in the Shields pattern (label segment + value
// segment). A badge exists only when its backing evidence exists: the
// proof-pack badge traces to the published proof pack; every "live"
// badge is built from a field of the snapshot THIS page just read, and
// disappears (replaced by an explicit note) when that read failed.
// ---------------------------------------------------------------------------

export interface ReceiptBadge {
  label: string;
  value: string;
  /** shields-style value-segment colour name. */
  tone: 'green' | 'yellow' | 'red' | 'gray';
  /** Where a visitor can check this claim themselves. */
  href?: string;
}

export function buildReceipts(
  snap: TerminalSnapshot | null,
  casino?: CasinoLimits | null,
): ReceiptBadge[] {
  const badges: ReceiptBadge[] = [
    {
      label: 'contracts verified',
      value: `${VERIFIED_CONTRACT_COUNT} on PolygonScan`,
      tone: 'green',
      href: '/security',
    },
  ];
  if (!snap) return badges;
  if (snap.maticToMtxRate !== null && snap.blockNumber !== null) {
    badges.push({
      label: 'mint rate · read live',
      value: `1 POL = ${snap.maticToMtxRate} MTX · block ${snap.blockNumber.toLocaleString('en-US')}`,
      tone: 'green',
      href: scanUrl(TERMINAL_CONTRACTS.mtx),
    });
  }
  if (snap.totalSupply !== null) {
    badges.push({
      label: 'total supply · read live',
      value: `${snap.totalSupply} MTX`,
      tone: 'green',
      href: scanUrl(TERMINAL_CONTRACTS.mtx),
    });
  }
  if (snap.reserveMtx !== null) {
    badges.push({
      label: 'casino reserve · read live',
      value: `${snap.reserveMtx} MTX`,
      tone: 'green',
      href: scanUrl(TERMINAL_CONTRACTS.casinoReserve),
    });
  }
  if (snap.mintingPaused !== null) {
    badges.push({
      label: 'minting · read live',
      value: snap.mintingPaused ? 'paused' : 'open',
      tone: snap.mintingPaused ? 'yellow' : 'green',
      href: scanUrl(TERMINAL_CONTRACTS.mtx),
    });
  }
  // The casino badge follows the same rule as every live badge above:
  // it is built only from the max-payout figure the casino panel's own
  // read (fetchCasinoLimits, below) returned on THIS page load, and is
  // omitted entirely when that read failed.
  if (casino?.maxPayoutMtx != null) {
    badges.push({
      label: 'max payout · read live',
      value: `${casino.maxPayoutMtx} MTX`,
      tone: 'green',
      href: scanUrl(CASINO_CORE_ADDRESS),
    });
  }
  // The VRF badge follows the identical rule: it is built only from
  // snap.vrfLink — the LINK balance the Terminal snapshot's
  // getSubscription read returned on THIS page load, the same field
  // the VRF panel below renders (already formatted to 4dp by the
  // Terminal lib). It is omitted entirely when that read failed or
  // the field is null; no stored or default figure ever prints here.
  if (snap.vrfLink !== null) {
    badges.push({
      label: 'VRF fuel · read live',
      value: `${snap.vrfLink} LINK`,
      tone: 'green',
      href: scanUrl(TERMINAL_CONTRACTS.vrfCoordinator),
    });
  }
  return badges;
}

// ---------------------------------------------------------------------------
// Casino — live reads from CasinoCore, the contract every Dice bet is
// placed under. The four limits below are the contract's own public
// getters (names and semantics from the verified source in the proof
// pack, bot-core/security/public-proof-pack-2026-11-12.md §3 + the
// stuck-bet addendum): minBet(), maxBet(), maxPayoutPerBet() — all in
// MTX wei — and STUCK_BET_REFUND_TIMEOUT() in seconds. Nothing is
// hard-coded: a figure appears only when its read just returned it,
// and each read fails over across the same keyless endpoints, with
// the same per-read ceiling and one-pass rule, as the Terminal lib.
// (The Terminal lib's failover helpers are module-private, so the
// pattern is re-run here in miniature rather than imported.)
// ---------------------------------------------------------------------------

/** CasinoCore — Dice-only build, verified on PolygonScan (proof pack). */
export const CASINO_CORE_ADDRESS = '0x8a3dBD4BECcAAC89F818E7cB0246241c40938DcA';

const CASINO_CORE_ABI = [
  'function minBet() view returns (uint256)',
  'function maxBet() view returns (uint256)',
  'function maxPayoutPerBet() view returns (uint256)',
  'function STUCK_BET_REFUND_TIMEOUT() view returns (uint256)',
];

export interface CasinoLimits {
  /** Polygon block height at read time, or null if that read failed. */
  blockNumber: number | null;
  /** Minimum bet, formatted MTX (e.g. "1"), or null on failure. */
  minBetMtx: string | null;
  /** Maximum bet, formatted MTX (e.g. "1,000"), or null on failure. */
  maxBetMtx: string | null;
  /** Max payout per bet, formatted MTX (e.g. "100"), or null. */
  maxPayoutMtx: string | null;
  /** Stuck-bet refund timeout exactly as read, in seconds, or null. */
  stuckTimeoutSeconds: number | null;
  /** The same timeout rendered for humans (e.g. "1 hour"), or null. */
  stuckTimeoutLabel: string | null;
  /** When this read finished (client clock). */
  fetchedAt: Date;
}

function fmtMtx(units: bigint): string {
  const n = Number(formatUnits(units, 18));
  return n.toLocaleString('en-US', { maximumFractionDigits: 4 });
}

/** Render a duration in seconds honestly: 3600 → "1 hour". */
export function fmtDuration(totalSeconds: number): string {
  const parts: string[] = [];
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) parts.push(`${hours} hour${hours === 1 ? '' : 's'}`);
  if (minutes > 0) parts.push(`${minutes} minute${minutes === 1 ? '' : 's'}`);
  if (seconds > 0 || parts.length === 0)
    parts.push(`${seconds} second${seconds === 1 ? '' : 's'}`);
  return parts.join(' ');
}

const CASINO_READ_TIMEOUT_MS = 10_000;

function casinoDelay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function casinoWithTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`RPC read timed out after ${ms} ms`)),
      ms,
    );
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

async function casinoAttempt<T>(
  providers: JsonRpcProvider[],
  read: (provider: JsonRpcProvider) => Promise<T>,
): Promise<T | null> {
  for (let i = 0; i < providers.length; i += 1) {
    if (i > 0) await casinoDelay(700);
    try {
      return await casinoWithTimeout(read(providers[i]), CASINO_READ_TIMEOUT_MS);
    } catch {
      // This endpoint failed or timed out — fall over to the next one.
    }
  }
  return null;
}

/**
 * Read the four CasinoCore limits fresh from Polygon. Each getter is
 * read independently and fails over on its own: one failing call nulls
 * only its own row (and only after every endpoint failed it), never
 * the whole panel — the same contract the Terminal snapshot follows.
 */
export async function fetchCasinoLimits(): Promise<CasinoLimits> {
  // staticNetwork pinned for the same reason as in mtxTerminal.ts:
  // a dead endpoint must fail fast, not retry network detection forever.
  const providers = TERMINAL_RPCS.map(
    (url) => new JsonRpcProvider(url, 137, { staticNetwork: true }),
  );
  const read = <T>(fn: (provider: JsonRpcProvider) => Promise<T>) =>
    casinoAttempt(providers, fn);
  const core = (p: JsonRpcProvider) =>
    new Contract(CASINO_CORE_ADDRESS, CASINO_CORE_ABI, p);

  const [blockNumber, minBet, maxBet, maxPayout, timeout] = await Promise.all([
    read((p) => p.getBlockNumber()),
    read((p) => core(p).minBet() as Promise<bigint>),
    read((p) => core(p).maxBet() as Promise<bigint>),
    read((p) => core(p).maxPayoutPerBet() as Promise<bigint>),
    read((p) => core(p).STUCK_BET_REFUND_TIMEOUT() as Promise<bigint>),
  ]);

  const timeoutSeconds = timeout !== null ? Number(timeout) : null;
  return {
    blockNumber,
    minBetMtx: minBet !== null ? fmtMtx(minBet) : null,
    maxBetMtx: maxBet !== null ? fmtMtx(maxBet) : null,
    maxPayoutMtx: maxPayout !== null ? fmtMtx(maxPayout) : null,
    stuckTimeoutSeconds: timeoutSeconds,
    stuckTimeoutLabel:
      timeoutSeconds !== null ? fmtDuration(timeoutSeconds) : null,
    fetchedAt: new Date(),
  };
}

// ---------------------------------------------------------------------------
// VRF — the Chainlink VRF subscription that fuels Dice randomness.
// Unlike CasinoCore above, this read needs NO miniature re-run: the
// Terminal snapshot already reads the subscription (its header in
// mtxTerminal.ts documents the uint256-selector fix — getSubscription
// takes uint256, selector 0xdc311dd3; a bytes32 declaration silently
// reverts) and exports both figures the panel shows:
// TerminalSnapshot.vrfLink (LINK balance, 4dp) and
// TerminalSnapshot.vrfRequests (fulfilled-request count). Both come
// from the one getSubscription call, so they succeed or fail together;
// the panel still renders each row's failure state independently, and
// the coordinator + subscription id live in TERMINAL_CONTRACTS
// (re-exported above) for the panel's PolygonScan link.
// ---------------------------------------------------------------------------

/**
 * The HQ daily watch's alert threshold for the VRF subscription, in
 * LINK. Exported for the panel's factual context line only — it is
 * not a status and drives no styling: a healthy balance gets no
 * alarm colour, and the panel never claims the watch ran or didn't.
 */
export const VRF_WATCH_ALERT_THRESHOLD_LINK = 0.1;

// ---------------------------------------------------------------------------
// Feed fetching — status + crew log. Both fetchers share one rule set:
// 8-second ceiling, JSON only, shape-validated, null on any failure.
// ---------------------------------------------------------------------------

const FEED_TIMEOUT_MS = 8_000;

async function fetchJson(url: string): Promise<unknown | null> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), FEED_TIMEOUT_MS);
    const res = await fetch(url, { signal: ctrl.signal, cache: 'no-store' });
    clearTimeout(timer);
    if (!res.ok) return null;
    return (await res.json()) as unknown;
  } catch {
    return null;
  }
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}

function asString(v: unknown): string | null {
  return typeof v === 'string' && v.trim() !== '' ? v.trim() : null;
}

function asIsoTime(v: unknown): string | null {
  const s = asString(v);
  if (!s) return null;
  const t = Date.parse(s);
  return Number.isNaN(t) ? null : new Date(t).toISOString();
}

// --- Status feed -----------------------------------------------------------

export type CheckStatus = 'up' | 'down' | 'degraded' | 'unknown';

export interface StatusCheck {
  name: string;
  status: CheckStatus;
  updatedAt: string | null;
}

export interface StatusFeed {
  checks: StatusCheck[];
  /** Feed-level publish time, when the publisher provides one. */
  updatedAt: string | null;
}

function normalizeStatus(v: unknown): CheckStatus {
  const s = asString(v)?.toLowerCase() ?? '';
  if (s === 'up' || s === 'operational' || s === 'ok') return 'up';
  if (s === 'down' || s === 'outage' || s === 'downtime') return 'down';
  if (s === 'degraded' || s === 'partial' || s === 'degraded-performance')
    return 'degraded';
  return 'unknown';
}

function normalizeCheck(raw: unknown, feedUpdatedAt: string | null): StatusCheck | null {
  const rec = asRecord(raw);
  if (!rec) return null;
  const name = asString(rec.name);
  if (!name) return null;
  return {
    name,
    status: normalizeStatus(rec.status),
    updatedAt:
      asIsoTime(rec.updatedAt) ?? asIsoTime(rec.lastUpdated) ?? feedUpdatedAt,
  };
}

/**
 * Fetch + normalize the status feed. Accepts the three shapes
 * documented in src/config/glass-wall.ts (ours, Upptime native array,
 * { sites: [...] }). Returns null when the feed can't be read or
 * contains no valid check — the panel then says so, plainly.
 */
export async function fetchStatusFeed(url: string): Promise<StatusFeed | null> {
  const data = await fetchJson(url);
  if (data === null) return null;

  let rawChecks: unknown[] | null = null;
  let feedUpdatedAt: string | null = null;
  if (Array.isArray(data)) {
    rawChecks = data;
  } else {
    const rec = asRecord(data);
    if (rec) {
      feedUpdatedAt = asIsoTime(rec.updatedAt) ?? asIsoTime(rec.generatedAt);
      if (Array.isArray(rec.checks)) rawChecks = rec.checks;
      else if (Array.isArray(rec.sites)) rawChecks = rec.sites;
    }
  }
  if (!rawChecks) return null;

  const checks = rawChecks
    .map((c) => normalizeCheck(c, feedUpdatedAt))
    .filter((c): c is StatusCheck => c !== null);
  return checks.length > 0 ? { checks, updatedAt: feedUpdatedAt } : null;
}

// --- Crew log feed ---------------------------------------------------------

export interface CrewLogEntry {
  ts: string;
  bot: string;
  summary: string;
}

export interface CrewLogFeed {
  entries: CrewLogEntry[];
  generatedAt: string | null;
}

export const CREW_LOG_DISPLAY_CAP = 20;

/**
 * Fetch + normalize the crew log feed (contract in
 * src/config/glass-wall.ts). Invalid entries are dropped, the rest
 * sorted newest-first and capped. Returns null when the feed can't
 * be read at all.
 */
export async function fetchCrewLog(url: string): Promise<CrewLogFeed | null> {
  const data = await fetchJson(url);
  if (data === null) return null;

  let rawEntries: unknown[] | null = null;
  let generatedAt: string | null = null;
  if (Array.isArray(data)) {
    rawEntries = data;
  } else {
    const rec = asRecord(data);
    if (rec) {
      generatedAt = asIsoTime(rec.generatedAt) ?? asIsoTime(rec.updatedAt);
      if (Array.isArray(rec.entries)) rawEntries = rec.entries;
    }
  }
  if (!rawEntries) return null;

  const entries = rawEntries
    .map((raw): CrewLogEntry | null => {
      const rec = asRecord(raw);
      if (!rec) return null;
      const ts = asIsoTime(rec.ts);
      const bot = asString(rec.bot);
      const summary = asString(rec.summary);
      return ts && bot && summary ? { ts, bot, summary } : null;
    })
    .filter((e): e is CrewLogEntry => e !== null)
    .sort((a, b) => Date.parse(b.ts) - Date.parse(a.ts))
    .slice(0, CREW_LOG_DISPLAY_CAP);
  return { entries, generatedAt };
}
