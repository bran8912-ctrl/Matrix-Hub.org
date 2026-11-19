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
 * HOW IT PUBLISHES (revised 2026-11-19, after live run #1) — via the
 * GitHub Contents API, never git push:
 *   Run #1's pings all passed (5/5 HTTP 200, changed=true), but its
 *   git-push publish was rejected by a repository RULESET (GH013) on
 *   refs/heads/status: (1) ref creation is restricted, and (2) commits
 *   must have verified signatures — the workflow's local git commit
 *   was unsigned. HQ's ruling: COMPLY with the ruleset, do not weaken
 *   it. So:
 *   - The `status` branch is created ONCE by the repo owner through
 *     the GitHub web UI (an owner action the ruleset permits). This
 *     script ASSUMES the branch exists; if it does not, publish mode
 *     fails with a single clear line (no stack trace) and writes
 *     nothing.
 *   - Publishing is one Contents API PUT
 *     (PUT /repos/{repo}/contents/status.json, branch=status,
 *     authenticated with the workflow's GITHUB_TOKEN). Commits the
 *     API creates are signed by GitHub and show as Verified, which
 *     satisfies the signature rule by construction.
 *   - Updating an existing file requires its current blob SHA
 *     (GitHub's rule): the publish path GETs the file first and
 *     reuses that SHA. A file that does not exist yet is created by
 *     the same PUT with NO sha field.
 *
 * PUBLISH SEMANTICS (the honesty rules, same as the room's):
 *   - A check's per-check `updatedAt` is when it ENTERED its current
 *     status — carried over from the previous file while the status
 *     is unchanged, reset to now when it flips.
 *   - The feed-level `updatedAt` is when this state was published,
 *     i.e. the last time anything changed.
 *   - There is deliberately NO heartbeat/run timestamp in the file:
 *     if no check changed state, the run makes NO API write at all
 *     (reads — branch check, previous-file fetch — still happen;
 *     the only write in the system is the PUT, and it is gated on
 *     changed=true). Commits on the status branch are therefore rare
 *     and each one means "something actually went up or down".
 *   - `httpStatus`/`responseMs` are from the run that produced the
 *     published file (the last change run), never averaged or aged
 *     into an uptime percentage. The feed reports current status and
 *     last change only — that is all the data supports.
 *
 * USAGE:
 *   Local / proof mode (no API, no token):
 *     node ping-status.mjs --out <path> [--prev <path>] [--timeout <ms>]
 *     --prev   the previously published status.json (missing/unreadable
 *              is fine — treated as "no previous state", everything is
 *              new, changed=true)
 *     --out    where to write the resulting status.json (always written:
 *              the fresh file when changed, the previous file verbatim
 *              when not, so callers can copy unconditionally)
 *   Publish mode (the workflow):
 *     GITHUB_TOKEN=<token> node ping-status.mjs --publish \
 *       [--repo <owner/repo>] [--branch <name>] [--file-path <path>] \
 *       [--api-url <url>] [--out <path>] [--timeout <ms>]
 *     --repo defaults to $GITHUB_REPOSITORY, --api-url to
 *     $GITHUB_API_URL (both set automatically in Actions), --branch
 *     to "status", --file-path to "status.json". The token is read
 *     from the environment ONLY — never a CLI argument, so it cannot
 *     land in a process list or a log line. --out is optional here
 *     (a debugging copy; the branch is the real destination).
 *
 * OUTPUTS: human-readable lines on stdout; when $GITHUB_OUTPUT is set,
 * also `changed=true|false` and `changed_names=<comma list>`.
 *
 * EXIT CODES: 0 on success — a DOWN check is data, not a failure.
 * 2 only when the script itself cannot do its job (bad args, cannot
 * write --out, publish preconditions unmet, API error). Publish
 * failures print ONE line — the message, never a stack trace.
 * No dependencies: Node >= 18 (global fetch).
 */
import { readFileSync, writeFileSync, appendFileSync, existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

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

// Pinned API version — the version every current GitHub REST example
// targets; explicit is better than drifting with the server default.
const GITHUB_API_VERSION = '2022-11-28';

function parseArgs(argv) {
  const args = {
    prev: null,
    out: null,
    timeout: 15_000,
    publish: false,
    repo: process.env.GITHUB_REPOSITORY || null,
    branch: 'status',
    filePath: 'status.json',
    apiUrl: process.env.GITHUB_API_URL || 'https://api.github.com',
  };
  for (let i = 2; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--prev') args.prev = argv[++i];
    else if (a === '--out') args.out = argv[++i];
    else if (a === '--timeout') args.timeout = Number(argv[++i]);
    else if (a === '--publish') args.publish = true;
    else if (a === '--repo') args.repo = argv[++i];
    else if (a === '--branch') args.branch = argv[++i];
    else if (a === '--file-path') args.filePath = argv[++i];
    else if (a === '--api-url') args.apiUrl = argv[++i];
    else {
      console.error(`unknown argument: ${a}`);
      process.exit(2);
    }
  }
  if (!args.publish && !args.out) {
    console.error('--out <path> is required in local mode (or pass --publish)');
    process.exit(2);
  }
  if (args.publish && (!args.repo || !/^[^/\s]+\/[^/\s]+$/.test(args.repo))) {
    console.error('--publish needs --repo <owner/repo> (or $GITHUB_REPOSITORY)');
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

/**
 * Parse a previous status.json (text form) into a name → check map.
 * Returns null for anything missing/malformed — "no previous state"
 * is a normal condition (first publish), never an error.
 */
function parsePrevText(text) {
  if (!text) return null;
  try {
    const data = JSON.parse(text);
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

function readPrev(path) {
  if (!path || !existsSync(path)) return null;
  try {
    return parsePrevText(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
}

/**
 * The merge at the heart of the monitor — UNCHANGED from the proven
 * git-push build. Given the fresh ping results and the previous
 * state, decide each check's published row, which checks flipped,
 * and whether anything changed at all.
 */
export function computeChecks(results, prev, now) {
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
  return { checks, changedNames, changed };
}

function printReport(checks, changed, changedNames) {
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
}

function writeGithubOutput(changed, changedNames) {
  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(
      process.env.GITHUB_OUTPUT,
      `changed=${changed}\nchanged_names=${changedNames.join(', ')}\n`,
    );
  }
}

/** Collapse any error text to a single line — publish failures must
 * read as one clear line in the Actions log, never a stack trace. */
function oneLine(text) {
  return String(text ?? '').replace(/\s*\n\s*/g, ' ').trim();
}

/**
 * One GitHub REST call. Returns { status, data } with data = parsed
 * JSON (null when the body is empty/unparseable). Never throws on an
 * HTTP error status — callers decide what each status means — but a
 * transport failure is rethrown as a one-line Error.
 */
async function apiRequest(fetchFn, { method, url, token, body }) {
  let res;
  try {
    res = await fetchFn(url, {
      method,
      headers: {
        accept: 'application/vnd.github+json',
        authorization: `Bearer ${token}`,
        'x-github-api-version': GITHUB_API_VERSION,
        'user-agent': USER_AGENT,
        ...(body ? { 'content-type': 'application/json' } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  } catch (err) {
    throw new Error(`GitHub API ${method} ${url} failed: ${oneLine(err?.message)}`);
  }
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  return { status: res.status, data };
}

function apiError(context, status, data) {
  const detail = data && typeof data.message === 'string' ? `: ${oneLine(data.message)}` : '';
  return new Error(`${context} (HTTP ${status})${detail}`);
}

/**
 * The branch is created by the repo owner in the web UI (the ruleset
 * restricts ref creation, and HQ complies rather than weakening it).
 * If it is not there, publishing is impossible — say so in one line.
 */
async function ensureBranch(fetchFn, { apiUrl, repo, branch, token }) {
  const url = `${apiUrl}/repos/${repo}/branches/${encodeURIComponent(branch)}`;
  const { status, data } = await apiRequest(fetchFn, { method: 'GET', url, token });
  if (status === 200) return;
  if (status === 404) {
    throw new Error(
      `cannot publish: branch '${branch}' does not exist in ${repo} — create it once in the GitHub web UI (owner action), then re-run`,
    );
  }
  throw apiError(`cannot publish: branch check for '${branch}' failed`, status, data);
}

/**
 * Fetch the currently published file from the branch, if any.
 * Returns { text, sha } — the decoded file and its blob SHA (the SHA
 * an update PUT must carry) — or null when the file does not exist
 * yet (the create case: the PUT then goes out with no sha field).
 */
async function fetchRemoteFile(fetchFn, { apiUrl, repo, branch, filePath, token }) {
  const url = `${apiUrl}/repos/${repo}/contents/${filePath}?ref=${encodeURIComponent(branch)}`;
  const { status, data } = await apiRequest(fetchFn, { method: 'GET', url, token });
  if (status === 404) return null;
  if (status !== 200) {
    throw apiError(`cannot publish: fetching ${filePath} on '${branch}' failed`, status, data);
  }
  if (!data || typeof data.content !== 'string' || typeof data.sha !== 'string') {
    throw new Error(`cannot publish: ${filePath} on '${branch}' came back without content/SHA`);
  }
  // The API returns base64 with embedded newlines — strip whitespace
  // before decoding.
  const text = Buffer.from(data.content.replace(/\s/g, ''), 'base64').toString('utf8');
  return { text, sha: data.sha };
}

/**
 * The full publish cycle, with the network injected so the decision
 * paths can be proven against a mocked fetch (see
 * ping-status.test.mjs): branch check → fetch previous file → merge
 * → PUT only when something changed.
 *
 * The PUT body follows GitHub's "Create or update file contents"
 * contract exactly: `message` and base64 `content` always; `branch`
 * always (the API default is the repo's default branch — publishing
 * must name `status` explicitly); `sha` ONLY when replacing an
 * existing file (required there, wrong for a create).
 *
 * Returns { changed, changedNames, checks, published, created,
 * outText } — outText is the file this run would publish (fresh when
 * changed; the previous file verbatim when not).
 */
export async function runPublishCycle({
  fetchFn,
  token,
  repo,
  branch = 'status',
  filePath = 'status.json',
  apiUrl = 'https://api.github.com',
  results,
  now = new Date().toISOString(),
}) {
  if (!token) {
    throw new Error('cannot publish: GITHUB_TOKEN is not set in the environment');
  }
  const base = { apiUrl, repo, branch, filePath, token };

  await ensureBranch(fetchFn, base);
  const remote = await fetchRemoteFile(fetchFn, base);
  const prev = remote ? parsePrevText(remote.text) : null;

  const { checks, changedNames, changed } = computeChecks(results, prev, now);
  printReport(checks, changed, changedNames);

  if (!changed) {
    // NO API write on a no-change run — the PUT below is the only
    // write in the system and it is gated on this branch.
    return {
      changed, changedNames, checks,
      published: false, created: false,
      outText: remote.text,
    };
  }

  const outText = `${JSON.stringify({ updatedAt: now, checks }, null, 2)}\n`;
  const body = {
    message: `status: ${changedNames.join(', ') || 'first publish'}`,
    content: Buffer.from(outText, 'utf8').toString('base64'),
    branch,
    // Update case: carry the blob SHA the GET just returned. Create
    // case: omit the field entirely (sending one would 422).
    ...(remote ? { sha: remote.sha } : {}),
  };
  const url = `${apiUrl}/repos/${repo}/contents/${filePath}`;
  const { status, data } = await apiRequest(fetchFn, { method: 'PUT', url, token, body });
  if (status !== 200 && status !== 201) {
    // 409 here means the file changed between our GET and PUT (stale
    // SHA); the workflow's concurrency group makes that a should-not-
    // happen, and the next run self-heals — but fail loudly, one line.
    throw apiError(`publish failed for ${filePath} on '${branch}'`, status, data);
  }
  console.log(
    `published=true (${status === 201 ? 'created' : 'updated'} ${filePath} on branch '${branch}')`,
  );
  return {
    changed, changedNames, checks,
    published: true, created: status === 201,
    outText,
  };
}

async function main() {
  const args = parseArgs(process.argv);
  const now = new Date().toISOString();
  const results = await Promise.all(CHECKS.map((c) => pingOne(c, args.timeout)));

  if (args.publish) {
    const result = await runPublishCycle({
      fetchFn: fetch,
      token: process.env.GITHUB_TOKEN,
      repo: args.repo,
      branch: args.branch,
      filePath: args.filePath,
      apiUrl: args.apiUrl,
      results,
      now,
    });
    if (args.out) writeFileSync(args.out, result.outText);
    writeGithubOutput(result.changed, result.changedNames);
    return;
  }

  // Local / proof mode — the original behavior, byte for byte.
  const prev = readPrev(args.prev);
  const { checks, changedNames, changed } = computeChecks(results, prev, now);

  let outText;
  if (changed) {
    outText = `${JSON.stringify({ updatedAt: now, checks }, null, 2)}\n`;
  } else {
    // Nothing changed: reproduce the previous file byte-for-byte, so
    // even an accidental commit would be a no-op diff.
    outText = readFileSync(args.prev, 'utf8');
  }
  writeFileSync(args.out, outText);
  printReport(checks, changed, changedNames);
  writeGithubOutput(changed, changedNames);
}

// Run only when invoked directly — importing this module (the test
// file does) must not ping or publish anything.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    // One line, always: a failed publish must read clearly in the
    // Actions log — the message, never a stack trace.
    console.error(`ping-status failed: ${oneLine(err?.message ?? err)}`);
    process.exit(2);
  });
}
