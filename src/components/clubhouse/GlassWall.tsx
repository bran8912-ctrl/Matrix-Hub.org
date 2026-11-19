import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  buildReceipts,
  fetchCrewLog,
  fetchStatusFeed,
  fetchTerminalSnapshot,
  scanUrl,
  TERMINAL_CONTRACTS,
  type CrewLogFeed,
  type ReceiptBadge,
  type StatusFeed,
  type TerminalSnapshot,
} from '../../lib/glass-wall';
import { CREW_LOG_FEED_URL, STATUS_FEED_URL } from '../../config/glass-wall';

// The Glass Wall island — Clubhouse Phase 2, the live transparency room.
//
// Four panels, one rule: show a real value or say, in so many words,
// that it couldn't be read. Chain figures are read fresh from Polygon
// by the Terminal lib (per-field failure states, nothing cached or
// backfilled). The status and crew-log panels read the JSON feeds
// configured in src/config/glass-wall.ts; while a feed URL is empty
// the panel renders its "being wired" state and fetches nothing.

type FeedState<T> =
  | { kind: 'unwired' }
  | { kind: 'loading' }
  | { kind: 'ok'; data: T }
  | { kind: 'unreachable' };

function fmtTime(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
}

// --- Receipts (Shields-pattern badges) -------------------------------------

const TONE_CLS: Record<ReceiptBadge['tone'], string> = {
  green: 'bg-green-600 text-white',
  yellow: 'bg-yellow-500 text-black',
  red: 'bg-red-600 text-white',
  gray: 'bg-gray-500 text-white',
};

function Badge({ badge }: { badge: ReceiptBadge }) {
  const inner = (
    <>
      <span className="bg-gray-700 text-gray-200 px-2 py-1">{badge.label}</span>
      <span className={`${TONE_CLS[badge.tone]} px-2 py-1`}>{badge.value}</span>
    </>
  );
  const cls =
    'inline-flex rounded overflow-hidden text-xs font-semibold shadow-sm';
  return badge.href ? (
    <a
      href={badge.href}
      {...(badge.href.startsWith('http')
        ? { target: '_blank', rel: 'noopener noreferrer' }
        : {})}
      className={cls}
    >
      {inner}
    </a>
  ) : (
    <span className={cls}>{inner}</span>
  );
}

// --- Chain panel -------------------------------------------------------------

function ChainRow({
  label,
  value,
  loading,
}: {
  label: string;
  value: string | null;
  loading: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2 border-b border-gray-700 last:border-b-0">
      <span className="text-gray-400">{label}</span>
      {loading ? (
        <span className="text-gray-500">reading…</span>
      ) : value !== null ? (
        <span className="font-bold text-gray-100 text-right">{value}</span>
      ) : (
        <span className="text-red-400 font-semibold">read failed</span>
      )}
    </div>
  );
}

// --- Panels ------------------------------------------------------------------

