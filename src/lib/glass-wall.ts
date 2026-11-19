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
import {
  fetchTerminalSnapshot,
  scanUrl,
  TERMINAL_CONTRACTS,
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

export function buildReceipts(snap: TerminalSnapshot | null): ReceiptBadge[] {
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
  return badges;
}

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
