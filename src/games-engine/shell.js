/**
 * MatrixEngine — shared KAPLAY shell for Matrix Hub arcade games.
 *
 * Season 2 foundation: every self-built game boots through this shell so
 * input, scaling, pause and sound behave identically across the arcade
 * instead of being hand-rolled per game.
 *
 * Source of truth: src/games-engine/shell.js
 * Built bundle:    public/games/engine/matrix-engine.js
 *                  (npm run build:engine — esbuild, KAPLAY inlined)
 *
 * A game page loads, in order:
 *   ../matrix-best.js          (competitive layer — unchanged)
 *   ../engine/matrix-engine.js (this shell)
 *   script.js                  (the game, written against window.MatrixEngine)
 *
 * Shell API:
 *   MatrixEngine.boot({ slug, canvas, width, height, background })
 *     -> handle { k, slug, sound, best,
 *                 setPaused(bool), togglePause(), isPaused(),
 *                 newRun(), durationSec(), finishRun(value, opts),
 *                 renderMeta(), onSwipe(fn), bindPad(fn) }
 *
 * Guarantees:
 *   - KAPLAY runs in global:false mode inside the game's existing canvas,
 *     letterboxed to the game's logical size.
 *   - Pause: P / Esc, the on-canvas pause button, and auto-pause when the
 *     tab is hidden. Pause is k.debug.paused, so the render loop keeps
 *     drawing the frozen frame under the shell's pause overlay.
 *   - Sound: tiny generated WebAudio beeps (no audio assets). Mute toggle
 *     persisted at localStorage 'mh:engine:muted'.
 *   - Competitive layer: delegates to window.MatrixBest when present
 *     (public/games/matrix-best.js). A game with no MatrixBest loaded
 *     still runs; the bridge simply no-ops.
 *   - The shell never throws into the game: boot failures fall back to an
 *     on-canvas error message so a broken engine build can't white-screen
 *     a game page.
 */
import kaplay from 'kaplay';

const MUTE_KEY = 'mh:engine:muted';

function createSound() {
  let ctx = null;
  let muted = false;
  try { muted = localStorage.getItem(MUTE_KEY) === '1'; } catch { /* private mode */ }

  function ac() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function beep(freq = 440, dur = 0.08, type = 'square', vol = 0.04, when = 0) {
    if (muted) return;
    const a = ac();
    if (!a) return;
    try {
      const t0 = a.currentTime + when;
      const osc = a.createOscillator();
      const gain = a.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t0);
      gain.gain.setValueAtTime(vol, t0);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(gain).connect(a.destination);
      osc.start(t0);
      osc.stop(t0 + dur + 0.02);
    } catch { /* audio is best-effort */ }
  }

  return {
    beep,
    eat() { beep(660, 0.06, 'square', 0.05); },
    hit() { beep(160, 0.15, 'sawtooth', 0.06); },
    die() { beep(220, 0.12, 'sawtooth', 0.06); beep(110, 0.25, 'sawtooth', 0.06, 0.1); },
    level() { beep(523, 0.07, 'square', 0.05); beep(784, 0.1, 'square', 0.05, 0.07); },
    click() { beep(440, 0.04, 'square', 0.03); },
    get muted() { return muted; },
    toggleMuted() {
      muted = !muted;
      try { localStorage.setItem(MUTE_KEY, muted ? '1' : '0'); } catch { /* ignore */ }
      return muted;
    }
  };
}

