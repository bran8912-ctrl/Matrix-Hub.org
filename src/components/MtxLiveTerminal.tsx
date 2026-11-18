import { useCallback, useEffect, useRef, useState } from 'react';
import {
  TERMINAL_CONTRACTS,
  fetchTerminalSnapshot,
  scanUrl,
  type TerminalSnapshot,
} from '../lib/mtxTerminal';

// MTX Live Terminal — homepage panel (graduated from the MTX Live Terminal
// Space, Nov 17). Placement: directly under the homepage hero. Every figure
// is read live from Polygon mainnet in the visitor's browser (public RPC,
// no keys, no backend, no wallet). A failed read renders an explicit
// "read failed" tile — never a cached, stale, or invented number.

const FAKE_MTX = '0xDCb51dE3359C946364F707556aC8e6C6f2e69A8a';

interface TileProps {
  label: string;
  value: string | null;
  sub?: string;
  verifyHref?: string;
  loading: boolean;
}

function Tile({ label, value, sub, verifyHref, loading }: TileProps) {
  const failed = !loading && value === null;
  return (
    <div className="rounded-lg border border-green-500/30 bg-gray-900/80 p-4">
      <div className="text-[11px] uppercase tracking-[2px] text-gray-400">
        {label}
      </div>
      <div
        className={`mt-1 font-mono text-xl font-bold ${
          failed ? 'text-red-400' : 'text-green-400'
        }`}
      >
        {loading ? '…' : failed ? '—' : value}
      </div>
      <div className="mt-1 min-h-[1rem] text-xs text-gray-400">
        {loading
          ? 'Reading the chain…'
          : failed
            ? 'Read failed — retry'
            : (sub ?? '')}
      </div>
      {verifyHref && (
        <a
          href={verifyHref}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-block text-xs text-green-500 underline decoration-dotted hover:text-green-300"
        >
          Verify on PolygonScan ↗
        </a>
      )}
    </div>
  );
}

