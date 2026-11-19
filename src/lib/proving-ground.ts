// The Proving Ground — shared lib for the hands-on MTX 101 training section.
//
// Everything here is training-side only: no wallet connection, no
// transactions, nothing signed, nothing sent anywhere. Progress lives in
// localStorage on the visitor's own device (the same device-local pattern
// as the arcade bests/streaks and the Free-Play Floor session stats) —
// no account, no server copy.
//
// Every printed fact comes from the public proof pack
// (bot-core/security/public-proof-pack-2026-11-12.md) — the same source
// the /security page publishes. The live mint-rate read follows the
// MTX Live Terminal pattern (src/lib/mtxTerminal.ts): keyless public RPC
// endpoints with per-read failover, pinned static network, per-attempt
// timeout, and an explicit failure result instead of a stale number.
import { Contract, JsonRpcProvider } from 'ethers';
import confetti from './vendor/canvas-confetti.js';

/** The one real MTX contract (proof pack §1). */
export const REAL_MTX = '0x53307e1db6c5cb6773c9495ca140372016dfe266';

/**
 * The known fake "MTX" — WARNING ONLY. PolygonScan flags this address as
 * Fake_Phishing8012348 / Phish — Hack (proof pack §1). It appears in the
 * Proving Ground only as the labelled warning it is: in the trainer's
 * answer reveals and in the verification walk's warning-signs step.
 * Never present it as usable, buyable, or connected to Matrix Hub.
 */
export const FAKE_MTX = '0xDCb51dE3359C946364F707556aC8e6C6f2e69A8a';

/** Founder wallet — published openly as the contracts' controller (proof pack §6). */
export const FOUNDER_WALLET = '0x9fb4bb44d8d962d695fc93b3dc15f1b287391077';

/** Published figures (proof pack §2, read on-chain 2026-11-12). */
export const PUBLISHED = {
  /** Mint rate as published on /security: 1 POL = 1,000 MTX. */
  mintRate: 1000,
  totalSupply: '105,100',
  maxSupply: '100,000,000',
  readDate: '2026-11-12',
} as const;

export function scanUrl(address: string): string {
  return `https://polygonscan.com/address/${address}`;
}

// ---------------------------------------------------------------------------
// Device-local progress (never throws — storage can be unavailable)
// ---------------------------------------------------------------------------

export interface SpotProgress {
  best: number;
  bestStreak: number;
  runs: number;
  completed: boolean;
}

export interface ProvingGroundProgress {
  spot: SpotProgress;
  mint: { runs: number; completed: boolean };
  verify: { steps: boolean[]; completed: boolean };
}

const STORAGE_KEY = 'mh_proving_ground_v1';
export const VERIFY_STEP_COUNT = 5;

export function defaultProgress(): ProvingGroundProgress {
  return {
    spot: { best: 0, bestStreak: 0, runs: 0, completed: false },
    mint: { runs: 0, completed: false },
    verify: {
      steps: Array(VERIFY_STEP_COUNT).fill(false),
      completed: false,
    },
  };
}

export function loadProgress(): ProvingGroundProgress {
  const base = defaultProgress();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return base;
    const parsed = JSON.parse(raw) as Partial<ProvingGroundProgress>;
    return {
      spot: { ...base.spot, ...(parsed.spot ?? {}) },
      mint: { ...base.mint, ...(parsed.mint ?? {}) },
      verify: {
        steps:
          Array.isArray(parsed.verify?.steps) &&
          parsed.verify.steps.length === VERIFY_STEP_COUNT
            ? parsed.verify.steps.map(Boolean)
            : base.verify.steps,
        completed: Boolean(parsed.verify?.completed),
      },
    };
  } catch {
    return base;
  }
}

export function saveProgress(p: ProvingGroundProgress): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
  } catch {
    // Storage unavailable (private mode, quota) — training still works,
    // progress simply doesn't persist. Never break the module over it.
  }
}

