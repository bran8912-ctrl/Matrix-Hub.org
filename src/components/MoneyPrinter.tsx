import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';

// ─────────────────────────────────────────────────────────────────────────────
//  HYPOTHETICAL CALCULATOR — ILLUSTRATION ONLY
//
//  There is no live MTX staking programme and no rate is offered, promised,
//  or implied by Matrix Hub. Every rate used below is entered by the visitor
//  themselves. The output is arithmetic on that self-entered assumption only:
//  hypothetical, for illustration only, and not a promise of returns.
//  MTX is a utility token, not an investment, with no guaranteed value.
// ─────────────────────────────────────────────────────────────────────────────

const TIME_FRAMES = [
  { label: 'Daily', key: 'daily', days: 1 },
  { label: 'Weekly', key: 'weekly', days: 7 },
  { label: 'Monthly', key: 'monthly', days: 30 },
  { label: 'Yearly', key: 'yearly', days: 365 },
];

const ILLUSTRATION_COLOR = '#00ff99';

function calcCompound(principal: number, hypotheticalRate: number, days: number): number {
  if (hypotheticalRate === 0) return 0;
  const rate = hypotheticalRate / 100;
  return principal * (Math.pow(1 + rate / 365, days) - 1);
}

function calcIllustrativeChange(
  principal: number,
  hypotheticalRate: number,
  days: number,
  compound: boolean,
): number {
  return compound
    ? calcCompound(principal, hypotheticalRate, days)
    : (principal * (hypotheticalRate / 100) * days) / 365;
}

function formatMTX(val: number): string {
  if (val >= 1_000_000) return (val / 1_000_000).toFixed(2) + 'M';
  if (val >= 1_000) return (val / 1_000).toFixed(2) + 'K';
  return val.toFixed(4);
}

