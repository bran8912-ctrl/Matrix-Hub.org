// Cyber Snake — Season 2 build on the MatrixEngine shell (KAPLAY).
// Faithful port of the hand-rolled original: 30x30 grid, 100 ms steps,
// +10 per food, cyan head / green body, magenta food, arrows/WASD +
// swipe + D-pad, Enter or PLAY AGAIN to restart, and the identical DOM
// + MatrixBest contract (bests, board, daily challenge, streaks) via
// the shell bridge. The original's responsive-canvas resizing is
// replaced by the shell's letterbox scaling to the same 600px field.
(function () {
  const GRID = 30;          // cells per side (unchanged)
  const CELL = 20;          // px per cell   (unchanged)
  const SIZE = GRID * CELL; // 600 logical px
  const STEP = 0.1;         // seconds per move — the original 100 ms tick

  const canvas = document.getElementById('gameCanvas');
  const scoreEl = document.getElementById('score');
  const highScoreEl = document.getElementById('highScore');
  const gameOverScreen = document.getElementById('gameOver');
  const finalScoreEl = document.getElementById('finalScore');
  const restartBtn = document.getElementById('restartBtn');

  const engine = window.MatrixEngine && window.MatrixEngine.boot({
    slug: 'cyber-snake',
    canvas,
    width: SIZE,
    height: SIZE,
    background: [0, 0, 0]
  });
  if (!engine) return; // shell already painted a fallback message
  const k = engine.k;

  let snake = [], food = { x: 10, y: 10 };
  let direction = { x: 1, y: 0 }, nextDirection = { x: 1, y: 0 };
  let score = 0, highScore = 0, gameActive = false, stepAcc = 0;

  // Competitive Phase 1 (HUB 155), same as the original: the stored
  // MatrixBest best wins; the legacy 'cyberSnakeHighScore' key is
  // migrated once into the shared store when no best exists yet.
  let legacyHigh = 0;
  try { legacyHigh = parseInt(localStorage.getItem('cyberSnakeHighScore'), 10) || 0; } catch { /* ignore */ }
  if (engine.best) {
    const stored = engine.best.getBest('cyber-snake');
    if (stored) {
      highScore = stored.score || 0;
    } else if (legacyHigh > 0) {
      engine.best.saveBest('cyber-snake', { score: legacyHigh });
      highScore = legacyHigh;
    }
  } else {
    highScore = legacyHigh;
  }
  highScoreEl.textContent = highScore;

  function spawnFood() {
    while (true) {
      const f = {
        x: Math.floor(Math.random() * GRID),
        y: Math.floor(Math.random() * GRID)
      };
      if (!snake.some(s => s.x === f.x && s.y === f.y)) { food = f; return; }
    }
  }

  function startGame() {
    snake = [
      { x: 10, y: 15 },
      { x: 9, y: 15 },
      { x: 8, y: 15 }
    ];
    direction = { x: 1, y: 0 };
    nextDirection = { x: 1, y: 0 };
    score = 0;
    stepAcc = 0;
    scoreEl.textContent = '0';
    gameActive = true;
    spawnFood();
    gameOverScreen.classList.add('hidden');
    engine.setPaused(false);
    engine.newRun();
  }

  function endGame() {
    gameActive = false;
    engine.sound.die();
    finalScoreEl.textContent = score;
    gameOverScreen.classList.remove('hidden');
    // Competitive layer: personal best, board, daily challenge, streaks.
    const out = engine.finishRun({ score }, { scoreText: String(score) });
    if (out && out.best && out.best.best) {
      highScore = out.best.best.score;
      highScoreEl.textContent = highScore;
    }
  }

  function step() {
    direction = { ...nextDirection };
    const head = { x: snake[0].x + direction.x, y: snake[0].y + direction.y };

    if (head.x < 0 || head.x >= GRID || head.y < 0 || head.y >= GRID ||
        snake.some(s => s.x === head.x && s.y === head.y)) {
      endGame();
      return;
    }

    snake.unshift(head);

    if (head.x === food.x && head.y === food.y) {
      score += 10;
      scoreEl.textContent = score;
      engine.sound.eat();
      spawnFood();
      if (score > highScore) {
        highScore = score;
        highScoreEl.textContent = highScore;
      }
    } else {
      snake.pop();
    }
  }

  /* ------------------------------ render ------------------------------ */
  const GRID_LINE = k.rgb(0, 255, 0);
  const HEAD = k.rgb(0, 255, 255);
  const BODY = k.rgb(0, 255, 0);
  const FOOD = k.rgb(255, 0, 255);

  k.onDraw(() => {
    k.drawRect({ pos: k.vec2(0, 0), width: SIZE, height: SIZE, color: k.rgb(0, 0, 0) });

    // Grid lines (original strokeStyle rgba(0,255,0,0.1))
    for (let i = 0; i <= GRID; i++) {
      k.drawLine({ p1: k.vec2(i * CELL, 0), p2: k.vec2(i * CELL, SIZE), width: 1, color: GRID_LINE, opacity: 0.1 });
      k.drawLine({ p1: k.vec2(0, i * CELL), p2: k.vec2(SIZE, i * CELL), width: 1, color: GRID_LINE, opacity: 0.1 });
    }

    // Food: magenta disc with a soft glow halo (original used shadowBlur).
    k.drawCircle({ pos: k.vec2(food.x * CELL + CELL / 2, food.y * CELL + CELL / 2), radius: CELL / 2 + 3, color: FOOD, opacity: 0.25 });
    k.drawCircle({ pos: k.vec2(food.x * CELL + CELL / 2, food.y * CELL + CELL / 2), radius: CELL / 2 - 2, color: FOOD });

    // Snake: inset squares, cyan head, green body, glow halo beneath.
    snake.forEach((seg, i) => {
      const color = i === 0 ? HEAD : BODY;
      k.drawRect({ pos: k.vec2(seg.x * CELL - 1, seg.y * CELL - 1), width: CELL + 2, height: CELL + 2, color, opacity: 0.22 });
      k.drawRect({ pos: k.vec2(seg.x * CELL + 1, seg.y * CELL + 1), width: CELL - 2, height: CELL - 2, color });
    });
  });

  k.onUpdate(() => {
    if (!gameActive || engine.isPaused()) return;
    stepAcc += k.dt();
    while (stepAcc >= STEP && gameActive) {
      stepAcc -= STEP;
      step();
    }
  });

  /* ------------------------------- input ------------------------------ */
  const DIRS = {
    up: { x: 0, y: -1 }, down: { x: 0, y: 1 },
    left: { x: -1, y: 0 }, right: { x: 1, y: 0 }
  };
  function changeDirection(name) {
    const d = DIRS[name];
    if (!d) return;
    // Prevent 180-degree turns (same rule as the original).
    if (d.x !== -direction.x && d.y !== -direction.y) nextDirection = d;
  }

  const KEYMAP = {
    ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
    w: 'up', s: 'down', a: 'left', d: 'right',
    W: 'up', S: 'down', A: 'left', D: 'right'
  };
  window.addEventListener('keydown', (e) => {
    if (!gameActive) {
      // Original: after game over, only Enter restarts.
      if (e.key === 'Enter') startGame();
      return;
    }
    const name = KEYMAP[e.key];
    if (name) {
      e.preventDefault();
      changeDirection(name);
    }
  });

  engine.onSwipe(changeDirection);
  engine.bindPad(changeDirection);
  restartBtn.addEventListener('click', startGame);

  // Keep the page from scrolling under touch play (as the original did).
  document.body.addEventListener('touchmove', (e) => { e.preventDefault(); }, { passive: false });

  // Competitive banners (daily challenge + streak) — same as every game.
  engine.renderMeta();

  // Start immediately — no name prompt (personal bests only, HUB 155).
  startGame();

  // Test/automation handle: lets the crew play-verify headlessly.
  window.MatrixGame = {
    slug: 'cyber-snake',
    engine: 'kaplay',
    getState: () => ({
      gameActive,
      score,
      head: snake.length ? { ...snake[0] } : null,
      length: snake.length,
      paused: engine.isPaused()
    }),
    start: startGame,
    setPaused: (v) => engine.setPaused(v)
  };
})();
