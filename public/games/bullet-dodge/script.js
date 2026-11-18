// Bullet Time (bullet-dodge) — Season 2 build on the MatrixEngine
// shell (KAPLAY). Faithful port of the hand-rolled original: same
// tuning (player 5px/frame, bullet speed 2 + level*0.3, spawn every
// max(30 - level*2, 10) frames, +1 per dodged bullet, 3 lives, level
// rule preserved as-is), same visuals (player + bullet trails,
// crosshair, explosion particles), same DOM + MatrixBest contract.
// Speeds are expressed per-second (x60) so play is identical at 60Hz
// and stays consistent on high-refresh displays; the original's
// responsive-canvas resizing is replaced by shell letterbox scaling.
(function () {
  const SIZE = 600; // logical field (original canvas was 600 at desktop)

  const canvas = document.getElementById('game-canvas');
  const startBtn = document.getElementById('start-btn');
  const restartBtn = document.getElementById('restart-btn');
  const startScreen = document.getElementById('start-screen');
  const gameOverScreen = document.getElementById('game-over');
  const scoreEl = document.getElementById('score');
  const levelEl = document.getElementById('level');
  const livesEl = document.getElementById('lives');
  const finalScoreEl = document.getElementById('final-score');
  const finalLevelEl = document.getElementById('final-level');
  const bestEl = document.getElementById('best');

  const engine = window.MatrixEngine && window.MatrixEngine.boot({
    slug: 'bullet-dodge',
    canvas,
    width: SIZE,
    height: SIZE,
    background: [0, 0, 0]
  });
  if (!engine) return;
  const k = engine.k;

  let gameRunning = false;
  let score = 0, level = 1, lives = 3;
  let bullets = [], particles = [];
  let tick = 0;          // frame counter (drives spawn + level rule)
  let spawnTimer = 999;  // seconds to next spawn; large = spawn at once
  const player = { x: SIZE / 2, y: SIZE / 2, size: 15, speed: 300, trail: [] };

  // Competitive Phase 1 (HUB 155), same as the original.
  if (engine.best) {
    const stored = engine.best.getBest('bullet-dodge');
    if (bestEl) {
      bestEl.textContent = stored
        ? engine.best.formatBest('bullet-dodge', stored).replace('Best: ', '')
        : '';
    }
  }

  // Keyboard state — tracked directly, exactly as the original did
  // (KAPLAY's key polling proved unreliable for held arrow keys).
  const keys = {};
  document.addEventListener('keydown', (e) => { keys[e.key.toLowerCase()] = true; });
  document.addEventListener('keyup', (e) => { keys[e.key.toLowerCase()] = false; });

  function updateLivesDisplay() {
    livesEl.textContent = '❤'.repeat(lives) + '🖤'.repeat(Math.max(0, 3 - lives));
  }

  function spawnBullet() {
    const edge = Math.floor(Math.random() * 4);
    let x, y;
    if (edge === 0) { x = Math.random() * SIZE; y = -10; }
    else if (edge === 1) { x = SIZE + 10; y = Math.random() * SIZE; }
    else if (edge === 2) { x = Math.random() * SIZE; y = SIZE + 10; }
    else { x = -10; y = Math.random() * SIZE; }
    const angle = Math.atan2(player.y - y, player.x - x) + (Math.random() - 0.5) * 0.5;
    bullets.push({
      x, y, size: 5, angle,
      speed: (2 + level * 0.3) * 60, // original per-frame speed at 60fps
      trail: []
    });
  }

  function createExplosion(x, y) {
    for (let i = 0; i < 20; i++) {
      particles.push({
        x, y,
        size: Math.random() * 3 + 1,
        vx: (Math.random() - 0.5) * 360,
        vy: (Math.random() - 0.5) * 360,
        life: 1,
        decay: Math.random() * 0.02 + 0.01 // per frame at 60fps; scaled by dt below
      });
    }
  }

  function startGame() {
    engine.newRun();
    gameRunning = true;
    score = 0;
    level = 1;
    lives = 3;
    bullets = [];
    particles = [];
    tick = 0;
    spawnTimer = 999;
    player.x = SIZE / 2;
    player.y = SIZE / 2;
    player.trail = [];
    scoreEl.textContent = '0';
    levelEl.textContent = '1';
    updateLivesDisplay();
    startScreen.classList.add('hidden');
    gameOverScreen.classList.add('hidden');
    engine.setPaused(false);
  }

  function endGame() {
    gameRunning = false;
    engine.sound.die();
    finalScoreEl.textContent = score;
    finalLevelEl.textContent = level;
    gameOverScreen.classList.remove('hidden');
    // Competitive Phase 1: record the run (best, board, daily challenge).
    const out = engine.finishRun({ score }, { scoreText: String(score) });
    if (bestEl && out && out.best && out.best.best && engine.best) {
      bestEl.textContent = engine.best.formatBest('bullet-dodge', out.best.best).replace('Best: ', '');
    }
  }

  /* ------------------------------ update ------------------------------ */
  k.onUpdate(() => {
    if (!gameRunning || engine.isPaused()) return;
    const dt = Math.min(k.dt(), 0.05);
    tick++;

    // Player movement (keyboard state + touch drag direction).
    if (keys['arrowleft'] || keys['a'] || touchDir.left) player.x -= player.speed * dt;
    if (keys['arrowright'] || keys['d'] || touchDir.right) player.x += player.speed * dt;
    if (keys['arrowup'] || keys['w'] || touchDir.up) player.y -= player.speed * dt;
    if (keys['arrowdown'] || keys['s'] || touchDir.down) player.y += player.speed * dt;
    player.x = Math.max(player.size, Math.min(SIZE - player.size, player.x));
    player.y = Math.max(player.size, Math.min(SIZE - player.size, player.y));
    player.trail.push({ x: player.x, y: player.y });
    if (player.trail.length > 15) player.trail.shift();

    // Spawning (original: every max(30 - level*2, 10) frames).
    spawnTimer += dt;
    const interval = Math.max(30 - level * 2, 10) / 60;
    if (spawnTimer >= interval) {
      spawnTimer = 0;
      spawnBullet();
    }

    // Bullets
    for (let i = bullets.length - 1; i >= 0; i--) {
      const b = bullets[i];
      b.trail.push({ x: b.x, y: b.y });
      if (b.trail.length > 10) b.trail.shift();
      b.x += Math.cos(b.angle) * b.speed * dt;
      b.y += Math.sin(b.angle) * b.speed * dt;

      if (b.x < -20 || b.x > SIZE + 20 || b.y < -20 || b.y > SIZE + 20) {
        bullets.splice(i, 1);
        score += 1;
      } else {
        const dx = b.x - player.x, dy = b.y - player.y;
        if (Math.sqrt(dx * dx + dy * dy) < b.size + player.size) {
          bullets.splice(i, 1);
          lives--;
          engine.sound.hit();
          createExplosion(player.x, player.y);
          updateLivesDisplay();
          if (lives <= 0) { endGame(); return; }
        }
      }
    }

    // Particles
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      const damp = Math.pow(0.98, dt * 60);
      p.vx *= damp; p.vy *= damp;
      p.life -= p.decay * dt * 60;
      if (p.life <= 0) particles.splice(i, 1);
    }

    // Level up — the original's exact rule (fires while score sits on a
    // multiple of 100, checked every 5th frame).
    if (score > 0 && score % 100 === 0 && tick % 5 === 0) {
      level++;
      levelEl.textContent = level;
      engine.sound.level();
    }

    scoreEl.textContent = score;
  });

  /* ------------------------------- draw ------------------------------- */
  const GREEN = k.rgb(0, 255, 0);
  const RED = k.rgb(255, 51, 51);

  k.onDraw(() => {
    k.drawRect({ pos: k.vec2(0, 0), width: SIZE, height: SIZE, color: k.rgb(0, 0, 0) });

    // Bullet trails, then bullets (original: red fading squares + disc).
    for (const b of bullets) {
      b.trail.forEach((tp, i) => {
        k.drawRect({
          pos: k.vec2(tp.x - 2, tp.y - 2), width: 4, height: 4,
          color: RED, opacity: (i / b.trail.length) * 0.5
        });
      });
      k.drawCircle({ pos: k.vec2(b.x, b.y), radius: b.size + 4, color: RED, opacity: 0.2 });
      k.drawCircle({ pos: k.vec2(b.x, b.y), radius: b.size, color: RED });
    }

    // Player trail (original: green fading circles).
    player.trail.forEach((tp, i) => {
      k.drawCircle({
        pos: k.vec2(tp.x, tp.y), radius: player.size * 0.7,
        color: GREEN, opacity: (i / player.trail.length) * 0.3
      });
    });

    // Player disc + glow + crosshair.
    k.drawCircle({ pos: k.vec2(player.x, player.y), radius: player.size + 5, color: GREEN, opacity: 0.2 });
    k.drawCircle({ pos: k.vec2(player.x, player.y), radius: player.size, color: GREEN });
    const s = player.size;
    const lines = [
      [player.x - s - 5, player.y, player.x - s * 2, player.y],
      [player.x + s + 5, player.y, player.x + s * 2, player.y],
      [player.x, player.y - s - 5, player.x, player.y - s * 2],
      [player.x, player.y + s + 5, player.x, player.y + s * 2]
    ];
    for (const [x1, y1, x2, y2] of lines) {
      k.drawLine({ p1: k.vec2(x1, y1), p2: k.vec2(x2, y2), width: 2, color: GREEN });
    }

    // Explosion particles (original: green squares, alpha = life).
    for (const p of particles) {
      k.drawRect({ pos: k.vec2(p.x, p.y), width: p.size, height: p.size, color: GREEN, opacity: Math.max(0, p.life) });
    }
  });

  /* --------------------------- touch input ---------------------------- */
  // Original scheme: drag direction from the touch start point steers.
  const touchDir = { left: false, right: false, up: false, down: false };
  let touchStart = null;

  function toLogical(e) {
    const rect = canvas.getBoundingClientRect();
    const t = e.touches[0] || e.changedTouches[0];
    return {
      x: (t.clientX - rect.left) / rect.width * SIZE,
      y: (t.clientY - rect.top) / rect.height * SIZE
    };
  }

  canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    touchStart = toLogical(e);
  }, { passive: false });
  canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    if (!touchStart) return;
    const p = toLogical(e);
    const dx = p.x - touchStart.x, dy = p.y - touchStart.y;
    touchDir.left = touchDir.right = touchDir.up = touchDir.down = false;
    if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
      if (Math.abs(dx) > Math.abs(dy)) {
        touchDir.right = dx > 0;
        touchDir.left = dx < 0;
      } else {
        touchDir.down = dy > 0;
        touchDir.up = dy < 0;
      }
    }
  }, { passive: false });
  canvas.addEventListener('touchend', (e) => {
    e.preventDefault();
    touchStart = null;
    touchDir.left = touchDir.right = touchDir.up = touchDir.down = false;
  }, { passive: false });
  document.body.addEventListener('touchmove', (e) => { e.preventDefault(); }, { passive: false });

  startBtn.addEventListener('click', startGame);
  restartBtn.addEventListener('click', startGame);

  // Competitive banners (daily challenge + streak) — same as every game.
  engine.renderMeta();

  // Test/automation handle: lets the crew play-verify headlessly.
  window.MatrixGame = {
    slug: 'bullet-dodge',
    engine: 'kaplay',
    getState: () => ({
      gameRunning,
      score,
      level,
      lives,
      bullets: bullets.length,
      player: { x: Math.round(player.x), y: Math.round(player.y) },
      paused: engine.isPaused()
    }),
    start: startGame,
    setPaused: (v) => engine.setPaused(v)
  };
})();
