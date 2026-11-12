/**
 * matrix-best.js — shared personal-best + competitive module for the
 * Matrix Hub free games.
 *
 * WIRED — HUB task 155 (Competitive Phase 1). This file is the canonical
 * source; an identical copy is served to the static games at
 * public/games/matrix-best.js (the games live under public/ and cannot
 * load from src/). Keep the two copies in sync.
 *
 * Design sources:
 * - bot-core/games/high-score-daily-challenge-design.md (Kenji Mori,
 *   task 93) — personal bests, the score → best → replay loop, and the
 *   daily-challenge / streak shape.
 * - bot-core/games/competitive-play-design-2026-11-10.md (Kai Mercer,
 *   task 147) Phase 1 — device-local top-10 boards (§1.2), shareable
 *   score cards (§1.5 in build order), daily challenge + streak (§2–3).
 *
 * Rules baked in:
 * - Personal bests and DEVICE-LOCAL boards only. A "board" here is your
 *   own top runs on your own device — never a global or cross-player
 *   ranking, never presented as one. No other players, no fake scores,
 *   no fake players, no fake names. No name is ever stored.
 * - localStorage only. No backend, no account, no wallet, no server call.
 * - Free means free. Scores never convert to anything — no MTX, no
 *   rewards, no prizes, no pay-to-play, no casino behaviour.
 * - Never throws. Storage can be unavailable (private mode, sandboxed
 *   iframe, quota) — every call degrades to "no best / no board" instead
 *   of breaking the game. A game must never crash because storage is
 *   unavailable.
 * - Digital Rain / Matrix Rain has no entry on purpose — it has no
 *   scoring rule yet (open item in Kai's design §1.4 / §7), so it gets
 *   no best and no board until Game Studio defines one.
 */

