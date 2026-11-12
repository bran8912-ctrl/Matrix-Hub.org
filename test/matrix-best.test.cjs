/**
 * matrix-best.test.js — headless tests for src/lib/matrix-best.js
 * (HUB task 155, Competitive Phase 1).
 *
 * Run: node test/matrix-best.test.cjs
 * Uses a localStorage mock; also verifies the module never throws when
 * storage is absent or throws on every access.
 */
'use strict';

const assert = require('node:assert');
const path = require('node:path');

function makeStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => { map.set(k, String(v)); },
    removeItem: (k) => { map.delete(k); },
    _map: map,
  };
}

const fs = require('node:fs');
const vm = require('node:vm');
const MODULE_SRC = fs.readFileSync(
  path.join(__dirname, '..', 'src', 'lib', 'matrix-best.js'), 'utf8');
let currentStorage;
function loadModule(storage) {
  currentStorage = storage;
  const sandbox = { module: { exports: {} }, console };
  // The module reads localStorage off its global object on every call,
  // so expose the current mock through a getter.
  Object.defineProperty(sandbox, 'localStorage', {
    get() { return currentStorage; },
  });
  vm.createContext(sandbox);
  vm.runInContext(MODULE_SRC, sandbox);
  return sandbox.module.exports;
}

function arrEq(a, b) { assert.strictEqual(JSON.stringify(a), JSON.stringify(b)); }
let passed = 0;
let failed = 0;
function test(name, fn) {
  try {
    fn();
    passed++;
    console.log('ok - ' + name);
  } catch (e) {
    failed++;
    console.error('FAIL - ' + name + ': ' + e.message);
  }
}

/* ------------------------- Original best API ------------------------- */
{
  const MB = loadModule(makeStorage());

  test('games list contains the 6 scored games and not matrix-rain', () => {
    arrEq(MB.games.slice().sort(),
      ['bullet-dodge', 'code-breaker', 'cyber-snake', 'hacking-simulator', 'memory-game', 'neos-training']);
    assert.strictEqual(MB.getBest('matrix-rain'), null);
  });

  test('keyFor uses the matrix_best_ prefix', () => {
    assert.strictEqual(MB.keyFor('cyber-snake'), 'matrix_best_cyber-snake');
  });

  test('getBest returns null with nothing stored', () => {
    assert.strictEqual(MB.getBest('cyber-snake'), null);
  });

  test('saveBest stores a first score and reports a new best', () => {
    const r = MB.saveBest('cyber-snake', { score: 120 });
    assert.strictEqual(r.isNewBest, true);
    assert.strictEqual(r.best.score, 120);
    assert.strictEqual(MB.getBest('cyber-snake').score, 120);
  });

  test('saveBest keeps the higher score', () => {
    assert.strictEqual(MB.saveBest('cyber-snake', { score: 50 }).isNewBest, false);
    assert.strictEqual(MB.getBest('cyber-snake').score, 120);
    assert.strictEqual(MB.saveBest('cyber-snake', { score: 200 }).isNewBest, true);
    assert.strictEqual(MB.getBest('cyber-snake').score, 200);
  });

  test('saveBest rejects an equal score (not a new best)', () => {
    assert.strictEqual(MB.saveBest('cyber-snake', { score: 200 }).isNewBest, false);
  });

  test('saveBest rejects negative and non-number scores', () => {
    assert.strictEqual(MB.saveBest('cyber-snake', { score: -5 }).isNewBest, false);
    assert.strictEqual(MB.saveBest('cyber-snake', { score: 'x' }).isNewBest, false);
    assert.strictEqual(MB.saveBest('cyber-snake', null).isNewBest, false);
  });

  test('unknown slug never stores', () => {
    assert.strictEqual(MB.saveBest('nope', { score: 10 }).isNewBest, false);
    assert.strictEqual(MB.getBest('nope'), null);
    assert.strictEqual(MB.formatBest('nope', { score: 1 }), '');
  });

  test('formatBest formats a score best and is empty without one', () => {
    assert.strictEqual(MB.formatBest('cyber-snake', MB.getBest('cyber-snake')), 'Best: 200');
    assert.strictEqual(MB.formatBest('bullet-dodge', null), '');
    assert.strictEqual(MB.formatBest('bullet-dodge', MB.getBest('bullet-dodge')), '');
  });

  test('neos-training: lower time wins', () => {
    assert.strictEqual(MB.saveBest('neos-training', { timeMs: 320 }).isNewBest, true);
    assert.strictEqual(MB.saveBest('neos-training', { timeMs: 410 }).isNewBest, false);
    assert.strictEqual(MB.saveBest('neos-training', { timeMs: 280 }).isNewBest, true);
    assert.strictEqual(MB.formatBest('neos-training', MB.getBest('neos-training')), 'Best: 280 ms');
    assert.strictEqual(MB.saveBest('neos-training', { timeMs: 0 }).isNewBest, false);
  });

  test('memory-game: per-difficulty best, fewest moves then fastest time', () => {
    assert.strictEqual(MB.saveBest('memory-game', { moves: 20, time: 90 }, 'medium').isNewBest, true);
    assert.strictEqual(MB.saveBest('memory-game', { moves: 22, time: 60 }, 'medium').isNewBest, false);
    assert.strictEqual(MB.saveBest('memory-game', { moves: 20, time: 80 }, 'medium').isNewBest, true);
    assert.strictEqual(MB.saveBest('memory-game', { moves: 15, time: 70 }, 'easy').isNewBest, true);
    const best = MB.getBest('memory-game');
    assert.strictEqual(best.medium.moves, 20);
    assert.strictEqual(best.easy.moves, 15);
    assert.strictEqual(MB.formatBest('memory-game', best, 'medium'), 'Best (medium): 20 moves · 1:20');
    assert.strictEqual(MB.saveBest('memory-game', { moves: 1, time: 1 }, 'extreme').isNewBest, false);
  });

  test('clearBest removes a stored best', () => {
    assert.strictEqual(MB.clearBest('cyber-snake'), true);
    assert.strictEqual(MB.getBest('cyber-snake'), null);
    assert.strictEqual(MB.clearBest('nope'), false);
  });

  test('corrupt stored data is treated as no best', () => {
    currentStorage.setItem('matrix_best_bullet-dodge', '{not json');
    assert.strictEqual(MB.getBest('bullet-dodge'), null);
    currentStorage.setItem('matrix_best_bullet-dodge', JSON.stringify({ score: 'lots' }));
    assert.strictEqual(MB.getBest('bullet-dodge'), null);
  });
}

