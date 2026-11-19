import React, { useState, useEffect, useCallback } from 'react';
import { MTX } from '../config/mtx';
import {
  fetchTerminalSnapshot,
  type TerminalSnapshot,
} from '../lib/mtxTerminal';

interface MTXStatsWidgetProps {
  compact?: boolean;
  showRefresh?: boolean;
}

/**
 * MTXStatsWidget Component
 *
 * Displays the MTX figures that can be read live from Polygon mainnet:
 * total supply, the direct-mint rate, and the minting-paused state.
 *
 * REWIRED 2026-11-18 (site cleaning wave 2, audit item C13): this widget
 * previously fetched /api/mtx-stats — an API route marked
 * `prerender = true` on a static build, so it served a build-time
 * snapshot while presenting itself as live stats, and on error it fell
 * back to the config rate (1000) and displayed it as data. It also
 * showed "Circulating" and "Burned" rows derived from a dead-address
 * balance — figures the live-read lib does not source and the proof
 * pack does not state.
 *
 * Now every figure comes from src/lib/mtxTerminal.ts
 * (fetchTerminalSnapshot): fresh eth_calls with endpoint failover at
 * render/refresh time. A figure that fails on every endpoint is null
 * and renders an explicit "read failed" state — never a cached, stale,
 * or config-default number. The /api/mtx-stats route was deleted with
 * this rewire; this widget was its only consumer.
 */
const MTXStatsWidget: React.FC<MTXStatsWidgetProps> = ({
  compact = false,
  showRefresh = true,
}) => {
  const [snapshot, setSnapshot] = useState<TerminalSnapshot | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      const snap = await fetchTerminalSnapshot();
      setSnapshot(snap);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch stats on mount; auto-refresh every 2 minutes
  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 120000);
    return () => clearInterval(interval);
  }, [fetchStats]);

  if (loading && !snapshot) {
    return (
      <div style={{
        padding: compact ? '0.75rem' : '1rem',
        background: '#222',
        border: '1px solid #333',
        borderRadius: '6px',
        textAlign: 'center',
        color: '#aaa',
        fontSize: compact ? '0.75rem' : '0.875rem'
      }}>
        Reading live MTX stats from Polygon...
      </div>
    );
  }

  const allFailed =
    snapshot !== null &&
    snapshot.totalSupply === null &&
    snapshot.maticToMtxRate === null &&
    snapshot.mintingPaused === null;

  const failedStyle: React.CSSProperties = { color: '#ffaa00' };
  const readFailed = (
    <span style={failedStyle}>read failed</span>
  );

  const rowStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: compact ? '0.25rem' : '0.5rem',
    borderBottom: '1px solid #333',
  };
  const labelStyle: React.CSSProperties = {
    fontSize: compact ? '0.7rem' : '0.8rem',
    color: '#aaa',
  };
  const valueStyle: React.CSSProperties = {
    fontSize: compact ? '0.75rem' : '0.875rem',
    fontWeight: 'bold',
  };

  return (
    <div style={{
      padding: compact ? '0.75rem' : '1.25rem',
      background: 'linear-gradient(135deg, #181818 0%, #222 100%)',
      border: '1px solid rgba(0, 255, 153, 0.3)',
      borderRadius: '8px',
      color: '#fff',
      fontFamily: 'Courier New, monospace'
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: compact ? '0.5rem' : '0.75rem'
      }}>
        <h4 style={{
          margin: 0,
          fontSize: compact ? '0.875rem' : '1rem',
          fontWeight: 'bold',
          color: '#00ff99'
        }}>
          MTX Stats — Live
        </h4>
        {showRefresh && (
          <button
            onClick={fetchStats}
            disabled={loading}
            style={{
              padding: '0.25rem 0.5rem',
              fontSize: compact ? '0.625rem' : '0.75rem',
              background: 'transparent',
              color: '#00ff99',
              border: '1px solid #00ff99',
              borderRadius: '4px',
              cursor: loading ? 'wait' : 'pointer',
              fontFamily: 'inherit'
            }}
          >
            {loading ? '⟳' : '↻'}
          </button>
        )}
      </div>

      {allFailed && (
        <div style={{
          padding: '0.5rem',
          background: '#ffaa0020',
          border: '1px solid #ffaa00',
          borderRadius: '4px',
          color: '#ffaa00',
          fontSize: '0.75rem',
          marginBottom: '0.75rem'
        }}>
          Live read failed on every endpoint — no figures shown. This
          widget never displays cached or estimated numbers.
        </div>
      )}

      {snapshot && (
        <div style={{
          display: 'grid',
          gap: compact ? '0.5rem' : '0.75rem'
        }}>
          {/* Total Supply */}
          <div style={rowStyle}>
            <span style={labelStyle}>
              Total Supply:
            </span>
            <span style={{ ...valueStyle, color: '#00ff99' }}>
              {snapshot.totalSupply !== null
                ? `${snapshot.totalSupply} MTX`
                : readFailed}
            </span>
          </div>

          {/* Mint Rate */}
          <div style={rowStyle}>
            <span style={labelStyle}>
              Rate:
            </span>
            <span style={{ ...valueStyle, color: '#ffaa00' }}>
              {snapshot.maticToMtxRate !== null
                ? `1 POL = ${snapshot.maticToMtxRate} MTX`
                : readFailed}
            </span>
          </div>

          {/* Minting Status */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <span style={labelStyle}>
              Minting:
            </span>
            <span style={{
              ...valueStyle,
              color:
                snapshot.mintingPaused === null
                  ? '#ffaa00'
                  : snapshot.mintingPaused
                    ? '#ff6666'
                    : '#00ff99'
            }}>
              {snapshot.mintingPaused === null
                ? readFailed
                : snapshot.mintingPaused
                  ? '⏸ Paused'
                  : '✓ Active'}
            </span>
          </div>

          {/* Source line */}
          <div style={{
            fontSize: '0.7rem',
            color: '#888',
            borderTop: '1px solid #333',
            paddingTop: '0.5rem'
          }}>
            Live reads from Polygon mainnet
            {snapshot.blockNumber !== null &&
              ` · block ${snapshot.blockNumber.toLocaleString('en-US')}`}
            {' · '}
            <a href="/security" style={{ color: '#00ff99' }}>
              verify on /security
            </a>
          </div>

          {/* Links */}
          {!compact && (
            <div style={{
              marginTop: '0.5rem',
              paddingTop: '0.75rem',
              borderTop: '1px solid #333',
              display: 'flex',
              gap: '0.5rem',
              fontSize: '0.75rem'
            }}>
              <a
                href={MTX.blockExplorerUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  color: '#00ff99',
                  textDecoration: 'none',
                  flex: 1,
                  textAlign: 'center',
                  padding: '0.25rem',
                  border: '1px solid #00ff99',
                  borderRadius: '4px'
                }}
              >
                Contract ↗
              </a>
              <a
                href="/buy-mtx"
                style={{
                  color: '#FF007A',
                  textDecoration: 'none',
                  flex: 1,
                  textAlign: 'center',
                  padding: '0.25rem',
                  border: '1px solid #FF007A',
                  borderRadius: '4px'
                }}
              >
                Buy MTX ↗
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default MTXStatsWidget;