export default function MtxLiveTerminal() {
  const [snap, setSnap] = useState<TerminalSnapshot | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const inFlight = useRef(false);

  const load = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setRefreshing(true);
    try {
      setSnap(await fetchTerminalSnapshot());
    } finally {
      inFlight.current = false;
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  }, [load]);

  const loading = snap === null;
  const allFailed =
    snap !== null &&
    snap.totalSupply === null &&
    snap.spotPolPerMtx === null &&
    snap.reserveMtx === null &&
    snap.vrfLink === null;

  const mintSub =
    snap?.mintingPaused === null || snap?.mintingPaused === undefined
      ? ''
      : snap.mintingPaused
        ? 'Minting is paused'
        : 'Minting is open';

  return (
    <section
      aria-label="MTX live terminal"
      className="relative z-[1] mx-auto w-full max-w-5xl px-4 py-10 font-mono"
    >
      <div className="rounded-lg border-2 border-green-500/50 bg-black/85 p-5 shadow-[0_0_40px_rgba(0,255,65,0.08)]">
        {/* Header strip */}
        <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2">
          <h2 className="text-lg font-bold uppercase tracking-[3px] text-green-400">
            ▣ MTX Live Terminal
          </h2>
          <span className="flex items-center gap-2 text-xs text-gray-400">
            <span
              className={`inline-block h-2 w-2 rounded-full ${
                allFailed ? 'bg-red-500' : 'bg-green-400'
              } animate-pulse`}
            />
            {loading
              ? 'Connecting to Polygon…'
              : allFailed
                ? 'Live reads unavailable'
                : 'Live from Polygon mainnet'}
          </span>
          {snap?.blockNumber != null && (
            <span className="text-xs text-gray-500">
              Block {snap.blockNumber.toLocaleString('en-US')}
            </span>
          )}
          <span className="ml-auto flex items-center gap-3">
            {snap && (
              <span className="text-xs text-gray-500">
                Updated{' '}
                {snap.fetchedAt.toLocaleTimeString('en-US', {
                  hour12: false,
                })}
              </span>
            )}
            <button
              type="button"
              onClick={load}
              disabled={refreshing}
              className="rounded border border-green-500 px-3 py-1 text-xs font-bold uppercase tracking-wider text-green-400 transition-colors hover:bg-green-500/10 disabled:cursor-wait disabled:opacity-50"
            >
              {refreshing ? 'Reading…' : '↻ Refresh'}
            </button>
          </span>
        </div>

        {allFailed && (
          <p className="mb-4 rounded border border-red-500/50 bg-red-950/40 p-3 text-sm text-red-300">
            Live reads are unavailable right now. Nothing on this panel is
            cached — every figure is read fresh from the chain, so tap
            Refresh to retry.
          </p>
        )}

        {/* Tiles */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          <Tile
            label="MTX spot price (pool)"
            value={snap?.spotPolPerMtx ? `${snap.spotPolPerMtx} POL` : null}
            sub="QuickSwap pair reserves"
            verifyHref={scanUrl(TERMINAL_CONTRACTS.pair)}
            loading={loading}
          />
          <Tile
            label="Total supply"
            value={snap?.totalSupply ? `${snap.totalSupply} MTX` : null}
            sub="Hard cap 100,000,000 MTX"
            verifyHref={scanUrl(TERMINAL_CONTRACTS.mtx)}
            loading={loading}
          />
          <Tile
            label="Direct mint rate"
            value={
              snap?.maticToMtxRate ? `1 POL = ${snap.maticToMtxRate} MTX` : null
            }
            sub={mintSub}
            verifyHref={scanUrl(TERMINAL_CONTRACTS.mtx)}
            loading={loading}
          />
          <Tile
            label="QuickSwap pool"
            value={
              snap?.poolPol && snap?.poolMtx
                ? `${snap.poolPol} POL + ${snap.poolMtx} MTX`
                : null
            }
            sub="The pool is small — see /security"
            verifyHref={scanUrl(TERMINAL_CONTRACTS.pair)}
            loading={loading}
          />
          <Tile
            label="Casino reserve"
            value={snap?.reserveMtx ? `${snap.reserveMtx} MTX` : null}
            sub="Payout reserve (cap 1,000,000)"
            verifyHref={scanUrl(TERMINAL_CONTRACTS.casinoReserve)}
            loading={loading}
          />
          <Tile
            label="Dice randomness (VRF)"
            value={snap?.vrfLink ? `${snap.vrfLink} LINK` : null}
            sub={
              snap?.vrfRequests != null
                ? `Chainlink VRF fund · ${snap.vrfRequests} requests so far`
                : ''
            }
            verifyHref={scanUrl(TERMINAL_CONTRACTS.vrfCoordinator)}
            loading={loading}
          />
        </div>

        {/* Fake-token warning */}
        <p className="mt-4 rounded border border-yellow-500/50 bg-yellow-950/30 p-3 text-xs leading-relaxed text-yellow-200">
          ⚠ <strong>Fake-token warning:</strong> the token at{' '}
          <span className="break-all">{FAKE_MTX}</span> is flagged by
          PolygonScan as “Fake_Phishing8012348 / Phish — Hack”. It is{' '}
          <strong>not</strong> MTX — never buy it. The only real MTX is{' '}
          <span className="break-all">{TERMINAL_CONTRACTS.mtx}</span>. Check
          any address first on our{' '}
          <a href="/security" className="underline hover:text-yellow-100">
            Security &amp; Proof page
          </a>
          .
        </p>

        {/* Footer */}
        <p className="mt-3 text-center text-xs text-gray-500">
          MTX is a utility token. This panel shows facts and sources — it
          makes no price, return or liquidity claims.{' '}
          <a href="/security" className="text-green-500 underline decoration-dotted hover:text-green-300">
            Full proof, contract list and honest gaps →
          </a>
        </p>
      </div>
    </section>
  );
}
