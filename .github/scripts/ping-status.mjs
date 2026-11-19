#!/usr/bin/env node
/**
 * ping-status.mjs — the Glass Wall's status monitor (Clubhouse Phase 2).
 *
 * Runs inside the "Status ping" GitHub Actions workflow
 * (.github/workflows/status-ping.yml) about every 30 minutes, and can
 * be run locally for proof. It pings the site's key public URLs,
 * records each one's HTTP status + response time, and produces the
 * status.json the Glass Wall's status panel consumes (contract in
 * src/config/glass-wall.ts, shape (a)).
 *
 * WHY THIS EXISTS — the status feed used to wait on an external
 * Upptime repo + a personal access token. Brandon's call (2026-11-18):
 * "figure out a work around." This is it: the whole monitor lives in
 * THIS repo — a scheduled workflow using the built-in GITHUB_TOKEN,
 * publishing to a dedicated `status` branch the panel reads over
 * raw.githubusercontent.com. No new repo, no PAT, $0.
 *
 * PUBLISH SEMANTICS (the honesty rules, same as the room's):
 *   - A check's per-check `updatedAt` is when it ENTERED its current
 *     status — carried over from the previous file while the status
 *     is unchanged, reset to now when it flips.
 *   - The feed-level `updatedAt` is when this state was published,
 *     i.e. the last time anything changed.
 *   - There is deliberately NO heartbeat/run timestamp in the file:
 *     if no check changed state, the output is the previous file
 *     verbatim and the workflow commits nothing. Commits on the
 *     status branch are therefore rare and each one means "something
 *     actually went up or down".
 *   - `httpStatus`/`responseMs` are from the run that produced the
 *     published file (the last change run), never averaged or aged
 *     into an uptime percentage. The feed reports current status and
 *     last change only — that is all the data supports.
 *
 * USAGE:
 *   node ping-status.mjs --out <path> [--prev <path>] [--timeout <ms>]
 *   --prev   the previously published status.json (missing/unreadable
 *            is fine — treated as "no previous state", everything is
 *            new, changed=true)
 *   --out    where to write the resulting status.json (always written:
 *            the fresh file when changed, the previous file verbatim
 *            when not, so callers can copy unconditionally)
 *
 * OUTPUTS: human-readable lines on stdout; when $GITHUB_OUTPUT is set,
 * also `changed=true|false` and `changed_names=<comma list>` for the
 * workflow's commit step.
 *
 * EXIT CODES: 0 on success — a DOWN check is data, not a failure.
 * 2 only when the script itself cannot do its job (bad args, cannot
 * write --out). No dependencies: Node >= 18 (global fetch).
 */
import { readFileSync, writeFileSync, appendFileSync, existsSync } from 'node:fs';

// The key public URLs. Names are what the Glass Wall panel prints —
// keep them stable: the merge with the previous file keys on `name`,
// so renaming a check resets its "since" time (correctly: it is, to
// the feed, a new check).
const CHECKS = [
  { name: 'Matrix Hub — Homepage', url: 'https://matrix-hub.org/' },
  { name: 'Clubhouse — Glass Wall', url: 'https://matrix-hub.org/clubhouse/glass-wall/' },
  { name: 'Casino — Dice', url: 'https://matrix-hub.org/games/casino/dice/' },
  { name: 'Video Studio', url: 'https://matrix-hub.org/video-studio/' },
  { name: 'Proving Ground', url: 'https://matrix-hub.org/proving-ground/' },
];

const USER_AGENT =
  'MatrixHubStatusPing/1.0 (+https://matrix-hub.org/clubhouse/glass-wall/)';

function parseArgs(argv) {
  const args = { prev: null, out: null, timeout: 15_000 };
  for (let i = 2; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--prev') args.prev = argv[++i];
    else if (a === '--out') args.out = argv[++i];
    else if (a === '--timeout') args.timeout = Number(argv[++i]);
    else {
      console.error(`unknown argument: ${a}`);
      process.exit(2);
    }
  }
  if (!args.out) {
    console.error('--out <path> is required');
    process.exit(2);
  }
  return args;
}

async function pingOne(check, timeoutMs) {
  const started = performance.now();
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    const res = await fetch(check.url, {
      signal: ctrl.signal,
      redirect: 'follow',
      headers: { 'user-agent': USER_AGENT },
    });
    clearTimeout(timer);
    // Drain the body so the timing covers the full response and the
    // socket is released cleanly.
    await res.arrayBuffer();
    const responseMs = Math.round(performance.now() - started);
    return {
      ...check,
      status: res.status >= 200 && res.status < 400 ? 'up' : 'down',
      httpStatus: res.status,
      responseMs,
    };
  } catch {
    return {
      ...check,
      status: 'down',
      httpStatus: null,
      responseMs: Math.round(performance.now() - started),
    };
  }
}

function readPrev(path) {
  if (!path || !existsSync(path)) return null;
  try {
    const data = JSON.parse(readFileSync(path, 'utf8'));
    if (!data || !Array.isArray(data.checks)) return null;
    const byName = new Map();
    for (const c of data.checks) {
      if (c && typeof c.name === 'string' && typeof c.status === 'string') {
        byName.set(c.name, c);
      }
    }
    return byName;
  } catch {
    return null;
  }
}

async function main() {
  const args = parseArgs(process.argv);
  const now = new Date().toISOString();
  const prev = readPrev(args.prev);

  const results = await Promise.all(CHECKS.map((c) => pingOne(c, args.timeout)));

  const changedNames = [];
  const checks = results.map((r) => {
    const before = prev?.get(r.name);
    const unchanged = before && before.status === r.status;
    if (!unchanged) changedNames.push(r.name);
    return {
      name: r.name,
      url: r.url,
      status: r.status,
      httpStatus: r.httpStatus,
      responseMs: r.responseMs,
      // "Since": carried over while the state holds, now when it flips
      // (or when the check is new to the feed).
      updatedAt: unchanged && typeof before.updatedAt === 'string'
        ? before.updatedAt
        : now,
    };
  });

  // A check that vanished from the list is also a change (the panel
  // would lose a row) — count it even though it has no new entry.
  if (prev) {
    for (const name of prev.keys()) {
      if (!checks.some((c) => c.name === name)) changedNames.push(name);
    }
  }

  const changed = prev === null || changedNames.length > 0;

  let outText;
  if (changed) {
    outText = `${JSON.stringify({ updatedAt: now, checks }, null, 2)}\n`;
  } else {
    // Nothing changed: reproduce the previous file byte-for-byte, so
    // even an accidental commit would be a no-op diff.
    outText = readFileSync(args.prev, 'utf8');
  }
  writeFileSync(args.out, outText);

  for (const c of checks) {
    console.log(
      `${c.status.toUpperCase().padEnd(4)} ${c.name} — HTTP ${c.httpStatus ?? 'no response'} in ${c.responseMs} ms (since ${c.updatedAt})`,
    );
  }
  console.log(
    changed
      ? `changed=true (${changedNames.join(', ') || 'first publish'})`
      : 'changed=false (no check changed state; nothing to publish)',
  );

  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(
      process.env.GITHUB_OUTPUT,
      `changed=${changed}\nchanged_names=${changedNames.join(', ')}\n`,
    );
  }
}

main().catch((err) => {
  console.error('ping-status failed:', err);
  process.exit(2);
});