/* --------------------------- Local boards ---------------------------- */
{
  const MB = loadModule(makeStorage());
  let n = 0;
  const run = (slug, value, opts) => MB.recordRun(slug, value,
    Object.assign({ durationSec: 60, runId: 'run-' + (++n) }, opts || {}));

  test('board starts empty with the honest empty shape', () => {
    const b = MB.getBoard('cyber-snake');
    assert.strictEqual(b.version, 1);
    arrEq(b.entries, []);
    assert.strictEqual(MB.boardKeyFor('cyber-snake'), 'mh:lb:cyber-snake');
  });

  test('recordRun inserts in score order and reports rank + new best', () => {
    let r = run('cyber-snake', { score: 50 });
    assert.strictEqual(r.stored, true);
    assert.strictEqual(r.rank, 1);
    assert.strictEqual(r.isNewBest, true);
    r = run('cyber-snake', { score: 30 });
    assert.strictEqual(r.rank, 2);
    assert.strictEqual(r.isNewBest, false);
    r = run('cyber-snake', { score: 80 });
    assert.strictEqual(r.rank, 1);
    const scores = MB.getBoard('cyber-snake').entries.map((e) => e.score);
    arrEq(scores, [80, 50, 30]);
  });

  test('board entries carry date + duration and no name', () => {
    const e = MB.getBoard('cyber-snake').entries[0];
    assert.match(e.date, /^\d{4}-\d{2}-\d{2}$/);
    assert.strictEqual(e.durationSec, 60);
    assert.strictEqual('name' in e, false);
  });

  test('ties keep the earlier entry first', () => {
    run('cyber-snake', { score: 80 });
    const scores = MB.getBoard('cyber-snake').entries.map((e) => e.score);
    arrEq(scores.slice(0, 2), [80, 80]);
  });

  test('board is capped at top 10', () => {
    for (let s = 100; s < 112; s++) run('cyber-snake', { score: s });
    const b = MB.getBoard('cyber-snake');
    assert.strictEqual(b.entries.length, 10);
    assert.strictEqual(b.entries[0].score, 111);
    const low = run('cyber-snake', { score: 1 });
    assert.strictEqual(low.stored, false);
    assert.strictEqual(low.reason, 'below-top-10');
  });

  test('a repeated runId cannot double-insert', () => {
    const before = MB.getBoard('bullet-dodge').entries.length;
    const opts = { durationSec: 60, runId: 'same-run' };
    assert.strictEqual(MB.recordRun('bullet-dodge', { score: 10 }, opts).stored, true);
    const dup = MB.recordRun('bullet-dodge', { score: 10 }, opts);
    assert.strictEqual(dup.stored, false);
    assert.strictEqual(dup.reason, 'duplicate-run');
    assert.strictEqual(MB.getBoard('bullet-dodge').entries.length, before + 1);
  });

  test('sanity cap refuses an impossible score but keeps the board intact', () => {
    const r = run('bullet-dodge', { score: 999999 });
    assert.strictEqual(r.stored, false);
    assert.strictEqual(r.reason, 'over-cap');
  });

  test('a too-short run is not stored', () => {
    const r = MB.recordRun('bullet-dodge', { score: 10 }, { durationSec: 1, runId: 'short-1' });
    assert.strictEqual(r.stored, false);
    assert.strictEqual(r.reason, 'too-short');
  });

  test('neos-training board ranks fastest first and refuses sub-human times', () => {
    run('neos-training', { timeMs: 300 }, { durationSec: 45 });
    run('neos-training', { timeMs: 250 }, { durationSec: 45 });
    const times = MB.getBoard('neos-training').entries.map((e) => e.score);
    arrEq(times, [250, 300]);
    const bad = run('neos-training', { timeMs: 20 }, { durationSec: 45 });
    assert.strictEqual(bad.stored, false);
    assert.strictEqual(bad.reason, 'implausible-time');
    assert.strictEqual(MB.formatEntryScore('neos-training', { score: 250 }), '250 ms');
  });

  test('memory-game board ranks fewest moves first and refuses impossible moves', () => {
    run('memory-game', { moves: 20, time: 90 }, { durationSec: 95, difficulty: 'medium' });
    run('memory-game', { moves: 16, time: 120 }, { durationSec: 125, difficulty: 'medium' });
    const moves = MB.getBoard('memory-game').entries.map((e) => e.score);
    arrEq(moves, [16, 20]);
    const bad = run('memory-game', { moves: 3, time: 10 }, { durationSec: 30, difficulty: 'medium' });
    assert.strictEqual(bad.stored, false);
    assert.strictEqual(MB.formatEntryScore('memory-game', { score: 16, timeSec: 120 }), '16 moves · 2:00');
  });

  test('clearBoard wipes only that game board', () => {
    assert.strictEqual(MB.clearBoard('cyber-snake'), true);
    arrEq(MB.getBoard('cyber-snake').entries, []);
    assert.ok(MB.getBoard('bullet-dodge').entries.length > 0);
  });

  test('corrupt board data reads as an empty board', () => {
    currentStorage.setItem('mh:lb:code-breaker', '###');
    arrEq(MB.getBoard('code-breaker').entries, []);
  });

  test('boardHTML labels the board as device-local and handles empty', () => {
    assert.match(MB.boardHTML('code-breaker'), /Your scores on this device/);
    assert.match(MB.boardHTML('code-breaker'), /No runs yet/);
    assert.match(MB.boardHTML('bullet-dodge'), /#1/);
  });
}

/* ---------------------- Daily challenge + streak ---------------------- */
{
  const MB = loadModule(makeStorage());

  test('daily challenge is deterministic for a date', () => {
    const a = MB.getDailyChallenge('2026-11-12');
    const b = MB.getDailyChallenge('2026-11-12');
    assert.deepStrictEqual(a, b);
    assert.ok(MB.games.includes(a.game));
    assert.ok(a.label.length > 0);
    assert.match(a.date, /^2026-11-12$/);
  });

  test('challenge rotates across days and games', () => {
    const games = new Set();
    for (let d = 1; d <= 28; d++) {
      games.add(MB.getDailyChallenge('2026-11-' + String(d).padStart(2, '0')).game);
    }
    assert.ok(games.size >= 3, 'expected rotation across games, got ' + games.size);
  });

  test('completing today challenge via recordRun sets streak 1', () => {
    const c = MB.getDailyChallenge();
    const value = c.kind === 'score' ? { score: c.target }
      : c.kind === 'timeMs' ? { timeMs: c.target }
      : { moves: c.target, time: 60 };
    const opts = { durationSec: 120, runId: 'chal-1' };
    if (c.game === 'memory-game') opts.difficulty = 'medium';
    const r = MB.recordRun(c.game, value, opts);
    assert.strictEqual(r.challenge.completed, true);
    assert.strictEqual(r.challenge.justCompleted, true);
    assert.strictEqual(MB.isChallengeComplete(), true);
    assert.strictEqual(MB.getStreak(), 1);
  });

  test('a run on a non-challenge game does not complete the challenge', () => {
    const MB2 = loadModule(makeStorage());
    const c = MB2.getDailyChallenge();
    const other = MB2.games.find((g) => g !== c.game);
    const value = other === 'neos-training' ? { timeMs: 200 }
      : other === 'memory-game' ? { moves: 20, time: 60 } : { score: 500 };
    const opts = { durationSec: 120, runId: 'other-1' };
    if (other === 'memory-game') opts.difficulty = 'medium';
    const r = MB2.recordRun(other, value, opts);
    assert.strictEqual(r.challenge.completed, false);
    assert.strictEqual(MB2.getStreak(), 0);
  });

  test('streak counts consecutive completed days and breaks on a gap', () => {
    const MB3 = loadModule(makeStorage());
    const hist = { version: 1, history: {
      '2026-11-10': { game: 'cyber-snake', goal: 'snake-30', completed: true, score: 40 },
      '2026-11-11': { game: 'bullet-dodge', goal: 'dodge-25', completed: true, score: 30 },
      '2026-11-12': { game: 'code-breaker', goal: 'code-50', completed: true, score: 60 },
    } };
    currentStorage.setItem('mh:challenge', JSON.stringify(hist));
    assert.strictEqual(MB3.getStreak('2026-11-12'), 3);
    // Grace: on the 13th with nothing yet today, yesterday streak shows.
    assert.strictEqual(MB3.getStreak('2026-11-13'), 3);
    // After a fully missed day the streak is broken.
    assert.strictEqual(MB3.getStreak('2026-11-14'), 0);
  });

  test('challenge history is stored under mh:challenge, version 1', () => {
    const raw = currentStorage.getItem('mh:challenge');
    assert.ok(raw);
    assert.strictEqual(JSON.parse(raw).version, 1);
  });
}

/* ------------------------------ Share card ---------------------------- */
{
  const MB = loadModule(makeStorage());
  test('share text matches the design shape with no prize language', () => {
    const t = MB.buildShareText({ slug: 'cyber-snake', scoreText: '42', isNewBest: true });
    assert.match(t, /I scored 42 on Cyber Snake — my best yet!/);
    assert.match(t, /matrix-hub\.org\/games/);
    assert.doesNotMatch(t, /prize|win money|MTX|reward/i);
    const plain = MB.buildShareText({ slug: 'cyber-snake', scoreText: '10', isNewBest: false });
    assert.doesNotMatch(plain, /best yet/);
  });
}

/* ------------------------- Broken storage ----------------------------- */
{
  const throwing = {
    getItem() { throw new Error('denied'); },
    setItem() { throw new Error('denied'); },
    removeItem() { throw new Error('denied'); },
  };
  const MB = loadModule(throwing);
  test('throwing storage: best API degrades without throwing', () => {
    assert.strictEqual(MB.getBest('cyber-snake'), null);
    assert.strictEqual(MB.saveBest('cyber-snake', { score: 10 }).isNewBest, false);
    assert.strictEqual(MB.formatBest('cyber-snake', null), '');
  });
  test('throwing storage: board + challenge degrade without throwing', () => {
    const r = MB.recordRun('cyber-snake', { score: 10 }, { durationSec: 60, runId: 'x1' });
    assert.strictEqual(r.stored, false);
    arrEq(MB.getBoard('cyber-snake').entries, []);
    assert.strictEqual(MB.getStreak(), 0);
    assert.ok(MB.getDailyChallenge().game);
  });

  const MB2 = loadModule(undefined);
  test('absent storage: everything degrades without throwing', () => {
    assert.strictEqual(MB2.getBest('cyber-snake'), null);
    assert.strictEqual(MB2.recordRun('cyber-snake', { score: 10 }, { durationSec: 60 }).stored, false);
    arrEq(MB2.getBoard('cyber-snake').entries, []);
  });
}

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
