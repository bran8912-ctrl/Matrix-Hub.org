import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';

// ─────────────────────────────────────────────────────────────────────────────
//  CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

// Staking tier configuration (mirrors staking.astro)
const STAKING_TIERS = [
  { name: 'No Stake', min: 0, max: 999, apy: 0, color: '#888888', emoji: '⬜' },
  { name: 'Bronze', min: 1000, max: 10000, apy: 5, color: '#CD7F32', emoji: '🥉' },
  { name: 'Silver', min: 10001, max: 50000, apy: 10, color: '#C0C0C0', emoji: '🥈' },
  { name: 'Gold', min: 50001, max: Infinity, apy: 15, color: '#FFD700', emoji: '🥇' },
];

const TIME_FRAMES = [
  { label: 'Daily', key: 'daily', days: 1 },
  { label: 'Weekly', key: 'weekly', days: 7 },
  { label: 'Monthly', key: 'monthly', days: 30 },
  { label: 'Yearly', key: 'yearly', days: 365 },
];

const CASINO_GAMES = [
  { name: 'Slots', cost: 1, winChance: 0.15, avgMultiplier: 5, icon: '🎰' },
  { name: 'Blackjack', cost: 2, winChance: 0.48, avgMultiplier: 1.9, icon: '🃏' },
  { name: 'Roulette', cost: 1, winChance: 0.486, avgMultiplier: 1.9, icon: '🎡' },
];

function getTierForAmount(amount: number) {
  for (let i = STAKING_TIERS.length - 1; i >= 0; i--) {
    if (amount >= STAKING_TIERS[i].min) return STAKING_TIERS[i];
  }
  return STAKING_TIERS[0];
}

function calcCompound(principal: number, apy: number, days: number): number {
  if (apy === 0) return 0;
  const rate = apy / 100;
  return principal * (Math.pow(1 + rate / 365, days) - 1);
}

function formatMTX(val: number): string {
  if (val >= 1_000_000) return (val / 1_000_000).toFixed(2) + 'M';
  if (val >= 1_000) return (val / 1_000).toFixed(2) + 'K';
  return val.toFixed(4);
}

interface ChartPoint {
  day: number;
  value: number;
}

// Mini sparkline SVG chart
function SparklineChart({ data, color }: { data: ChartPoint[]; color: string }) {
  if (!data.length) return null;
  const W = 400;
  const H = 80;
  const pad = 4;
  const maxVal = Math.max(...data.map(d => d.value), 0.001);
  const minVal = Math.min(...data.map(d => d.value));

  const pts = data.map((d, i) => {
    const x = pad + (i / (data.length - 1)) * (W - pad * 2);
    const y = H - pad - ((d.value - minVal) / (maxVal - minVal || 1)) * (H - pad * 2);
    return `${x},${y}`;
  });

  const areaPath =
    `M ${pts[0]} ` +
    pts.slice(1).map(p => `L ${p}`).join(' ') +
    ` L ${W - pad},${H - pad} L ${pad},${H - pad} Z`;

  const linePath = `M ${pts[0]} ` + pts.slice(1).map(p => `L ${p}`).join(' ');

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: '80px' }} aria-hidden="true">
      <defs>
        <linearGradient id={`grad-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#grad-${color.replace('#', '')})`} />
      <path d={linePath} fill="none" stroke={color} strokeWidth="2" />
      {/* Last point dot */}
      <circle
        cx={pts[pts.length - 1].split(',')[0]}
        cy={pts[pts.length - 1].split(',')[1]}
        r="4"
        fill={color}
      />
    </svg>
  );
}

// Animated counter hook
function useAnimatedCounter(target: number, duration = 600) {
  const [display, setDisplay] = useState(0);
  const startRef = useRef(0);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    const start = startRef.current;
    const diff = target - start;
    const startTime = performance.now();

    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = start + diff * eased;
      setDisplay(current);
      if (progress < 1) {
        frameRef.current = requestAnimationFrame(animate);
      } else {
        startRef.current = target;
      }
    };

    frameRef.current = requestAnimationFrame(animate);
    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    };
  }, [target, duration]);

  return display;
}