(function (global) {
  'use strict';

  var PREFIX = 'matrix_best_';

  /**
   * Per-game config. One entry per game that has a score.
   * - metric: 'high' (bigger is better) or 'low' (smaller is better).
   * - compare(a, b): returns true when candidate `a` beats stored best `b`.
   * - format(best): the one-line display string for the game-over screen
   *   and the hub card. Never returns a fake number — callers show nothing
   *   when there is no best.
   * - empty(): the shape of a fresh (no-best) value for the game.
   *
   * Digital Rain has no entry on purpose — it is atmosphere, not a game,
   * and has no score.
   */
  var GAMES = {
    'cyber-snake': {
      metric: 'high',
      compare: function (a, b) { return a.score > b.score; },
      format: function (best) { return 'Best: ' + best.score.toLocaleString(); },
      empty: function () { return { score: 0, date: null }; }
    },
    'bullet-dodge': {
      metric: 'high',
      compare: function (a, b) { return a.score > b.score; },
      format: function (best) { return 'Best: ' + best.score.toLocaleString(); },
      empty: function () { return { score: 0, date: null }; }
    },
    'code-breaker': {
      metric: 'high',
      compare: function (a, b) { return a.score > b.score; },
      format: function (best) { return 'Best: ' + best.score.toLocaleString(); },
      empty: function () { return { score: 0, date: null }; }
    },
    'hacking-simulator': {
      metric: 'high',
      compare: function (a, b) { return a.score > b.score; },
      format: function (best) { return 'Best: ' + best.score.toLocaleString(); },
      empty: function () { return { score: 0, date: null }; }
    },
    'neos-training': {
      metric: 'low',
      // Fastest single reaction time, in milliseconds. Lower wins.
      compare: function (a, b) { return a.timeMs < b.timeMs; },
      format: function (best) { return 'Best: ' + best.timeMs + ' ms'; },
      empty: function () { return { timeMs: null, date: null }; }
    },
    'memory-game': {
      // Per-difficulty best: fewest moves, then fastest time.
      // The value is an object keyed by difficulty.
      // compare/format take a difficulty as a second argument.
      metric: 'low',
      compare: function (a, b, difficulty) {
        var cur = b && b[difficulty];
        if (!cur) return true;
        if (a.moves !== cur.moves) return a.moves < cur.moves;
        return a.time < cur.time;
      },
      format: function (best, difficulty) {
        var cur = best && best[difficulty];
        if (!cur) return '';
        return 'Best (' + difficulty + '): ' + cur.moves + ' moves · ' + formatTime(cur.time);
      },
      empty: function () {
        return { easy: null, medium: null, hard: null };
      }
    }
  };

  function formatTime(seconds) {
    var m = Math.floor(seconds / 60);
    var s = seconds % 60;
    return m + ':' + (s < 10 ? '0' : '') + s;
  }

  function keyFor(slug) {
    return PREFIX + slug;
  }

  function isKnownGame(slug) {
    return Object.prototype.hasOwnProperty.call(GAMES, slug);
  }

  /** Read raw localStorage, never throwing. Returns null when unavailable. */
  function readRaw(slug) {
    try {
      if (typeof global.localStorage === 'undefined') return null;
      return global.localStorage.getItem(keyFor(slug));
    } catch (e) {
      return null;
    }
  }

  /** Write raw localStorage, never throwing. Returns true when stored. */
  function writeRaw(slug, value) {
    try {
      if (typeof global.localStorage === 'undefined') return false;
      global.localStorage.setItem(keyFor(slug), value);
      return true;
    } catch (e) {
      return false;
    }
  }

  /**
   * Validate a parsed stored value for a game. A stored value that does not
   * match the game's shape (corrupt data, an old version, a hand-edited key)
   * is treated as "no best" — never shown, never trusted.
   */
  function isValidBest(slug, value) {
    if (!value || typeof value !== 'object') return false;
    if (slug === 'memory-game') {
      var diffs = ['easy', 'medium', 'hard'];
      for (var i = 0; i < diffs.length; i++) {
        var d = value[diffs[i]];
        if (d !== null && d !== undefined) {
          if (typeof d.moves !== 'number' || typeof d.time !== 'number') return false;
        }
      }
      return true;
    }
    if (slug === 'neos-training') {
      return typeof value.timeMs === 'number' && value.timeMs > 0;
    }
    // Score games: {score: number, date: string|null}
    return typeof value.score === 'number' && value.score >= 0;
  }

  /**
   * getBest(slug) -> the stored best for that game, or null.
   * Returns null for unknown slugs, for games with no stored best, for
   * corrupt stored data, and when storage is unavailable.
   */
  function getBest(slug) {
    if (!isKnownGame(slug)) return null;
    var raw = readRaw(slug);
    if (raw === null) return null;
    var parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      return null;
    }
    return isValidBest(slug, parsed) ? parsed : null;
  }

  /**
   * saveBest(slug, value[, difficulty]) -> { isNewBest, best }.
   * Stores `value` only when it beats the stored best (per the game's
   * compare rule). Returns the best that is now stored, and whether this
   * call set a new best.
   *
   * - Score games: value = { score: number }. `date` is stamped here.
   * - Neo's Training: value = { timeMs: number }.
   * - Memory Game: value = { moves: number, time: number }, and `difficulty`
   *   ('easy' | 'medium' | 'hard') is required.
   *
   * Returns { isNewBest: false, best: <current best or null> } when the
   * value does not beat the stored best, when the slug is unknown, or when
   * storage is unavailable. Never throws.
   */
  function saveBest(slug, value, difficulty) {
    var empty = { isNewBest: false, best: getBest(slug) };
    if (!isKnownGame(slug)) return empty;
    if (!value || typeof value !== 'object') return empty;

    var game = GAMES[slug];

    if (slug === 'memory-game') {
      if (difficulty !== 'easy' && difficulty !== 'medium' && difficulty !== 'hard') return empty;
      if (typeof value.moves !== 'number' || typeof value.time !== 'number') return empty;
      var current = getBest(slug) || game.empty();
      if (!game.compare(value, current, difficulty)) return { isNewBest: false, best: current };
      var updated = { easy: current.easy, medium: current.medium, hard: current.hard };
      updated[difficulty] = { moves: value.moves, time: value.time, date: new Date().toISOString().slice(0, 10) };
      if (!writeRaw(slug, JSON.stringify(updated))) return { isNewBest: false, best: current };
      return { isNewBest: true, best: updated };
    }

    var candidate;
    if (slug === 'neos-training') {
      if (typeof value.timeMs !== 'number' || value.timeMs <= 0) return empty;
      candidate = { timeMs: value.timeMs, date: new Date().toISOString().slice(0, 10) };
    } else {
      if (typeof value.score !== 'number' || value.score < 0) return empty;
      candidate = { score: value.score, date: new Date().toISOString().slice(0, 10) };
    }

    var stored = getBest(slug);
    if (stored && !game.compare(candidate, stored)) return { isNewBest: false, best: stored };
    if (!writeRaw(slug, JSON.stringify(candidate))) return { isNewBest: false, best: stored };
    return { isNewBest: true, best: candidate };
  }

  /**
   * formatBest(slug, best[, difficulty]) -> the one-line display string.
   * Returns '' when there is no best — callers show nothing in that case
   * (never a fake zero, never "—").
   */
  function formatBest(slug, best, difficulty) {
    if (!isKnownGame(slug)) return '';
    if (!best) return '';
    if (!isValidBest(slug, best)) return '';
    return GAMES[slug].format(best, difficulty);
  }

  /**
   * clearBest(slug) -> true when the stored best was removed.
   * For testing and for a future "reset my bests" affordance. Not wired
   * to any UI in this prototype.
   */
  function clearBest(slug) {
    if (!isKnownGame(slug)) return false;
    try {
      if (typeof global.localStorage === 'undefined') return false;
      global.localStorage.removeItem(keyFor(slug));
      return true;
    } catch (e) {
      return false;
    }
  }

  /* =====================================================================
   * Phase 1 extensions (Kai Mercer design, task 147 — §1, §2, §3, §5):
   * device-local top-10 boards, shareable score cards, daily challenge,
   * streaks. Everything below follows the same never-throws rule.
   * ===================================================================== */

  var GAME_LABELS = {
    'cyber-snake': 'Cyber Snake',
    'bullet-dodge': 'Bullet Dodge',
    'code-breaker': 'Code Breaker',
    'hacking-simulator': 'Hacking Simulator',
    'neos-training': "Neo's Training",
    'memory-game': 'Memory Game'
  };

  /**
   * Sanity caps + plausibility limits per game (design §1.5). Set
   * generously from each game's mechanics so a real run is never
   * rejected; they exist to keep impossible values off the board.
   * QA can tune them from real playtesting data.
   * - maxValue: highest plausible ranked value (score; timeMs for Neo's
   *   Training is bounded by minTimeMs instead; moves for Memory Game).
   * - minDurationSec: a ranked run shorter than this is not stored.
   * - maxPerSec: ranked value per second ceiling for score games.
   */
  var CAPS = {
    // Score is +10 per food on a 30x30 grid: a full board is under 9,000.
    'cyber-snake': { maxValue: 5000, minDurationSec: 3, maxPerSec: 60 },
    // Score is +1 per bullet dodged; bullets spawn at most ~6/sec.
    'bullet-dodge': { maxValue: 10000, minDurationSec: 3, maxPerSec: 30 },
    // Score is +10 x level per code typed; typing bounds the rate.
    'code-breaker': { maxValue: 10000, minDurationSec: 3, maxPerSec: 100 },
    'hacking-simulator': { maxValue: 10000, minDurationSec: 3, maxPerSec: 100 },
    // Ranked value is a single reaction time in ms: faster than 80 ms
    // is not a human reaction; a run is 10 rounds, so allow time.
    'neos-training': { minTimeMs: 80, maxTimeMs: 10000, minDurationSec: 10 },
    // Ranked value is moves: it can never be below the pair count.
    'memory-game': { minMovesByDifficulty: { easy: 6, medium: 8, hard: 12 }, maxMoves: 500, minDurationSec: 5 }
  };

  /** Local calendar date (YYYY-MM-DD, player's device timezone). */
  function localDateString(d) {
    d = d || new Date();
    var m = '' + (d.getMonth() + 1);
    var day = '' + d.getDate();
    if (m.length < 2) m = '0' + m;
    if (day.length < 2) day = '0' + day;
    return d.getFullYear() + '-' + m + '-' + day;
  }

  function storageGet(key) {
    try {
      if (typeof global.localStorage === 'undefined') return null;
      return global.localStorage.getItem(key);
    } catch (e) { return null; }
  }

  function storageSet(key, value) {
    try {
      if (typeof global.localStorage === 'undefined') return false;
      global.localStorage.setItem(key, value);
      return true;
    } catch (e) { return false; }
  }

  function storageRemove(key) {
    try {
      if (typeof global.localStorage === 'undefined') return false;
      global.localStorage.removeItem(key);
      return true;
    } catch (e) { return false; }
  }

  /* ---------------------------- Local boards ---------------------------- */
  // Design §1.2: one key per game, "mh:lb:<slug>", top 10, version 1,
  // entries {score, date, durationSec, challengeId}. For Neo's Training
  // the entry `score` holds the best single reaction timeMs (lower is
  // better); for Memory Game it holds moves (lower is better) and the
  // entry also carries `timeSec` + `difficulty` for tie-breaking.

  function boardKeyFor(slug) { return 'mh:lb:' + slug; }

  function emptyBoard(slug) {
    return { game: slug, version: 1, updatedAt: null, entries: [], lastRunId: null };
  }

  function isValidBoardEntry(slug, e) {
    if (!e || typeof e !== 'object') return false;
    if (typeof e.score !== 'number' || !isFinite(e.score)) return false;
    if (typeof e.date !== 'string') return false;
    return true;
  }

  /** getBoard(slug) -> {game, version, updatedAt, entries[]} (never null). */
  function getBoard(slug) {
    if (!isKnownGame(slug)) return emptyBoard(slug);
    var raw = storageGet(boardKeyFor(slug));
    if (raw === null) return emptyBoard(slug);
    var parsed;
    try { parsed = JSON.parse(raw); } catch (e) { return emptyBoard(slug); }
    if (!parsed || typeof parsed !== 'object' || parsed.version !== 1 || !Array.isArray(parsed.entries)) {
      return emptyBoard(slug);
    }
    var board = emptyBoard(slug);
    board.updatedAt = typeof parsed.updatedAt === 'string' ? parsed.updatedAt : null;
    board.lastRunId = typeof parsed.lastRunId === 'string' ? parsed.lastRunId : null;
    board.entries = parsed.entries.filter(function (e) { return isValidBoardEntry(slug, e); }).slice(0, 10);
    return board;
  }

  /** True when entry `a` ranks strictly ahead of entry `b` for the game. */
  function entryBeats(slug, a, b) {
    if (slug === 'neos-training' || slug === 'memory-game') {
      if (a.score !== b.score) return a.score < b.score;
      if (slug === 'memory-game') return (a.timeSec || 0) < (b.timeSec || 0);
      return false; // tie: earlier entry stays first
    }
    return a.score > b.score;
  }

  /**
   * Plausibility check (design §1.5). Returns '' when the run may be
   * stored, or a short reason string when it must not be. The game-over
   * screen still shows the player their score either way.
   */
  function plausibility(slug, value, durationSec) {
    var caps = CAPS[slug];
    if (!caps) return 'no-caps';
    if (typeof durationSec === 'number' && durationSec < caps.minDurationSec) return 'too-short';
    if (slug === 'neos-training') {
      if (value.timeMs < caps.minTimeMs || value.timeMs > caps.maxTimeMs) return 'implausible-time';
      return '';
    }
    if (slug === 'memory-game') {
      var minMoves = caps.minMovesByDifficulty[value.difficulty] || 0;
      if (value.moves < minMoves || value.moves > caps.maxMoves) return 'implausible-moves';
      return '';
    }
    if (value.score > caps.maxValue) return 'over-cap';
    if (typeof durationSec === 'number' && durationSec > 0 && value.score / durationSec > caps.maxPerSec) {
      return 'implausible-rate';
    }
    return '';
  }

  var seenRunIds = {};

  /**
   * recordRun(slug, value[, opts]) — the single write path for a board
   * (design §1.2: insert once, at game over, guarded by a run ID).
   * - Score games: value = {score}
   * - Neo's Training: value = {timeMs} (best single reaction of the run)
   * - Memory Game: value = {moves, time} + opts.difficulty
   * opts: {durationSec, runId, challengeId}
   * Returns {stored, reason, rank (1-based or null), isNewBest, board,
   *          challenge: {completed, challenge, streak}}.
   * Also evaluates today's daily challenge for this game (§2.2:
   * completion is detected at game over). Never throws.
   */
  function recordRun(slug, value, opts) {
    opts = opts || {};
    var result = {
      stored: false, reason: '', rank: null, isNewBest: false,
      board: getBoard(slug),
      challenge: { completed: false, challenge: null, streak: 0 }
    };
    if (!isKnownGame(slug)) { result.reason = 'unknown-game'; return result; }
    if (!value || typeof value !== 'object') { result.reason = 'bad-value'; return result; }

    // Normalise the ranked value + validate the run's own shape.
    var ranked;
    if (slug === 'neos-training') {
      if (typeof value.timeMs !== 'number' || value.timeMs <= 0) { result.reason = 'bad-value'; return result; }
      ranked = value.timeMs;
    } else if (slug === 'memory-game') {
      if (opts.difficulty !== 'easy' && opts.difficulty !== 'medium' && opts.difficulty !== 'hard') {
        result.reason = 'bad-difficulty'; return result;
      }
      if (typeof value.moves !== 'number' || typeof value.time !== 'number') { result.reason = 'bad-value'; return result; }
      ranked = value.moves;
    } else {
      if (typeof value.score !== 'number' || value.score < 0) { result.reason = 'bad-value'; return result; }
      ranked = value.score;
    }

    // Daily-challenge evaluation happens for every completed run, even
    // one the board refuses — finishing the goal is what counts (§2.2).
    result.challenge = evaluateChallenge(slug, value, ranked);

    // One entry per run: a repeated runId can never double-insert (§1.5).
    var runId = typeof opts.runId === 'string' && opts.runId ? opts.runId : null;
    if (runId) {
      if (seenRunIds[runId] || result.board.lastRunId === runId) { result.reason = 'duplicate-run'; return result; }
    }

    var reason = plausibility(slug, slug === 'memory-game'
      ? { moves: value.moves, difficulty: opts.difficulty }
      : (slug === 'neos-training' ? { timeMs: value.timeMs } : { score: value.score }),
      typeof opts.durationSec === 'number' ? opts.durationSec : null);
    if (reason) { result.reason = reason; return result; }

    var entry = {
      score: ranked,
      date: localDateString(),
      durationSec: typeof opts.durationSec === 'number' ? Math.round(opts.durationSec) : null,
      challengeId: typeof opts.challengeId === 'string' ? opts.challengeId : null
    };
    if (slug === 'memory-game') { entry.timeSec = value.time; entry.difficulty = opts.difficulty; }

    var entries = result.board.entries.slice();
    var idx = entries.length;
    for (var i = 0; i < entries.length; i++) {
      if (entryBeats(slug, entry, entries[i])) { idx = i; break; }
    }
    if (idx >= 10) { result.reason = 'below-top-10'; return result; }
    entries.splice(idx, 0, entry);
    entries = entries.slice(0, 10);

    var board = {
      game: slug, version: 1, updatedAt: new Date().toISOString(),
      entries: entries, lastRunId: runId
    };
    if (!storageSet(boardKeyFor(slug), JSON.stringify(board))) { result.reason = 'storage-unavailable'; return result; }
    if (runId) seenRunIds[runId] = true;

    result.stored = true;
    result.rank = idx + 1;
    result.isNewBest = idx === 0;
    result.board = board;
    return result;
  }

  /** clearBoard(slug) — wipes the whole board for that game (§1.2). */
  function clearBoard(slug) {
    if (!isKnownGame(slug)) return false;
    return storageRemove(boardKeyFor(slug));
  }

  /** Display string for one board entry's ranked value. */
  function formatEntryScore(slug, entry) {
    if (!entry) return '';
    if (slug === 'neos-training') return entry.score + ' ms';
    if (slug === 'memory-game') {
      return entry.score + ' moves · ' + formatTime(entry.timeSec || 0);
    }
    return entry.score.toLocaleString();
  }

  /* --------------------- Daily challenge + streak --------------------- */
  // Design §2: one challenge per day, one game per day, derived
  // deterministically from the local calendar date — same day, same
  // challenge, everywhere, offline. §3: the streak is derived from
  // consecutive completed dates in the challenge history, never stored
  // as a separate counter.

  var CHALLENGE_POOL = {
    'cyber-snake': [
      { id: 'snake-30', kind: 'score', target: 30, label: 'Score 30 in one run' },
      { id: 'snake-50', kind: 'score', target: 50, label: 'Score 50 in one run' },
      { id: 'snake-80', kind: 'score', target: 80, label: 'Score 80 in one run' }
    ],
    'bullet-dodge': [
      { id: 'dodge-25', kind: 'score', target: 25, label: 'Score 25 in one run' },
      { id: 'dodge-50', kind: 'score', target: 50, label: 'Score 50 in one run' },
      { id: 'dodge-100', kind: 'score', target: 100, label: 'Score 100 in one run' }
    ],
    'code-breaker': [
      { id: 'code-50', kind: 'score', target: 50, label: 'Score 50 in one run' },
      { id: 'code-100', kind: 'score', target: 100, label: 'Score 100 in one run' },
      { id: 'code-200', kind: 'score', target: 200, label: 'Score 200 in one run' }
    ],
    'hacking-simulator': [
      { id: 'hack-30', kind: 'score', target: 30, label: 'Score 30 in one run' },
      { id: 'hack-50', kind: 'score', target: 50, label: 'Score 50 in one run' },
      { id: 'hack-100', kind: 'score', target: 100, label: 'Score 100 in one run' }
    ],
    'neos-training': [
      { id: 'neo-400', kind: 'timeMs', target: 400, label: 'React in under 400 ms' },
      { id: 'neo-350', kind: 'timeMs', target: 350, label: 'React in under 350 ms' },
      { id: 'neo-300', kind: 'timeMs', target: 300, label: 'React in under 300 ms' }
    ],
    'memory-game': [
      { id: 'mem-40', kind: 'moves', target: 40, label: 'Finish a game in 40 moves or fewer' },
      { id: 'mem-32', kind: 'moves', target: 32, label: 'Finish a game in 32 moves or fewer' },
      { id: 'mem-26', kind: 'moves', target: 26, label: 'Finish a game in 26 moves or fewer' }
    ]
  };

  var CHALLENGE_GAMES = Object.keys(CHALLENGE_POOL);

  function hashString(str) {
    var h = 5381;
    for (var i = 0; i < str.length; i++) {
      h = ((h << 5) + h + str.charCodeAt(i)) >>> 0;
    }
    return h;
  }

  /**
   * getDailyChallenge([dateStr]) -> {date, game, gameLabel, goalId,
   * kind, target, label} for that local date (default: today).
   * Deterministic: the same date always yields the same challenge.
   */
  function getDailyChallenge(dateStr) {
    var date = typeof dateStr === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)
      ? dateStr : localDateString();
    var h = hashString('mh-challenge:' + date);
    var game = CHALLENGE_GAMES[h % CHALLENGE_GAMES.length];
    var pool = CHALLENGE_POOL[game];
    var goal = pool[Math.floor(h / CHALLENGE_GAMES.length) % pool.length];
    return {
      date: date, game: game, gameLabel: GAME_LABELS[game],
      goalId: goal.id, kind: goal.kind, target: goal.target, label: goal.label
    };
  }

  var CHALLENGE_KEY = 'mh:challenge';

  function readChallengeHistory() {
    var raw = storageGet(CHALLENGE_KEY);
    if (raw === null) return { version: 1, history: {} };
    var parsed;
    try { parsed = JSON.parse(raw); } catch (e) { return { version: 1, history: {} }; }
    if (!parsed || typeof parsed !== 'object' || parsed.version !== 1 ||
        !parsed.history || typeof parsed.history !== 'object') {
      return { version: 1, history: {} };
    }
    return parsed;
  }

  function writeChallengeHistory(record) {
    // Prune to the last 60 days (design §2.3).
    var dates = Object.keys(record.history).sort();
    while (dates.length > 60) {
      var oldest = dates.shift();
      delete record.history[oldest];
    }
    return storageSet(CHALLENGE_KEY, JSON.stringify(record));
  }

  function goalMet(challenge, value) {
    if (!value || typeof value !== 'object') return false;
    if (challenge.kind === 'score') return typeof value.score === 'number' && value.score >= challenge.target;
    if (challenge.kind === 'timeMs') return typeof value.timeMs === 'number' && value.timeMs > 0 && value.timeMs <= challenge.target;
    if (challenge.kind === 'moves') return typeof value.moves === 'number' && value.moves <= challenge.target;
    return false;
  }

  /**
   * evaluateChallenge(slug, value, ranked) — if today's challenge names
   * this game and the run met the goal, mark it complete for today.
   * Returns {completed (overall for today), justCompleted, challenge,
   * streak}. Never throws.
   */
  function evaluateChallenge(slug, value, ranked) {
    var challenge = getDailyChallenge();
    var out = { completed: false, justCompleted: false, challenge: challenge, streak: 0 };
    try {
      var record = readChallengeHistory();
      var existing = record.history[challenge.date];
      if (existing && existing.completed) {
        out.completed = true;
        out.streak = getStreak();
        return out;
      }
      if (challenge.game === slug && goalMet(challenge, value)) {
        record.history[challenge.date] = {
          game: slug, goal: challenge.goalId, completed: true, score: ranked
        };
        writeChallengeHistory(record);
        out.completed = true;
        out.justCompleted = true;
      } else if (!existing) {
        record.history[challenge.date] = {
          game: challenge.game, goal: challenge.goalId, completed: false
        };
        writeChallengeHistory(record);
      }
      out.streak = getStreak();
      return out;
    } catch (e) {
      return out;
    }
  }

  /** True when today's challenge is already marked complete. */
  function isChallengeComplete(dateStr) {
    var date = typeof dateStr === 'string' ? dateStr : localDateString();
    var record = readChallengeHistory();
    var entry = record.history[date];
    return !!(entry && entry.completed);
  }

  function shiftDate(dateStr, deltaDays) {
    var parts = dateStr.split('-');
    var d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    d.setDate(d.getDate() + deltaDays);
    return localDateString(d);
  }

  /**
   * getStreak([todayStr]) -> current streak in days (design §3).
   * Derived from the challenge history: count back from today — or
   * from yesterday when today is not completed yet (the grace rule,
   * §3.2: yesterday's streak still shows as alive until midnight).
   */
  function getStreak(todayStr) {
    var today = typeof todayStr === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(todayStr)
      ? todayStr : localDateString();
    var record = readChallengeHistory();
    var cursor = today;
    if (!(record.history[cursor] && record.history[cursor].completed)) {
      cursor = shiftDate(today, -1);
    }
    var count = 0;
    while (record.history[cursor] && record.history[cursor].completed) {
      count++;
      cursor = shiftDate(cursor, -1);
    }
    return count;
  }

  /* ------------------------- Shareable score card ------------------------- */
  // Design Phase 1 item 3: text-first card, e.g.
  // "I scored 42 on Snake — my best yet! 🎮 matrix-hub.org".

  function buildShareText(opts) {
    opts = opts || {};
    var label = opts.gameLabel || GAME_LABELS[opts.slug] || 'a Matrix Hub game';
    var text = (opts.verb ? opts.verb + ' ' : 'I scored ') + opts.scoreText + ' on ' + label;
    if (opts.isNewBest) text += ' — my best yet!';
    text += ' 🎮 Play free at matrix-hub.org/games';
    if (opts.challengeCompleted) text += ' · Daily challenge complete ✓';
    if (opts.streak && opts.streak > 1) text += ' · 🔥 ' + opts.streak + '-day streak';
    return text;
  }

  /**
   * shareScore(opts) — native share on mobile, clipboard fallback.
   * Returns a Promise<boolean> for whether a share/copy happened.
   * Never throws, never rejects.
   */
  function shareScore(opts) {
    var text = buildShareText(opts);
    try {
      if (typeof global.navigator !== 'undefined' && global.navigator.share) {
        return global.navigator.share({ text: text }).then(function () { return true; }, function () { return false; });
      }
      if (typeof global.navigator !== 'undefined' && global.navigator.clipboard &&
          global.navigator.clipboard.writeText) {
        return global.navigator.clipboard.writeText(text).then(function () { return true; }, function () { return false; });
      }
    } catch (e) { /* fall through */ }
    return Promise.resolve(false);
  }

  /* --------------------------- DOM helpers --------------------------- */
  // Optional rendering helpers so every game shows the board, the
  // challenge and the streak the same way. All guarded: no document,
  // no-op. All text is built with textContent-safe escaping below.

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function formatDateShort(dateStr) {
    var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    var parts = String(dateStr).split('-');
    if (parts.length !== 3) return String(dateStr);
    var m = months[Number(parts[1]) - 1];
    if (!m) return String(dateStr);
    return m + ' ' + Number(parts[2]);
  }

  /** HTML for a local board (labelled honestly, design §1.3). */
  function boardHTML(slug, limit) {
    var board = getBoard(slug);
    var n = typeof limit === 'number' ? limit : 5;
    var html = '<p class="mh-board-label">Your scores on this device</p>';
    if (!board.entries.length) {
      html += '<p class="mh-board-empty">No runs yet — play your first game</p>';
      return html;
    }
    html += '<ol class="mh-board-list">';
    board.entries.slice(0, n).forEach(function (e, i) {
      html += '<li><span class="mh-rank">#' + (i + 1) + '</span> ' +
        '<span class="mh-score">' + escapeHtml(formatEntryScore(slug, e)) + '</span> ' +
        '<span class="mh-date">' + escapeHtml(formatDateShort(e.date)) + '</span></li>';
    });
    html += '</ol>';
    return html;
  }

  function renderBoardInto(el, slug, limit) {
    if (!el || typeof document === 'undefined') return;
    try { el.innerHTML = boardHTML(slug, limit); } catch (e) { /* never break a game */ }
  }

  /**
   * Fill an element with today's challenge line. When `slug` is given
   * and today's game is a different one, the element is left empty —
   * the challenge belongs on the hub and the challenged game's page.
   */
  function renderChallengeInto(el, slug) {
    if (!el || typeof document === 'undefined') return;
    try {
      var c = getDailyChallenge();
      if (slug && c.game !== slug) { el.innerHTML = ''; return; }
      var done = isChallengeComplete(c.date);
      el.innerHTML = '<span class="mh-challenge-label">Today\'s challenge</span> ' +
        '<span class="mh-challenge-text">' + escapeHtml(c.gameLabel + ' — ' + c.label) + '</span>' +
        (done ? ' <span class="mh-challenge-done">✓ Complete</span>' : '');
    } catch (e) { /* never break a game */ }
  }

  function streakText() {
    var s = getStreak();
    if (s <= 0) return '';
    var todayDone = isChallengeComplete();
    return '🔥 ' + s + '-day streak' + (todayDone ? '' : ' — keep it going today!');
  }

  function renderStreakInto(el) {
    if (!el || typeof document === 'undefined') return;
    try { el.textContent = streakText(); } catch (e) { /* never break a game */ }
  }

  /**
   * finishRun(slug, value, opts) — the one-call end-of-run path every
   * wired game uses. Records the run on the local board, saves the
   * personal best, evaluates the daily challenge, and fills the shared
   * end-screen elements when they exist on the page:
   *   #mh-newbest (hidden unless a new best), #mh-best-line,
   *   #mh-rank-line, #mh-challenge-result, #mh-board (top 5),
   *   #mh-streak, and #mh-share (click → share card).
   * opts: {durationSec, runId, difficulty, scoreText, verb}
   * Returns {run, best} — the recordRun and saveBest results.
   * Never throws; with no document it still records the run.
   */
  function finishRun(slug, value, opts) {
    opts = opts || {};
    var run = recordRun(slug, value, opts);
    var best = saveBest(slug, value, opts.difficulty);
    if (typeof document !== 'undefined') {
      try {
        var newBestEl = document.getElementById('mh-newbest');
        if (newBestEl) newBestEl.hidden = !best.isNewBest;
        var bestLine = document.getElementById('mh-best-line');
        if (bestLine) bestLine.textContent = best.best ? formatBest(slug, best.best, opts.difficulty) : '';
        var rankLine = document.getElementById('mh-rank-line');
        if (rankLine) {
          rankLine.textContent = run.stored
            ? ('#' + run.rank + ' on this device' + (run.rank === 1 ? ' — new best!' : ''))
            : '';
        }
        var chalLine = document.getElementById('mh-challenge-result');
        if (chalLine) {
          chalLine.textContent = run.challenge.justCompleted
            ? ('Daily challenge complete ✓' + (run.challenge.streak > 0
              ? ' · 🔥 ' + run.challenge.streak + '-day streak' : ''))
            : '';
        }
        renderBoardInto(document.getElementById('mh-board'), slug, 5);
        renderStreakInto(document.getElementById('mh-streak'));
        var shareBtn = document.getElementById('mh-share');
        if (shareBtn) {
          shareBtn.onclick = function () {
            shareScore({
              slug: slug, scoreText: opts.scoreText, verb: opts.verb,
              isNewBest: best.isNewBest,
              challengeCompleted: run.challenge.completed,
              streak: run.challenge.streak
            });
          };
        }
      } catch (e) { /* the run is recorded; the page must not break */ }
    }
    return { run: run, best: best };
  }

  var MatrixBest = {
    getBest: getBest,
    saveBest: saveBest,
    formatBest: formatBest,
    clearBest: clearBest,
    // Phase 1 competitive layer (device-local only).
    getBoard: getBoard,
    recordRun: recordRun,
    clearBoard: clearBoard,
    boardKeyFor: boardKeyFor,
    formatEntryScore: formatEntryScore,
    getDailyChallenge: getDailyChallenge,
    isChallengeComplete: isChallengeComplete,
    getStreak: getStreak,
    buildShareText: buildShareText,
    shareScore: shareScore,
    boardHTML: boardHTML,
    finishRun: finishRun,
    renderBoardInto: renderBoardInto,
    renderChallengeInto: renderChallengeInto,
    renderStreakInto: renderStreakInto,
    gameLabel: function (slug) { return GAME_LABELS[slug] || slug; },
    localDateString: localDateString,
    // The list of games that have a best, and the exact storage key
    // for a slug.
    games: Object.keys(GAMES),
    keyFor: keyFor
  };

  // UMD-style export: works as a plain <script> (window.MatrixBest) and
  // under Node (module.exports) so the prototype can be tested headlessly.
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = MatrixBest;
  }
  global.MatrixBest = MatrixBest;
})(typeof window !== 'undefined' ? window : globalThis);