export default function GlassWall() {
  const [snap, setSnap] = useState<TerminalSnapshot | null>(null);
  const [chainLoading, setChainLoading] = useState(true);
  const loadingRef = useRef(false);

  const [statusFeed, setStatusFeed] = useState<FeedState<StatusFeed>>(
    STATUS_FEED_URL ? { kind: 'loading' } : { kind: 'unwired' },
  );
  const [crewLog, setCrewLog] = useState<FeedState<CrewLogFeed>>(
    CREW_LOG_FEED_URL ? { kind: 'loading' } : { kind: 'unwired' },
  );

  const loadChain = useCallback(async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setChainLoading(true);
    try {
      setSnap(await fetchTerminalSnapshot());
    } finally {
      loadingRef.current = false;
      setChainLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadChain();
    const id = setInterval(() => void loadChain(), 120_000);
    return () => clearInterval(id);
  }, [loadChain]);

  useEffect(() => {
    if (!STATUS_FEED_URL) return;
    let live = true;
    void fetchStatusFeed(STATUS_FEED_URL).then((data) => {
      if (live)
        setStatusFeed(data ? { kind: 'ok', data } : { kind: 'unreachable' });
    });
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    if (!CREW_LOG_FEED_URL) return;
    let live = true;
    void fetchCrewLog(CREW_LOG_FEED_URL).then((data) => {
      if (live)
        setCrewLog(data ? { kind: 'ok', data } : { kind: 'unreachable' });
    });
    return () => {
      live = false;
    };
  }, []);

  const chainAllFailed =
    snap !== null &&
    snap.blockNumber === null &&
    snap.totalSupply === null &&
    snap.maticToMtxRate === null &&
    snap.mintingPaused === null &&
    snap.reserveMtx === null;

  const receipts = buildReceipts(snap);

  return (
    <div className="space-y-8">
      {/* Receipts strip */}
      <section className="bg-gray-800 border border-gray-600 rounded-lg p-6">
        <h2 className="text-2xl font-bold text-green-400 mb-3">Receipts</h2>
        <p className="text-gray-300 mb-4">
          Every badge below traces to something checkable: the first to the
          published proof pack on{' '}
          <a href="/security" className="text-green-400 hover:underline">
            /security
          </a>
          , the rest to reads this page just made itself. A badge whose read
          failed is not printed — it is simply absent, and the chain panel
          below says why.
        </p>
        <div className="flex flex-wrap gap-2">
          {receipts.map((b) => (
            <Badge key={b.label} badge={b} />
          ))}
        </div>
        {chainLoading && snap === null && (
          <p className="text-gray-400 text-sm mt-3">
            Reading the chain now — the live badges appear when this page's
            own reads complete. Nothing here is pre-printed.
          </p>
        )}
        {chainAllFailed && (
          <p className="text-red-300 text-sm mt-3">
            The live reads failed on every public endpoint just now, so the
            live badges are hidden rather than filled in from memory.
          </p>
        )}
      </section>

      {/* Chain panel */}
      <section className="bg-gray-800 border border-gray-600 rounded-lg p-6">
        <div className="flex items-start justify-between gap-4 mb-2">
          <h2 className="text-2xl font-bold text-green-400">
            On-chain, read live
          </h2>
          <button
            type="button"
            onClick={() => void loadChain()}
            disabled={chainLoading}
            className="bg-green-600 hover:bg-green-500 disabled:bg-gray-600 text-white font-semibold px-3 py-1 rounded text-sm"
          >
            {chainLoading ? 'Reading…' : 'Refresh'}
          </button>
        </div>
        <div>
          <ChainRow
            label="MTX total supply"
            loading={chainLoading && snap === null}
            value={snap?.totalSupply != null ? `${snap.totalSupply} MTX` : null}
          />
          <ChainRow
            label="Direct mint rate"
            loading={chainLoading && snap === null}
            value={
              snap?.maticToMtxRate != null
                ? `1 POL = ${snap.maticToMtxRate} MTX`
                : null
            }
          />
          <ChainRow
            label="Minting"
            loading={chainLoading && snap === null}
            value={
              snap?.mintingPaused == null
                ? null
                : snap.mintingPaused
                  ? 'Paused'
                  : 'Open'
            }
          />
          <ChainRow
            label="Casino reserve balance"
            loading={chainLoading && snap === null}
            value={snap?.reserveMtx != null ? `${snap.reserveMtx} MTX` : null}
          />
        </div>
        <p className="text-gray-400 text-sm mt-4">
          {snap?.blockNumber != null ? (
            <>
              Live reads from Polygon mainnet · block{' '}
              {snap.blockNumber.toLocaleString('en-US')} · read at{' '}
              {snap.fetchedAt.toLocaleTimeString('en-US')} ·{' '}
            </>
          ) : chainLoading ? (
            <>Reading Polygon mainnet… · </>
          ) : (
            <>These reads failed on every endpoint just now · </>
          )}
          verify every figure on{' '}
          <a href="/security" className="text-green-400 hover:underline">
            /security
          </a>{' '}
          or read the{' '}
          <a
            href={scanUrl(TERMINAL_CONTRACTS.mtx)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-green-400 hover:underline"
          >
            MTX contract on PolygonScan
          </a>{' '}
          yourself.
        </p>
      </section>

      {/* Status panel */}
      <section className="bg-gray-800 border border-gray-600 rounded-lg p-6">
        <h2 className="text-2xl font-bold text-green-400 mb-3">
          Site &amp; service status
        </h2>
        {statusFeed.kind === 'unwired' && (
          <p className="text-gray-300">
            <strong className="text-yellow-300">
              Status feed being wired.
            </strong>{' '}
            This panel will be fed by our Upptime status monitors (the $0,
            open-source setup prepared in our ops repo) watching this site,
            the Proving Ground, the Clubhouse, and the lead-intake endpoint.
            Until that feed is live, this panel shows no status at all —
            rather than a green tick nobody measured.
          </p>
        )}
        {statusFeed.kind === 'loading' && (
          <p className="text-gray-400">Reading the status feed…</p>
        )}
        {statusFeed.kind === 'unreachable' && (
          <p className="text-red-300">
            The status feed could not be read just now, so no status is
            shown. An unreachable feed is reported as exactly that — never
            as "all systems fine".
          </p>
        )}
        {statusFeed.kind === 'ok' && (
          <>
            <ul className="divide-y divide-gray-700">
              {statusFeed.data.checks.map((c) => (
                <li
                  key={c.name}
                  className="flex items-center justify-between gap-4 py-2"
                >
                  <span className="text-gray-200">{c.name}</span>
                  <span className="flex items-center gap-2 text-sm">
                    <span
                      className={`inline-block w-2.5 h-2.5 rounded-full ${
                        c.status === 'up'
                          ? 'bg-green-500'
                          : c.status === 'down'
                            ? 'bg-red-500'
                            : c.status === 'degraded'
                              ? 'bg-yellow-500'
                              : 'bg-gray-500'
                      }`}
                    />
                    <span className="text-gray-300 capitalize">
                      {c.status === 'unknown' ? 'unknown' : c.status}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
            {statusFeed.data.updatedAt && (
              <p className="text-gray-400 text-sm mt-3">
                Feed updated {fmtTime(statusFeed.data.updatedAt)}.
              </p>
            )}
          </>
        )}
      </section>

      {/* Crew Log panel */}
      <section className="bg-gray-800 border border-gray-600 rounded-lg p-6">
        <h2 className="text-2xl font-bold text-green-400 mb-3">Crew Log</h2>
        <p className="text-gray-300 mb-4">
          What the automation crew actually did, published as summaries by
          the runners themselves. Summaries only — no client details, no
          addresses, nothing sensitive ever reaches this feed.
        </p>
        {crewLog.kind === 'unwired' && (
          <p className="text-gray-300">
            <strong className="text-yellow-300">No entries published yet.</strong>{' '}
            The publisher that turns the runners' local logs into this feed
            is built and run by HQ on a cadence; the first publish will
            appear here. Until then the log is honestly empty.
          </p>
        )}
        {crewLog.kind === 'loading' && (
          <p className="text-gray-400">Reading the crew log…</p>
        )}
        {crewLog.kind === 'unreachable' && (
          <p className="text-red-300">
            The crew log feed could not be read just now, so no entries are
            shown — an unreadable log is never replaced with invented ones.
          </p>
        )}
        {crewLog.kind === 'ok' && crewLog.data.entries.length === 0 && (
          <p className="text-gray-300">
            The feed is live but carries no entries yet.
          </p>
        )}
        {crewLog.kind === 'ok' && crewLog.data.entries.length > 0 && (
          <>
            <ul className="space-y-4">
              {crewLog.data.entries.map((e, i) => (
                <li
                  key={`${e.ts}-${i}`}
                  className="border-l-2 border-green-600 pl-4"
                >
                  <p className="text-gray-100">{e.summary}</p>
                  <p className="text-gray-400 text-sm">
                    {e.bot} · {fmtTime(e.ts)}
                  </p>
                </li>
              ))}
            </ul>
            {crewLog.data.generatedAt && (
              <p className="text-gray-400 text-sm mt-4">
                Feed published {fmtTime(crewLog.data.generatedAt)}.
              </p>
            )}
          </>
        )}
      </section>
    </div>
  );
}
