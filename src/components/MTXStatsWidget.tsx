import React, { useState, useEffect } from 'react';
import { MTX } from '../config/mtx';

interface MTXStatsWidgetProps {
  compact?: boolean;
  showRefresh?: boolean;
}

interface Stats {
  totalSupply: string;
  circulatingSupply: string;
  burnedSupply: string;
  mintingPaused: boolean;
  maticToMtxRate: number;
}

/**
 * MTXStatsWidget Component
 * Displays global MTX token statistics in a compact widget format
 * 
 * Features:
 * - Fetch stats from API or blockchain
 * - Display total supply, circulating supply, burned tokens
 * - Show current exchange rate
 * - Minting status indicator
 * - Compact or full display modes
 * - Optional refresh button
 * - Auto-refresh capability
 */
const MTXStatsWidget: React.FC<MTXStatsWidgetProps> = ({ 
  compact = false,
  showRefresh = true 
}) => {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  /**
   * Fetch MTX statistics from API
   */
  const fetchStats = async () => {
    setLoading(true);
    setError('');

    try {
      // Try fetching from API first
      const response = await fetch('/api/mtx-stats');
      
      if (response.ok) {
        const data = await response.json();
        setStats({
          totalSupply: data.totalSupply,
          circulatingSupply: data.circulatingSupply,
          burnedSupply: data.burnedSupply,
          mintingPaused: data.mintingPaused,
          maticToMtxRate: data.maticToMtxRate,
        });
      } else {
        throw new Error('Failed to fetch stats from API');
      }
    } catch (err) {
      console.error('Error fetching MTX stats:', err);
      
      // Fallback to default values if API fails
      setStats({
        totalSupply: 'Loading...',
        circulatingSupply: 'Loading...',
        burnedSupply: '0',
        mintingPaused: false,
        maticToMtxRate: MTX.maticToMtxRate,
      });
      
      setError('Unable to fetch live stats');
    } finally {
      setLoading(false);
    }
  };

  // Fetch stats on mount
  useEffect(() => {
    fetchStats();
    
    // Auto-refresh every 2 minutes
    const interval = setInterval(fetchStats, 120000);
    
    return () => clearInterval(interval);
  }, []);

  if (loading && !stats) {
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
        Loading MTX stats...
      </div>
    );
  }

  const formatNumber = (value: string, decimals: number = 0): string => {
    const num = parseFloat(value);
    if (isNaN(num)) return value;
    return num.toLocaleString(undefined, { 
      maximumFractionDigits: decimals,
      minimumFractionDigits: decimals 
    });
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
          MTX Stats
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

      {error && (
        <div style={{
          padding: '0.5rem',
          background: '#ff000020',
          border: '1px solid #ff0000',
          borderRadius: '4px',
          color: '#ff6666',
          fontSize: '0.75rem',
          marginBottom: '0.75rem'
        }}>
          {error}
        </div>
      )}

      {stats && (
        <div style={{
          display: 'grid',
          gap: compact ? '0.5rem' : '0.75rem'
        }}>
          {/* Total Supply */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingBottom: compact ? '0.25rem' : '0.5rem',
            borderBottom: '1px solid #333'
          }}>
            <span style={{
              fontSize: compact ? '0.7rem' : '0.8rem',
              color: '#aaa'
            }}>
              Total Supply:
            </span>
            <span style={{
              fontSize: compact ? '0.75rem' : '0.875rem',
              fontWeight: 'bold',
              color: '#00ff99'
            }}>
              {formatNumber(stats.totalSupply)} MTX
            </span>
          </div>

          {/* Circulating Supply */}
          {!compact && (
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              paddingBottom: '0.5rem',
              borderBottom: '1px solid #333'
            }}>
              <span style={{
                fontSize: '0.8rem',
                color: '#aaa'
              }}>
                Circulating:
              </span>
              <span style={{
                fontSize: '0.875rem',
                fontWeight: 'bold',
                color: '#0099ff'
              }}>
                {formatNumber(stats.circulatingSupply)} MTX
              </span>
            </div>
          )}

          {/* Burned */}
          {!compact && (
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              paddingBottom: '0.5rem',
              borderBottom: '1px solid #333'
            }}>
              <span style={{
                fontSize: '0.8rem',
                color: '#aaa'
              }}>
                Burned:
              </span>
              <span style={{
                fontSize: '0.875rem',
                fontWeight: 'bold',
                color: '#ff6666'
              }}>
                {formatNumber(stats.burnedSupply)} MTX
              </span>
            </div>
          )}

          {/* Exchange Rate */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingBottom: compact ? '0.25rem' : '0.5rem',
            borderBottom: '1px solid #333'
          }}>
            <span style={{
              fontSize: compact ? '0.7rem' : '0.8rem',
              color: '#aaa'
            }}>
              Rate:
            </span>
            <span style={{
              fontSize: compact ? '0.75rem' : '0.875rem',
              fontWeight: 'bold',
              color: '#ffaa00'
            }}>
              1 MATIC = {formatNumber(stats.maticToMtxRate.toString())} MTX
            </span>
          </div>

          {/* Minting Status */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <span style={{
              fontSize: compact ? '0.7rem' : '0.8rem',
              color: '#aaa'
            }}>
              Minting:
            </span>
            <span style={{
              fontSize: compact ? '0.75rem' : '0.875rem',
              fontWeight: 'bold',
              color: stats.mintingPaused ? '#ff6666' : '#00ff99'
            }}>
              {stats.mintingPaused ? '⏸ Paused' : '✓ Active'}
            </span>
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