export function resetProgress(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to do — see saveProgress.
  }
}

export function completedCount(p: ProvingGroundProgress): number {
  return [p.spot.completed, p.mint.completed, p.verify.completed].filter(
    Boolean,
  ).length;
}

// ---------------------------------------------------------------------------
// Live mint-rate read (Terminal pattern, trimmed to the two reads the
// mint simulation needs: maticToMtxRate + mintingPaused)
// ---------------------------------------------------------------------------

const PROVING_GROUND_RPCS = [
  'https://polygon-bor-rpc.publicnode.com',
  'https://polygon.drpc.org',
  'https://gateway.tenderly.co/public/polygon',
  'https://1rpc.io/matic',
] as const;

const MTX_RATE_ABI = [
  'function maticToMtxRate() view returns (uint256)',
  'function mintingPaused() view returns (bool)',
];

const READ_TIMEOUT_MS = 10_000;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
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

async function attempt<T>(
  providers: JsonRpcProvider[],
  read: (provider: JsonRpcProvider) => Promise<T>,
): Promise<T | null> {
  for (let i = 0; i < providers.length; i += 1) {
    if (i > 0) await delay(700);
    try {
      return await withTimeout(read(providers[i]), READ_TIMEOUT_MS);
    } catch {
      // Endpoint failed or timed out — fail over to the next one.
    }
  }
  return null;
}

export interface MintRateRead {
  /** MTX per 1 POL as a whole number, or null if every endpoint failed. */
  rate: number | null;
  /** Minting paused state, or null if that read failed everywhere. */
  paused: boolean | null;
}

/**
 * Read the live mint rate + paused flag fresh from the MTX contract.
 * Returns nulls on total failure — callers must show an explicit failure
 * state (the simulation falls back to the published rate, labelled as
 * such), never a silent or invented number.
 */
export async function readMintRate(): Promise<MintRateRead> {
  // staticNetwork pinned for the same reason as the Terminal lib: an
  // unpinned provider whose endpoint is unreachable retries network
  // detection forever in the background. Polygon mainnet is chain 137.
  const providers = PROVING_GROUND_RPCS.map(
    (url) => new JsonRpcProvider(url, 137, { staticNetwork: true }),
  );
  const [rate, paused] = await Promise.all([
    attempt(
      providers,
      (p) =>
        new Contract(REAL_MTX, MTX_RATE_ABI, p).maticToMtxRate() as Promise<bigint>,
    ),
    attempt(
      providers,
      (p) =>
        new Contract(REAL_MTX, MTX_RATE_ABI, p).mintingPaused() as Promise<boolean>,
    ),
  ]);
  return {
    rate: rate !== null ? Number(rate) : null,
    paused,
  };
}

// ---------------------------------------------------------------------------
// Spot-the-Fake deck generation
// ---------------------------------------------------------------------------

export type CardKind = 'real' | 'lookalike' | 'known-fake';

export interface TrainerCard {
  address: string;
  kind: CardKind;
  /** How many characters differ from the real address (0 for the real one). */
  changes: number;
  /** True when the only differences from the real address are letter case. */
  caseOnly: boolean;
}

const HEX = '0123456789abcdef';

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Change `count` hex characters of the real address (after the 0x). */
function mutate(changes: number, caseOnly: boolean): TrainerCard {
  const body = REAL_MTX.slice(2).split('');
  const positions = shuffle(body.map((_, i) => i)).slice(0, changes);
  for (const pos of positions) {
    const original = body[pos];
    if (caseOnly && /[a-f]/i.test(original)) {
      body[pos] =
        original === original.toLowerCase()
          ? original.toUpperCase()
          : original.toLowerCase();
    } else {
      let next = original;
      while (next.toLowerCase() === original.toLowerCase()) {
        next = HEX[Math.floor(Math.random() * HEX.length)];
      }
      // Keep the mutated character's case class plausible (digits have none).
      body[pos] = /[A-F]/.test(original) ? next.toUpperCase() : next;
    }
  }
  return {
    address: `0x${body.join('')}`,
    kind: 'lookalike',
    changes,
    caseOnly,
  };
}