// Share text uses plain numbers (no K/M rounding) so the exact figures the
// visitor generated are what gets shared — nothing added, nothing hidden.
function formatShareNumber(val: number): string {
  return val.toLocaleString('en-US', { maximumFractionDigits: 4 });
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

// BRRR Animation Component — playful visual only, not a claim about money
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
  const [amount, setAmount] = useState(10000);
  const [inputValue, setInputValue] = useState('10000');
  // No preset rate: the visitor enters their own hypothetical rate.
  // It starts at 0 so no rate is suggested or implied by this page.
  const [rateInput, setRateInput] = useState('0');
  const [hypotheticalRate, setHypotheticalRate] = useState(0);
  const [timeFrame, setTimeFrame] = useState('yearly');
  const [compound, setCompound] = useState(true);
  const [brrrActive, setBrrrActive] = useState(false);
  const [projectionDays, setProjectionDays] = useState(365);
  const [shareStatus, setShareStatus] = useState('');

  // Read shared inputs back from the URL on load (fix #7: a share link
  // encodes the inputs in the query string: amount, rate, tf, compound,
  // days). Only values in the link itself are used — nothing is invented here.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const amountParam = params.get('amount');
    if (amountParam !== null) {
      const n = parseInt(amountParam.replace(/[^0-9]/g, ''), 10);
      if (!Number.isNaN(n)) {
        const clamped = Math.min(Math.max(n, 0), 10_000_000);
        setAmount(clamped);
        setInputValue(String(clamped));
      }
    }
    const rateParam = params.get('rate');
    if (rateParam !== null) {
      const n = parseFloat(rateParam);
      if (!Number.isNaN(n)) {
        const clamped = Math.min(Math.max(n, 0), 100);
        setHypotheticalRate(clamped);
        setRateInput(String(clamped));
      }
    }
    const tfParam = params.get('tf');
    if (tfParam && TIME_FRAMES.some(t => t.key === tfParam)) {
      setTimeFrame(tfParam);
    }
    const compoundParam = params.get('compound');
    if (compoundParam === '1' || compoundParam === 'true') setCompound(true);
    if (compoundParam === '0' || compoundParam === 'false') setCompound(false);
    const daysParam = params.get('days');
    if (daysParam !== null) {
      const n = parseInt(daysParam, 10);
      if ([30, 90, 180, 365].includes(n)) setProjectionDays(n);
    }
    // Run once on mount only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedTF = TIME_FRAMES.find(t => t.key === timeFrame) ?? TIME_FRAMES[3];

  const illustrativeChange = calcIllustrativeChange(
    amount,
    hypotheticalRate,
    selectedTF.days,
    compound,
  );

  const animatedChange = useAnimatedCounter(illustrativeChange);

  const chartData = useMemo<ChartPoint[]>(() => {
    const pts: ChartPoint[] = [];
    for (let d = 0; d <= projectionDays; d += Math.ceil(projectionDays / 50)) {
      const change = calcIllustrativeChange(amount, hypotheticalRate, d, compound);
      pts.push({ day: d, value: amount + change });
    }
    return pts;
  }, [amount, hypotheticalRate, compound, projectionDays]);

  const handleBrrr = useCallback(() => {
    setBrrrActive(true);
    setTimeout(() => setBrrrActive(false), 2500);
  }, []);

  const handleAmountInput = (v: string) => {
    setInputValue(v);
    const digits = v.replace(/[^0-9]/g, '');
    const n = digits === '' ? 0 : parseInt(digits, 10);
    setAmount(Math.min(n, 10_000_000));
  };

  const handleRateInput = (v: string) => {
    setRateInput(v);
    const cleaned = v.replace(/[^0-9.]/g, '');
    const n = cleaned === '' || cleaned === '.' ? 0 : parseFloat(cleaned);
    setHypotheticalRate(Number.isNaN(n) ? 0 : Math.min(n, 100));
  };

  const buildShareUrl = useCallback((): string => {
    const base =
      typeof window !== 'undefined'
        ? `${window.location.origin}${window.location.pathname}`
        : '/money-printer';
    const params = new URLSearchParams({
      amount: String(amount),
      rate: String(hypotheticalRate),
      tf: timeFrame,
      compound: compound ? '1' : '0',
      days: String(projectionDays),
    });
    return `${base}?${params.toString()}`;
  }, [amount, hypotheticalRate, timeFrame, compound, projectionDays]);

  // Fix #7 share text — framing deviation from the audit's original
  // wording is deliberate (see the worker report): this page is now a
  // hypothetical calculator, so the shared text is labelled a hypothetical
  // illustration on the visitor's own assumed rate throughout. It must
  // never read as an earnings claim or an endorsement of a rate. Only
  // numbers the visitor generated are included.
  const buildShareText = useCallback((): string => {
    const shareUrl = buildShareUrl();
    return [
      'My MTX Hypothetical Calculator illustration — Matrix Hub',
      'Hypothetical illustration only — not a return, not a promise.',
      `Amount I entered: ${formatShareNumber(amount)} MTX`,
      `Hypothetical annual rate I entered (my own assumption, not a real or offered rate): ${formatShareNumber(hypotheticalRate)}% per year`,
      `Time frame: ${selectedTF.label} (${selectedTF.days} days) — daily compounding: ${compound ? 'on' : 'off'}`,
      `Illustrative change (maths on my assumption only): +${formatShareNumber(illustrativeChange)} MTX`,
      `Illustrative total (hypothetical only): ${formatShareNumber(amount + illustrativeChange)} MTX`,
      'There is no live MTX staking programme. MTX is a utility token, not an investment, with no guaranteed value.',
      `Recreate this illustration: ${shareUrl}`,
    ].join('\n');
  }, [amount, hypotheticalRate, selectedTF, compound, illustrativeChange, buildShareUrl]);

  const handleCopyShare = useCallback(async () => {
    const text = buildShareText();
    try {
      await navigator.clipboard.writeText(text);
      setShareStatus('Copied ✓ — hypothetical illustration text + link');
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      try {
        document.execCommand('copy');
        setShareStatus('Copied ✓ — hypothetical illustration text + link');
      } catch {
        setShareStatus('Copy failed — select the summary above and copy it manually.');
      }
      document.body.removeChild(textarea);
    }
    window.setTimeout(() => setShareStatus(''), 4000);
  }, [buildShareText]);

  const handleCopyShareLink = useCallback(async () => {
    const url = buildShareUrl();
    try {
      await navigator.clipboard.writeText(url);
      setShareStatus('Link copied ✓ — it recreates this exact illustration');
    } catch {
      setShareStatus('Copy failed — copy the address bar link manually.');
    }
    window.setTimeout(() => setShareStatus(''), 4000);
  }, [buildShareUrl]);

  const projectionChange = calcIllustrativeChange(
    amount,
    hypotheticalRate,
    projectionDays,
    compound,
  );
  const finalBalance = amount + projectionChange;

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
    color: ILLUSTRATION_COLOR,
    textShadow: `0 0 12px ${ILLUSTRATION_COLOR}`,
  };

  const disclaimerStyle: React.CSSProperties = {
    padding: '1rem',
    background: 'rgba(255,170,0,0.08)',
    border: '1px solid rgba(255,170,0,0.4)',
    borderRadius: '6px',
    fontSize: '0.9rem',
    lineHeight: 1.6,
    color: '#ffaa00',
    marginBottom: '1.5rem',
  };

  return (
    <div style={{ fontFamily: 'Courier New, monospace', color: 'var(--theme-text)' }}>
      <BrrrAnimation active={brrrActive} />

      {/* ── Hypothetical disclaimer — visible before any number ── */}
      <div style={disclaimerStyle} role="note">
        ⚠️ <strong>Hypothetical illustration only — for illustration only, not a
        promise of returns.</strong> There is no live MTX staking programme
        paying any rate. MTX is a utility token, not an investment, with no
        guaranteed value. Any rate on this page is a number you enter yourself;
        the result is simply maths on that assumption.
      </div>

      {/* ── Header ── */}
      <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
        <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>🧮</div>
        <p style={{ color: 'var(--theme-text)', opacity: 0.8, fontSize: '1rem' }}>
          A hypothetical calculator: enter your own amount and your own assumed
          rate, and see an illustration of the maths — nothing more.
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

      {/* ── User-entered hypothetical inputs ── */}
      <div style={cardStyle}>
        <h2 style={{ color: 'var(--theme-primary)', marginBottom: '1.2rem', fontSize: '1.2rem' }}>
          ⚙️ Enter your own hypothetical numbers
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.2rem' }}>
          <div>
            <label style={labelStyle}>Amount (MTX) — a number you choose</label>
            <input
              type="text"
              value={inputValue}
              onChange={e => handleAmountInput(e.target.value)}
              style={{
                width: '100%',
                padding: '0.6rem 0.8rem',
                background: 'rgba(0,0,0,0.4)',
                border: `1px solid ${ILLUSTRATION_COLOR}`,
                borderRadius: '4px',
                color: ILLUSTRATION_COLOR,
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
              value={Math.min(amount, 100000)}
              onChange={e => {
                const v = parseInt(e.target.value, 10);
                setAmount(v);
                setInputValue(String(v));
              }}
              style={{ width: '100%', marginTop: '0.5rem', accentColor: ILLUSTRATION_COLOR }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', opacity: 0.6 }}>
              <span>0</span><span>50K</span><span>100K</span>
            </div>
            {amount > 100000 && (
              <div style={{ fontSize: '0.68rem', color: ILLUSTRATION_COLOR, marginTop: '0.25rem', opacity: 0.8 }}>
                ↑ Slider shows up to 100K — your typed value ({formatMTX(amount)}) is used in all calculations.
              </div>
            )}
          </div>

          <div>
            <label style={labelStyle}>
              Hypothetical annual rate (%) — your assumption, not a real rate
            </label>
            <input
              type="text"
              inputMode="decimal"
              value={rateInput}
              onChange={e => handleRateInput(e.target.value)}
              placeholder="Enter your own % — for example, type any number to test the maths"
              style={{
                width: '100%',
                padding: '0.6rem 0.8rem',
                background: 'rgba(0,0,0,0.4)',
                border: `1px solid ${ILLUSTRATION_COLOR}`,
                borderRadius: '4px',
                color: ILLUSTRATION_COLOR,
                fontFamily: 'Courier New, monospace',
                fontSize: '1.1rem',
                outline: 'none',
              }}
            />
            <div style={{ fontSize: '0.75rem', opacity: 0.7, marginTop: '0.4rem' }}>
              This page offers no rate. Whatever you type here is purely a
              hypothetical assumption for the illustration.
            </div>
          </div>

          <div>
            <label style={labelStyle}>Time frame for the illustration</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              {TIME_FRAMES.map(tf => (
                <button
                  key={tf.key}
                  onClick={() => setTimeFrame(tf.key)}
                  style={{
                    padding: '0.5rem',
                    background: timeFrame === tf.key ? ILLUSTRATION_COLOR : 'rgba(0,0,0,0.3)',
                    color: timeFrame === tf.key ? '#000' : 'var(--theme-text)',
                    border: `1px solid ${ILLUSTRATION_COLOR}`,
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
                  style={{ accentColor: ILLUSTRATION_COLOR }}
                />
                Apply the hypothetical rate with daily compounding (maths only)
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* ── Hypothetical illustration results ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.2rem', marginBottom: '1.5rem' }}>
        <div style={{ ...cardStyle, marginBottom: 0, textAlign: 'center' }}>
          <span style={labelStyle}>Your entered hypothetical rate</span>
          <div style={valueStyle}>
            {hypotheticalRate}% per year
          </div>
          <div style={{ fontSize: '0.75rem', opacity: 0.7, marginTop: '0.3rem' }}>
            Entered by you — not offered, not live, not promised
          </div>
        </div>

        <div style={{ ...cardStyle, marginBottom: 0, textAlign: 'center' }}>
          <span style={labelStyle}>Hypothetical {selectedTF.label} illustration</span>
          <div style={valueStyle}>
            +{formatMTX(animatedChange)} MTX
          </div>
          <div style={{ fontSize: '0.75rem', opacity: 0.6, marginTop: '0.4rem' }}>
            Illustrative change only, if your assumed rate applied
          </div>
        </div>

        <div style={{ ...cardStyle, marginBottom: 0, textAlign: 'center' }}>
          <span style={labelStyle}>Illustrative balance after {selectedTF.label}</span>
          <div style={{ ...valueStyle, color: 'var(--theme-primary)' }}>
            {formatMTX(amount + illustrativeChange)} MTX
          </div>
          <div style={{ fontSize: '0.75rem', opacity: 0.6, marginTop: '0.4rem' }}>
            Started with your entered {formatMTX(amount)} MTX — illustration only
          </div>
        </div>
      </div>

      {/* ── Hypothetical growth illustration chart ── */}
      <div style={cardStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <h2 style={{ color: 'var(--theme-primary)', fontSize: '1.2rem', margin: 0 }}>
            📈 Hypothetical growth illustration
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

        {hypotheticalRate > 0 ? (
          <>
            <SparklineChart data={chartData} color={ILLUSTRATION_COLOR} />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.8rem', fontSize: '0.85rem' }}>
              <span style={{ opacity: 0.7 }}>Start: {formatMTX(amount)} MTX</span>
              <span style={{ color: ILLUSTRATION_COLOR, fontWeight: 'bold' }}>Illustrative end: {formatMTX(finalBalance)} MTX</span>
            </div>
            <div style={{ textAlign: 'center', marginTop: '0.5rem', fontSize: '0.8rem', color: ILLUSTRATION_COLOR }}>
              +{formatMTX(finalBalance - amount)} MTX illustrative change over {projectionDays} days at your entered rate — hypothetical only
            </div>
          </>
        ) : (
          <div style={{ textAlign: 'center', padding: '2rem', opacity: 0.5 }}>
            Enter a hypothetical rate above 0% to see an illustration of the maths.
          </div>
        )}
      </div>

      {/* ── Hypothetical illustration summary ── */}
      <div style={{
        ...cardStyle,
        border: '1px solid var(--theme-primary)',
        background: 'rgba(0,255,153,0.08)',
        marginBottom: 0,
      }}>
        <h2 style={{ color: 'var(--theme-primary)', marginBottom: '1rem', fontSize: '1.2rem' }}>
          🧮 Hypothetical {selectedTF.label} illustration — summary
        </h2>
        <div style={{ display: 'grid', gap: '0.7rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(0,255,153,0.15)', paddingBottom: '0.5rem' }}>
            <span style={{ opacity: 0.8 }}>Amount you entered</span>
            <span style={{ fontWeight: 'bold' }}>{formatMTX(amount)} MTX</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(0,255,153,0.15)', paddingBottom: '0.5rem' }}>
            <span style={{ opacity: 0.8 }}>Hypothetical rate you entered</span>
            <span style={{ fontWeight: 'bold' }}>{hypotheticalRate}% per year</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(0,255,153,0.15)', paddingBottom: '0.5rem' }}>
            <span style={{ opacity: 0.8 }}>Illustrative change ({selectedTF.label}, hypothetical only)</span>
            <span style={{ color: ILLUSTRATION_COLOR, fontWeight: 'bold' }}>+{formatMTX(illustrativeChange)} MTX</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '0.2rem' }}>
            <span style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>Illustrative total (hypothetical only)</span>
            <span style={{
              color: 'var(--theme-primary)',
              fontWeight: 'bold',
              fontSize: '1.3rem',
              textShadow: '0 0 10px var(--theme-glow)',
            }}>
              {formatMTX(amount + illustrativeChange)} MTX
            </span>
          </div>
        </div>
        <p style={{ fontSize: '0.8rem', opacity: 0.75, marginTop: '1.2rem', lineHeight: 1.6 }}>
          This summary is a hypothetical illustration only. It does not predict
          or promise any result, and no rate shown here is available or live.
          MTX is a utility token, not an investment, with no guaranteed value.
        </p>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginTop: '1rem', alignItems: 'center' }}>
          <button
            type="button"
            onClick={handleCopyShare}
            style={{
              padding: '0.6rem 1.2rem',
              background: ILLUSTRATION_COLOR,
              color: '#000',
              border: 'none',
              borderRadius: '6px',
              fontFamily: 'Courier New, monospace',
              fontWeight: 'bold',
              fontSize: '0.9rem',
              cursor: 'pointer',
            }}
          >
            Copy my hypothetical illustration
          </button>
          <button
            type="button"
            onClick={handleCopyShareLink}
            style={{
              padding: '0.6rem 1.2rem',
              background: 'transparent',
              color: ILLUSTRATION_COLOR,
              border: `1px solid ${ILLUSTRATION_COLOR}`,
              borderRadius: '6px',
              fontFamily: 'Courier New, monospace',
              fontWeight: 'bold',
              fontSize: '0.9rem',
              cursor: 'pointer',
            }}
          >
            Copy share link
          </button>
          <span role="status" aria-live="polite" style={{ fontSize: '0.8rem', color: ILLUSTRATION_COLOR }}>
            {shareStatus}
          </span>
        </div>
        <p style={{ fontSize: '0.75rem', opacity: 0.65, marginTop: '0.6rem', lineHeight: 1.5 }}>
          Sharing copies only the numbers you entered and generated here, labelled as a hypothetical illustration, plus a link that recreates this exact illustration.
        </p>
      </div>
    </div>
  );
};

export default MoneyPrinter;