function boot(opts) {
  const { slug, canvas, width = 600, height = 600, background = [0, 0, 0] } = opts || {};
  const sound = createSound();
  const best = window.MatrixBest || null;

  const k = kaplay({
    canvas,
    global: false,
    width,
    height,
    letterbox: true,
    background,
    pixelDensity: Math.min(window.devicePixelRatio || 1, 2),
    debug: false
  });

  /* ------------------------------ pause ------------------------------ */
  let paused = false;
  let overlay = null;

  function ensureOverlay() {
    if (overlay || !canvas || !canvas.parentElement) return;
    const parent = canvas.parentElement;
    if (getComputedStyle(parent).position === 'static') parent.style.position = 'relative';
    overlay = document.createElement('div');
    overlay.className = 'mh-pause-overlay';
    overlay.textContent = '❚❚ PAUSED — press P or tap to resume';
    overlay.style.cssText =
      'position:absolute;inset:0;display:none;align-items:center;justify-content:center;' +
      'background:rgba(0,0,0,0.72);color:#0f0;font-family:\'Courier New\',monospace;' +
      'font-size:1.1rem;letter-spacing:1px;z-index:30;cursor:pointer;text-align:center;padding:1rem;';
    overlay.addEventListener('click', () => setPaused(false));
    parent.appendChild(overlay);
  }

  function setPaused(value) {
    paused = !!value;
    k.debug.paused = paused;
    ensureOverlay();
    if (overlay) overlay.style.display = paused ? 'flex' : 'none';
  }

  window.addEventListener('keydown', (e) => {
    if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') {
      // Don't hijack typing in form fields (code-breaker's input etc.).
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
      setPaused(!paused);
    }
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) setPaused(true);
  });

  /* --------------------------- run tracking --------------------------- */
  // Mirrors the games' own mhNewRun/mhFinishRun pattern: a run id per
  // run, float-second duration, and finishRun(slug, value, opts) where
  // value is the per-game object (e.g. { score }) MatrixBest expects.
  let runStart = null;
  let runId = null;
  function newRun() {
    runStart = performance.now();
    runId = slug + '-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
  }
  function durationSec() {
    return runStart ? (performance.now() - runStart) / 1000 : undefined;
  }

  function finishRun(value, runOpts = {}) {
    if (!best) return null;
    return best.finishRun(slug, value, { durationSec: durationSec(), runId, ...runOpts });
  }

  function renderMeta() {
    if (!best) return;
    const ch = document.getElementById('mh-challenge');
    if (ch) best.renderChallengeInto(ch, slug);
    const st = document.getElementById('mh-streak');
    if (st) best.renderStreakInto(st);
  }

  /* ------------------------------ input ------------------------------- */
  // Swipe on the canvas -> 'up' | 'down' | 'left' | 'right'
  function onSwipe(fn, threshold = 24) {
    if (!canvas) return;
    let sx = 0, sy = 0;
    canvas.addEventListener('touchstart', (e) => {
      const t = e.changedTouches[0];
      sx = t.clientX; sy = t.clientY;
    }, { passive: true });
    canvas.addEventListener('touchend', (e) => {
      const t = e.changedTouches[0];
      const dx = t.clientX - sx, dy = t.clientY - sy;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < threshold) return;
      fn(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
    }, { passive: true });
  }

  // Wire the standard .arrow-btn D-pad (data-dir, as the game pages use)
  // to a handler.
  function bindPad(fn) {
    document.querySelectorAll('.arrow-btn').forEach((btn) => {
      const dir = btn.getAttribute('data-dir') || btn.getAttribute('data-direction');
      if (!dir) return;
      const fire = (e) => { e.preventDefault(); fn(dir); };
      btn.addEventListener('click', fire);
      btn.addEventListener('touchstart', fire, { passive: false });
    });
  }

  return {
    k,
    slug,
    sound,
    best,
    setPaused,
    togglePause: () => setPaused(!paused),
    isPaused: () => paused,
    newRun,
    durationSec,
    finishRun,
    renderMeta,
    onSwipe,
    bindPad
  };
}

function safeBoot(opts) {
  try {
    return boot(opts);
  } catch (err) {
    console.error('[MatrixEngine] boot failed', err);
    const c = opts && opts.canvas;
    if (c && c.getContext) {
      const g = c.getContext('2d');
      if (g) {
        g.fillStyle = '#000'; g.fillRect(0, 0, c.width, c.height);
        g.fillStyle = '#0f0'; g.font = '16px monospace'; g.textAlign = 'center';
        g.fillText('ENGINE FAILED TO START — please reload', c.width / 2, c.height / 2);
      }
    }
    return null;
  }
}

window.MatrixEngine = { boot: safeBoot, createSound };
export default window.MatrixEngine;