// BRRR Animation Component
function BrrrAnimation({ active }: { active: boolean }) {
  if (!active) return null;
  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, width: '100vw', height: '100vh',
      pointerEvents: 'none',
      zIndex: 9999,
      overflow: 'hidden',
    }} aria-hidden="true">
      {Array.from({ length: 12 }).map((_, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            fontSize: `${1 + Math.random() * 2}rem`,
            left: `${Math.random() * 90}%`,
            top: '-10%',
            animation: `fall-${i % 4} ${1 + Math.random() * 1.5}s ease-in forwards`,
            animationDelay: `${Math.random() * 0.5}s`,
          }}
        >
          💸
        </div>
      ))}
      <style>{`
        @keyframes fall-0 { to { top: 110%; transform: rotate(360deg); } }
        @keyframes fall-1 { to { top: 110%; transform: rotate(-270deg) scale(0.5); } }
        @keyframes fall-2 { to { top: 110%; transform: rotate(180deg) translateX(50px); } }
        @keyframes fall-3 { to { top: 110%; transform: rotate(-360deg) scale(1.2); } }
      `}</style>
    </div>
  );
}

const MoneyPrinter: React.FC = () => {
  const [stakingAmount, setStakingAmount] = useState(10000);
  const [inputValue, setInputValue] = useState('10000');
  const [timeFrame, setTimeFrame] = useState('yearly');
  const [compound, setCompound] = useState(true);
  const [casinoGame, setCasinoGame] = useState(0);
  const [casinoSessions, setCasinoSessions] = useState(10);
  const [brrrActive, setBrrrActive] = useState(false);
  const [projectionDays, setProjectionDays] = useState(365);

  // Memoize tier so it only recalculates when stakingAmount changes
  const tier = useMemo(() => getTierForAmount(stakingAmount), [stakingAmount]);
  const selectedTF = TIME_FRAMES.find(t => t.key === timeFrame) ?? TIME_FRAMES[3];

  const stakingEarnings = compound
    ? calcCompound(stakingAmount, tier.apy, selectedTF.days)
    : (stakingAmount * (tier.apy / 100) * selectedTF.days) / 365;

  const animatedEarnings = useAnimatedCounter(stakingEarnings);

  const game = CASINO_GAMES[casinoGame];
  const casinoExpectedReturn = casinoSessions * game.cost * (game.winChance * game.avgMultiplier - 1);

  // Memoize chart data to avoid recalculating 50+ iterations on every render
  const chartData = useMemo<ChartPoint[]>(() => {
    const pts: ChartPoint[] = [];
    for (let d = 0; d <= projectionDays; d += Math.ceil(projectionDays / 50)) {
      const earned = compound
        ? calcCompound(stakingAmount, tier.apy, d)
        : (stakingAmount * (tier.apy / 100) * d) / 365;
      pts.push({ day: d, value: stakingAmount + earned });
    }
    return pts;
  }, [stakingAmount, tier.apy, compound, projectionDays]);

  const handleBrrr = useCallback(() => {
    setBrrrActive(true);
    setTimeout(() => setBrrrActive(false), 2500);
  }, []);

  const handleAmountInput = (v: string) => {
    setInputValue(v);
    const digits = v.replace(/[^0-9]/g, '');
    // When input is cleared or non-numeric, reset amount to 0
    const n = digits === '' ? 0 : parseInt(digits, 10);
    setStakingAmount(Math.min(n, 10_000_000));
  };

  const finalBalance = stakingAmount + (compound
    ? calcCompound(stakingAmount, tier.apy, projectionDays)
    : (stakingAmount * (tier.apy / 100) * projectionDays) / 365);

  const cardStyle: React.CSSProperties = {
    padding: '1.5rem',
    background: 'rgba(0, 255, 153, 0.05)',
    border: '1px solid rgba(0, 255, 153, 0.2)',
    borderRadius: '8px',
    marginBottom: '1.5rem',
    fontFamily: 'Courier New, monospace',
  };

  const labelStyle: React.CSSProperties = {
    fontSize: '0.85rem',
    color: 'var(--theme-text)',
    opacity: 0.75,
    marginBottom: '0.4rem',
    display: 'block',
  };

  const valueStyle: React.CSSProperties = {
    fontSize: '1.6rem',
    fontWeight: 'bold',
    color: tier.color,
    textShadow: `0 0 12px ${tier.color}`,
  };

  return (
    <div style={{ fontFamily: 'Courier New, monospace', color: 'var(--theme-text)' }}>
      <BrrrAnimation active={brrrActive} />

      {/* ── BRRR Header ── */}
      <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
        <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>🖨️💸</div>
        <p style={{ color: 'var(--theme-text)', opacity: 0.8, fontSize: '1rem' }}>
          Calculate your MTX staking rewards, compound earnings, and casino edge.
        </p>
        <button
          onClick={handleBrrr}
          style={{
            marginTop: '1rem',
            padding: '0.6rem 2rem',
            background: 'linear-gradient(135deg, #00ff99, #00cc77)',
            color: '#000',
            border: 'none',
            borderRadius: '6px',
            fontFamily: 'Courier New, monospace',
            fontWeight: 'bold',
            fontSize: '1rem',
            cursor: 'pointer',
            letterSpacing: '2px',
            boxShadow: '0 0 20px rgba(0,255,153,0.4)',
          }}
        >
          BRRR 💸
        </button>
      </div>

      {/* ── Staking Input ── */}
      <div style={cardStyle}>
        <h2 style={{ color: 'var(--theme-primary)', marginBottom: '1.2rem', fontSize: '1.2rem' }}>
          ⚙️ Configure Your MTX Stake
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.2rem' }}>
          <div>
            <label style={labelStyle}>MTX Amount to Stake</label>
            <input
              type="text"
              value={inputValue}
              onChange={e => handleAmountInput(e.target.value)}
              style={{
                width: '100%',
                padding: '0.6rem 0.8rem',
                background: 'rgba(0,0,0,0.4)',
                border: `1px solid ${tier.color}`,
                borderRadius: '4px',
                color: tier.color,
                fontFamily: 'Courier New, monospace',
                fontSize: '1.1rem',
                outline: 'none',
              }}
            />
            <input
              type="range"
              min={0}
              max={100000}
              step={1000}
              value={Math.min(stakingAmount, 100000)}
              onChange={e => {
                const v = parseInt(e.target.value, 10);
                setStakingAmount(v);
                setInputValue(String(v));
              }}
              style={{ width: '100%', marginTop: '0.5rem', accentColor: tier.color }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', opacity: 0.6 }}>
              <span>0</span><span>50K</span><span>100K</span>
            </div>
            {stakingAmount > 100000 && (
              <div style={{ fontSize: '0.68rem', color: tier.color, marginTop: '0.25rem', opacity: 0.8 }}>
                ↑ Slider shows up to 100K — your typed value ({formatMTX(stakingAmount)}) is used in all calculations.
              </div>
            )}
          </div>

          <div>
            <label style={labelStyle}>Time Frame</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              {TIME_FRAMES.map(tf => (
                <button
                  key={tf.key}
                  onClick={() => setTimeFrame(tf.key)}
                  style={{
                    padding: '0.5rem',
                    background: timeFrame === tf.key ? tier.color : 'rgba(0,0,0,0.3)',
                    color: timeFrame === tf.key ? '#000' : 'var(--theme-text)',
                    border: `1px solid ${tier.color}`,
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    fontSize: '0.8rem',
                    fontWeight: timeFrame === tf.key ? 'bold' : 'normal',
                  }}
                >
                  {tf.label}
                </button>
              ))}
            </div>
            <div style={{ marginTop: '0.8rem' }}>
              <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={compound}
                  onChange={e => setCompound(e.target.checked)}
                  style={{ accentColor: tier.color }}
                />
                Compound interest
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* ── Tier Badge & Earnings ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.2rem', marginBottom: '1.5rem' }}>
        {/* Current Tier */}
        <div style={{
          ...cardStyle,
          marginBottom: 0,
          borderColor: tier.color,
          background: `${tier.color}10`,
          textAlign: 'center',
        }}>
          <div style={{ fontSize: '2.5rem' }}>{tier.emoji}</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 'bold', color: tier.color, margin: '0.3rem 0' }}>
            {tier.name} Tier
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 'bold', color: tier.color, textShadow: `0 0 15px ${tier.color}` }}>
            {tier.apy}% APY
          </div>
          <div style={{ fontSize: '0.75rem', opacity: 0.7, marginTop: '0.3rem' }}>
            {tier.apy === 0 ? 'Stake ≥1,000 MTX to earn' : `${tier.min.toLocaleString()}${tier.max === Infinity ? '+' : ` – ${tier.max.toLocaleString()}`} MTX`}
          </div>
        </div>

        {/* Earnings Card */}
        <div style={{ ...cardStyle, marginBottom: 0, textAlign: 'center' }}>
          <span style={labelStyle}>{selectedTF.label} Earnings</span>
          <div style={valueStyle}>
            +{formatMTX(animatedEarnings)} MTX
          </div>
          {tier.apy > 0 && stakingAmount > 0 && (
            <div style={{ fontSize: '0.75rem', opacity: 0.6, marginTop: '0.4rem' }}>
              ≈ {(animatedEarnings / stakingAmount * 100).toFixed(3)}% return
            </div>
          )}
        </div>

        {/* After staking */}
        <div style={{ ...cardStyle, marginBottom: 0, textAlign: 'center' }}>
          <span style={labelStyle}>Balance After {selectedTF.label}</span>
          <div style={{ ...valueStyle, color: 'var(--theme-primary)' }}>
            {formatMTX(stakingAmount + stakingEarnings)} MTX
          </div>
          <div style={{ fontSize: '0.75rem', opacity: 0.6, marginTop: '0.4rem' }}>
            Started with {formatMTX(stakingAmount)} MTX
          </div>
        </div>
      </div>

      {/* ── Tier Comparison Table ── */}
      <div style={cardStyle}>
        <h2 style={{ color: 'var(--theme-primary)', marginBottom: '1rem', fontSize: '1.2rem' }}>
          📊 Tier Comparison ({selectedTF.label})
        </h2>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
            <thead>
              <tr>
                {['Tier', 'APY', 'Min Stake', `${selectedTF.label} Earn`, 'Yearly Earn'].map(h => (
                  <th key={h} style={{
                    padding: '0.5rem 0.8rem',
                    borderBottom: '1px solid rgba(0,255,153,0.3)',
                    color: 'var(--theme-primary)',
                    textAlign: 'left',
                    whiteSpace: 'nowrap',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {STAKING_TIERS.slice(1).map(t => {
                const exampleStake = t.min;
                const tfEarn = compound
                  ? calcCompound(exampleStake, t.apy, selectedTF.days)
                  : (exampleStake * t.apy / 100 * selectedTF.days) / 365;
                const yearEarn = compound
                  ? calcCompound(exampleStake, t.apy, 365)
                  : exampleStake * t.apy / 100;
                const isActive = tier.name === t.name;
                return (
                  <tr key={t.name} style={{
                    background: isActive ? `${t.color}15` : 'transparent',
                    transition: 'background 0.2s',
                  }}>
                    <td style={{ padding: '0.5rem 0.8rem', color: t.color, fontWeight: isActive ? 'bold' : 'normal' }}>
                      {t.emoji} {t.name} {isActive && '◀'}
                    </td>
                    <td style={{ padding: '0.5rem 0.8rem', color: t.color }}>{t.apy}%</td>
                    <td style={{ padding: '0.5rem 0.8rem' }}>{t.min.toLocaleString()} MTX</td>
                    <td style={{ padding: '0.5rem 0.8rem', color: '#00ff99' }}>+{formatMTX(tfEarn)} MTX</td>
                    <td style={{ padding: '0.5rem 0.8rem', color: '#00ff99' }}>+{formatMTX(yearEarn)} MTX</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Growth Projection Chart ── */}
      <div style={cardStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <h2 style={{ color: 'var(--theme-primary)', fontSize: '1.2rem', margin: 0 }}>
            📈 Growth Projection
          </h2>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {[30, 90, 180, 365].map(d => (
              <button
                key={d}
                onClick={() => setProjectionDays(d)}
                style={{
                  padding: '0.3rem 0.7rem',
                  background: projectionDays === d ? 'var(--theme-primary)' : 'rgba(0,0,0,0.3)',
                  color: projectionDays === d ? '#000' : 'var(--theme-text)',
                  border: '1px solid var(--theme-primary)',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  fontSize: '0.75rem',
                }}
              >
                {d}d
              </button>
            ))}
          </div>
        </div>

        {tier.apy > 0 ? (
          <>
            <SparklineChart data={chartData} color={tier.color} />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.8rem', fontSize: '0.85rem' }}>
              <span style={{ opacity: 0.7 }}>Start: {formatMTX(stakingAmount)} MTX</span>
              <span style={{ color: tier.color, fontWeight: 'bold' }}>End: {formatMTX(finalBalance)} MTX</span>
            </div>
            <div style={{ textAlign: 'center', marginTop: '0.5rem', fontSize: '0.8rem', color: '#00ff99' }}>
              +{formatMTX(finalBalance - stakingAmount)} MTX earned over {projectionDays} days
            </div>
          </>
        ) : (
          <div style={{ textAlign: 'center', padding: '2rem', opacity: 0.5 }}>
            Stake at least 1,000 MTX to see your growth projection
          </div>
        )}
      </div>

      {/* ── Casino Edge Calculator ── */}
      <div style={cardStyle}>
        <h2 style={{ color: 'var(--theme-primary)', marginBottom: '1rem', fontSize: '1.2rem' }}>
          🎰 Casino Earnings Estimator
        </h2>
        <p style={{ opacity: 0.7, fontSize: '0.85rem', marginBottom: '1rem' }}>
          Estimated returns based on game math. Actual results vary — play responsibly.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
          {CASINO_GAMES.map((g, i) => (
            <button
              key={g.name}
              onClick={() => setCasinoGame(i)}
              style={{
                padding: '1rem',
                background: casinoGame === i ? 'rgba(0,255,153,0.15)' : 'rgba(0,0,0,0.3)',
                border: `1px solid ${casinoGame === i ? 'var(--theme-primary)' : 'rgba(0,255,153,0.2)'}`,
                borderRadius: '6px',
                cursor: 'pointer',
                fontFamily: 'inherit',
                color: 'var(--theme-text)',
                textAlign: 'left',
              }}
            >
              <div style={{ fontSize: '1.8rem', marginBottom: '0.3rem' }}>{g.icon}</div>
              <div style={{ fontWeight: 'bold', marginBottom: '0.2rem' }}>{g.name}</div>
              <div style={{ fontSize: '0.75rem', opacity: 0.7 }}>Cost: {g.cost} MTX/play</div>
              <div style={{ fontSize: '0.75rem', opacity: 0.7 }}>Win: {(g.winChance * 100).toFixed(1)}%</div>
            </button>
          ))}
        </div>
        <div>
          <label style={labelStyle}>Sessions per {selectedTF.label.toLowerCase()}</label>
          <input
            type="range"
            min={1}
            max={200}
            value={casinoSessions}
            onChange={e => setCasinoSessions(parseInt(e.target.value, 10))}
            style={{ width: '100%', accentColor: 'var(--theme-primary)' }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.8rem' }}>
            <span>1</span>
            <span style={{ color: 'var(--theme-primary)', fontWeight: 'bold' }}>{casinoSessions} sessions</span>
            <span>200</span>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem', marginTop: '1rem' }}>
          <div style={{ textAlign: 'center', padding: '0.8rem', background: 'rgba(0,0,0,0.3)', borderRadius: '6px' }}>
            <div style={{ fontSize: '0.75rem', opacity: 0.7 }}>MTX Spent</div>
            <div style={{ fontSize: '1.3rem', fontWeight: 'bold', color: '#ff6666' }}>
              -{(casinoSessions * game.cost).toFixed(0)} MTX
            </div>
          </div>
          <div style={{ textAlign: 'center', padding: '0.8rem', background: 'rgba(0,0,0,0.3)', borderRadius: '6px' }}>
            <div style={{ fontSize: '0.75rem', opacity: 0.7 }}>Expected Return</div>
            <div style={{ fontSize: '1.3rem', fontWeight: 'bold', color: casinoExpectedReturn >= 0 ? '#00ff99' : '#ff6666' }}>
              {casinoExpectedReturn >= 0 ? '+' : ''}{casinoExpectedReturn.toFixed(2)} MTX
            </div>
          </div>
          <div style={{ textAlign: 'center', padding: '0.8rem', background: 'rgba(0,0,0,0.3)', borderRadius: '6px' }}>
            <div style={{ fontSize: '0.75rem', opacity: 0.7 }}>House Edge</div>
            <div style={{ fontSize: '1.3rem', fontWeight: 'bold', color: '#ffaa00' }}>
              {((1 - game.winChance * game.avgMultiplier) * 100).toFixed(1)}%
            </div>
          </div>
        </div>

        <div style={{
          marginTop: '1rem',
          padding: '0.75rem',
          background: 'rgba(255,170,0,0.08)',
          border: '1px solid rgba(255,170,0,0.3)',
          borderRadius: '6px',
          fontSize: '0.8rem',
          color: '#ffaa00',
        }}>
          ⚠️ Casino games are for entertainment. Expected values are long-run averages.
          Never spend more MTX than you can afford to lose.
        </div>
      </div>

      {/* ── Combined Summary ── */}
      <div style={{
        ...cardStyle,
        border: '1px solid var(--theme-primary)',
        background: 'rgba(0,255,153,0.08)',
        marginBottom: 0,
      }}>
        <h2 style={{ color: 'var(--theme-primary)', marginBottom: '1rem', fontSize: '1.2rem' }}>
          💰 {selectedTF.label} Summary
        </h2>
        <div style={{ display: 'grid', gap: '0.7rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(0,255,153,0.15)', paddingBottom: '0.5rem' }}>
            <span style={{ opacity: 0.8 }}>Staking rewards ({tier.name}, {tier.apy}% APY)</span>
            <span style={{ color: '#00ff99', fontWeight: 'bold' }}>+{formatMTX(stakingEarnings)} MTX</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(0,255,153,0.15)', paddingBottom: '0.5rem' }}>
            <span style={{ opacity: 0.8 }}>Casino net ({game.icon} {game.name}, {casinoSessions} sessions)</span>
            <span style={{ color: casinoExpectedReturn >= 0 ? '#00ff99' : '#ff6666', fontWeight: 'bold' }}>
              {casinoExpectedReturn >= 0 ? '+' : ''}{casinoExpectedReturn.toFixed(2)} MTX
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '0.2rem' }}>
            <span style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>Total {selectedTF.label} Projection</span>
            <span style={{
              color: 'var(--theme-primary)',
              fontWeight: 'bold',
              fontSize: '1.3rem',
              textShadow: '0 0 10px var(--theme-glow)',
            }}>
              {(stakingEarnings + casinoExpectedReturn) >= 0 ? '+' : ''}
              {formatMTX(stakingEarnings + casinoExpectedReturn)} MTX
            </span>
          </div>
        </div>
        <div style={{ marginTop: '1.5rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <a
            href="/casino"
            style={{
              display: 'inline-block',
              padding: '0.7rem 1.5rem',
              background: 'rgba(0,255,153,0.1)',
              color: 'var(--theme-primary)',
              textDecoration: 'none',
              borderRadius: '6px',
              fontWeight: 'bold',
              fontSize: '0.95rem',
              border: '1px solid var(--theme-primary)',
            }}
          >
            Play Casino →
          </a>
        </div>
      </div>
    </div>
  );
};

export default MoneyPrinter;