/**
 * One run of the trainer: 10 cards — 3 exact copies of the real address,
 * the known fake (exact, labelled on reveal), and 6 lookalikes of the
 * real address (three 1-change, one case-only flip, two 2-change,
 * one 3-change). Shuffled.
 */
export function buildDeck(): TrainerCard[] {
  const real: TrainerCard = {
    address: REAL_MTX,
    kind: 'real',
    changes: 0,
    caseOnly: false,
  };
  const knownFake: TrainerCard = {
    address: FAKE_MTX,
    kind: 'known-fake',
    changes: countDiff(FAKE_MTX, REAL_MTX),
    caseOnly: false,
  };
  return shuffle([
    real,
    { ...real },
    { ...real },
    knownFake,
    mutate(1, false),
    mutate(1, false),
    mutate(1, false),
    mutate(1, true),
    mutate(2, false),
    mutate(3, false),
  ]);
}

/** Per-position difference count between two same-length addresses. */
export function countDiff(a: string, b: string): number {
  let n = 0;
  for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
    if (a[i] !== b[i]) n += 1;
  }
  return n;
}

// ---------------------------------------------------------------------------
// Confetti — completion-moment bursts.
// Preferred: the vendored canvas-confetti (ISC, catdad/canvas-confetti —
// see src/lib/vendor/canvas-confetti.js for provenance; harvested and
// licence-verified in bot-core/ops/harvest/core-engineering.md). If it
// ever fails to load or fire, a small hand-rolled canvas burst below
// stands in. Used only for genuine completion moments (a passed trainer
// run, a finished module). Respects prefers-reduced-motion.
// ---------------------------------------------------------------------------

const CONFETTI_COLORS = ['#4ade80', '#22c55e', '#facc15', '#a3e635', '#ffffff'];

export function burstConfetti(): void {
  try {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const base = {
      colors: CONFETTI_COLORS,
      disableForReducedMotion: true,
      zIndex: 9999,
    };
    confetti({ ...base, particleCount: 90, spread: 75, origin: { y: 0.35 } });
    confetti({
      ...base,
      particleCount: 45,
      angle: 60,
      spread: 60,
      origin: { x: 0, y: 0.5 },
    });
    confetti({
      ...base,
      particleCount: 45,
      angle: 120,
      spread: 60,
      origin: { x: 1, y: 0.5 },
    });
  } catch {
    burstConfettiFallback();
  }
}

/** Hand-rolled fallback burst — used only if the vendored lib fails. */
function burstConfettiFallback(): void {
  try {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const canvas = document.createElement('canvas');
    canvas.style.cssText =
      'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:9999;';
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    document.body.appendChild(canvas);
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      canvas.remove();
      return;
    }
    const colors = ['#4ade80', '#22c55e', '#facc15', '#a3e635', '#ffffff'];
    const parts = Array.from({ length: 140 }, () => ({
      x: canvas.width / 2 + (Math.random() - 0.5) * canvas.width * 0.4,
      y: canvas.height * 0.35,
      vx: (Math.random() - 0.5) * 11,
      vy: -(Math.random() * 9 + 4),
      w: Math.random() * 7 + 4,
      h: Math.random() * 4 + 3,
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.25,
      color: colors[Math.floor(Math.random() * colors.length)],
    }));
    const start = performance.now();
    const tick = (now: number) => {
      const t = now - start;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const p of parts) {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.22;
        p.vx *= 0.99;
        p.rot += p.vr;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = Math.max(0, 1 - t / 1600);
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      }
      if (t < 1600) requestAnimationFrame(tick);
      else canvas.remove();
    };
    requestAnimationFrame(tick);
  } catch {
    // Confetti is decoration — never let it break a completion flow.
  }
}
