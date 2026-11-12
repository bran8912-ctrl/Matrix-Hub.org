const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');

// Make canvas responsive
function resizeCanvas() {
    const size = Math.min(window.innerWidth - 40, window.innerHeight - 200, 600);
    canvas.width = size;
    canvas.height = size;
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

// Game state
let gameRunning = false;
let score = 0;
let level = 1;
let lives = 3;
let bullets = [];
let particles = [];
let frameCount = 0;

// Player
const player = {
    x: canvas.width / 2,
    y: canvas.height / 2,
    size: 15,
    speed: 5,
    trail: []
};

// Input handling
const keys = {};
document.addEventListener('keydown', (e) => {
    keys[e.key.toLowerCase()] = true;
});
document.addEventListener('keyup', (e) => {
    keys[e.key.toLowerCase()] = false;
});

// Touch controls for mobile
let touchControls = { left: false, right: false, up: false, down: false };
let touchStartX = 0;
let touchStartY = 0;
let isTouching = false;

// Prevent scrolling on touch
document.body.addEventListener('touchmove', (e) => {
    e.preventDefault();
}, { passive: false });

canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const touch = e.touches[0];
    const rect = canvas.getBoundingClientRect();
    touchStartX = touch.clientX - rect.left;
    touchStartY = touch.clientY - rect.top;
    isTouching = true;
});

canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    if (!isTouching) return;
    
    const touch = e.touches[0];
    const rect = canvas.getBoundingClientRect();
    const touchX = touch.clientX - rect.left;
    const touchY = touch.clientY - rect.top;
    
    const deltaX = touchX - touchStartX;
    const deltaY = touchY - touchStartY;
    
    // Reset all
    touchControls = { left: false, right: false, up: false, down: false };
    
    // Determine direction based on largest delta
    const threshold = 5;
    if (Math.abs(deltaX) > threshold || Math.abs(deltaY) > threshold) {
        if (Math.abs(deltaX) > Math.abs(deltaY)) {
            touchControls.right = deltaX > 0;
            touchControls.left = deltaX < 0;
        } else {
            touchControls.down = deltaY > 0;
            touchControls.up = deltaY < 0;
        }
    }
});

canvas.addEventListener('touchend', (e) => {
    e.preventDefault();
    isTouching = false;
    touchControls = { left: false, right: false, up: false, down: false };
});

// UI Elements
const startBtn = document.getElementById('start-btn');
const restartBtn = document.getElementById('restart-btn');
const startScreen = document.getElementById('start-screen');
const gameOverScreen = document.getElementById('game-over');
const scoreDisplay = document.getElementById('score');
const levelDisplay = document.getElementById('level');
const livesDisplay = document.getElementById('lives');
const finalScoreDisplay = document.getElementById('final-score');
const finalLevelDisplay = document.getElementById('final-level');
const bestDisplay = document.getElementById('best');

// Competitive Phase 1 (HUB 155): shared best + local board via MatrixBest.
let mhRunStart = Date.now();
let mhRunId = null;
function mhNewRun() {
    mhRunStart = Date.now();
    mhRunId = 'bullet-dodge-' + mhRunStart + '-' + Math.random().toString(36).slice(2, 8);
}
if (window.MatrixBest) {
    const stored = MatrixBest.getBest('bullet-dodge');
    if (bestDisplay) bestDisplay.textContent = stored ? MatrixBest.formatBest('bullet-dodge', stored).replace('Best: ', '') : '';
    MatrixBest.renderChallengeInto(document.getElementById('mh-challenge'), 'bullet-dodge');
    MatrixBest.renderStreakInto(document.getElementById('mh-streak'));
}

class Bullet {
    constructor(x, y, angle, speed) {
        this.x = x;
        this.y = y;
        this.size = 5;
        this.angle = angle;
        this.speed = speed;
        this.trail = [];
    }
    
    update() {
        // Store trail
        this.trail.push({x: this.x, y: this.y});
        if (this.trail.length > 10) {
            this.trail.shift();
        }
        
        this.x += Math.cos(this.angle) * this.speed;
        this.y += Math.sin(this.angle) * this.speed;
    }
    
    draw() {
        // Draw trail
        for (let i = 0; i < this.trail.length; i++) {
            const alpha = i / this.trail.length;
            ctx.fillStyle = `rgba(255, 50, 50, ${alpha * 0.5})`;
            ctx.fillRect(this.trail[i].x - 2, this.trail[i].y - 2, 4, 4);
        }
        
        // Draw bullet
        ctx.fillStyle = '#ff3333';
        ctx.shadowColor = '#ff0000';
        ctx.shadowBlur = 15;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
    }
    
    isOffScreen() {
        return this.x < -20 || this.x > canvas.width + 20 || 
               this.y < -20 || this.y > canvas.height + 20;
    }
    
    collidesWith(obj) {
        const dx = this.x - obj.x;
        const dy = this.y - obj.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        return distance < this.size + obj.size;
    }
}

class Particle {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.size = Math.random() * 3 + 1;
        this.speedX = (Math.random() - 0.5) * 6;
        this.speedY = (Math.random() - 0.5) * 6;
        this.life = 1;
        this.decay = Math.random() * 0.02 + 0.01;
    }
    
    update() {
        this.x += this.speedX;
        this.y += this.speedY;
        this.life -= this.decay;
        this.speedX *= 0.98;
        this.speedY *= 0.98;
    }
    
    draw() {
        ctx.fillStyle = `rgba(0, 255, 0, ${this.life})`;
        ctx.fillRect(this.x, this.y, this.size, this.size);
    }
    
    isDead() {
        return this.life <= 0;
    }
}

function spawnBullets() {
    const spawnRate = Math.max(30 - level * 2, 10);
    
    if (frameCount % spawnRate === 0) {
        // Random edge spawn
        const edge = Math.floor(Math.random() * 4);
        let x, y, angle;
        
        switch(edge) {
            case 0: // Top
                x = Math.random() * canvas.width;
                y = -10;
                angle = Math.atan2(player.y - y, player.x - x) + (Math.random() - 0.5) * 0.5;
                break;
            case 1: // Right
                x = canvas.width + 10;
                y = Math.random() * canvas.height;
                angle = Math.atan2(player.y - y, player.x - x) + (Math.random() - 0.5) * 0.5;
                break;
            case 2: // Bottom
                x = Math.random() * canvas.width;
                y = canvas.height + 10;
                angle = Math.atan2(player.y - y, player.x - x) + (Math.random() - 0.5) * 0.5;
                break;
            case 3: // Left
                x = -10;
                y = Math.random() * canvas.height;
                angle = Math.atan2(player.y - y, player.x - x) + (Math.random() - 0.5) * 0.5;
                break;
        }
        
        const speed = 2 + level * 0.3;
        bullets.push(new Bullet(x, y, angle, speed));
    }
}

function updatePlayer() {
    // Movement (keyboard + touch)
    if (keys['arrowleft'] || keys['a'] || touchControls.left) player.x -= player.speed;
    if (keys['arrowright'] || keys['d'] || touchControls.right) player.x += player.speed;
    if (keys['arrowup'] || keys['w'] || touchControls.up) player.y -= player.speed;
    if (keys['arrowdown'] || keys['s'] || touchControls.down) player.y += player.speed;
    
    // Boundary
    player.x = Math.max(player.size, Math.min(canvas.width - player.size, player.x));
    player.y = Math.max(player.size, Math.min(canvas.height - player.size, player.y));
    
    // Trail
    player.trail.push({x: player.x, y: player.y});
    if (player.trail.length > 15) {
        player.trail.shift();
    }
}

function drawPlayer() {
    // Draw trail
    for (let i = 0; i < player.trail.length; i++) {
        const alpha = i / player.trail.length;
        ctx.fillStyle = `rgba(0, 255, 0, ${alpha * 0.3})`;
        ctx.beginPath();
        ctx.arc(player.trail[i].x, player.trail[i].y, player.size * 0.7, 0, Math.PI * 2);
        ctx.fill();
    }
    
    // Draw player
    ctx.fillStyle = '#0f0';
    ctx.shadowColor = '#0f0';
    ctx.shadowBlur = 20;
    ctx.beginPath();
    ctx.arc(player.x, player.y, player.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    
    // Draw crosshair
    ctx.strokeStyle = '#0f0';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(player.x - player.size - 5, player.y);
    ctx.lineTo(player.x - player.size * 2, player.y);
    ctx.moveTo(player.x + player.size + 5, player.y);
    ctx.lineTo(player.x + player.size * 2, player.y);
    ctx.moveTo(player.x, player.y - player.size - 5);
    ctx.lineTo(player.x, player.y - player.size * 2);
    ctx.moveTo(player.x, player.y + player.size + 5);
    ctx.lineTo(player.x, player.y + player.size * 2);
    ctx.stroke();
}

function createExplosion(x, y) {
    for (let i = 0; i < 20; i++) {
        particles.push(new Particle(x, y));
    }
}

function updateGame() {
    if (!gameRunning) return;
    
    frameCount++;
    
    // Clear canvas
    ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Update and draw player
    updatePlayer();
    drawPlayer();
    
    // Spawn bullets
    spawnBullets();
    
    // Update bullets
    for (let i = bullets.length - 1; i >= 0; i--) {
        bullets[i].update();
        bullets[i].draw();
        
        if (bullets[i].isOffScreen()) {
            bullets.splice(i, 1);
            score += 1;
        } else if (bullets[i].collidesWith(player)) {
            bullets.splice(i, 1);
            lives--;
            createExplosion(player.x, player.y);
            updateLivesDisplay();
            
            if (lives <= 0) {
                endGame();
                return;
            }
        }
    }
    
    // Update particles
    for (let i = particles.length - 1; i >= 0; i--) {
        particles[i].update();
        particles[i].draw();
        
        if (particles[i].isDead()) {
            particles.splice(i, 1);
        }
    }
    
    // Level up
    if (score > 0 && score % 100 === 0 && frameCount % 5 === 0) {
        level++;
        levelDisplay.textContent = level;
    }
    
    scoreDisplay.textContent = score;
    
    requestAnimationFrame(updateGame);
}

function updateLivesDisplay() {
    const hearts = '❤'.repeat(lives);
    const empty = '🖤'.repeat(3 - lives);
    livesDisplay.textContent = hearts + empty;
}

function startGame() {
    mhNewRun();
    gameRunning = true;
    score = 0;
    level = 1;
    lives = 3;
    bullets = [];
    particles = [];
    frameCount = 0;
    player.x = canvas.width / 2;
    player.y = canvas.height / 2;
    player.trail = [];
    
    scoreDisplay.textContent = '0';
    levelDisplay.textContent = '1';
    updateLivesDisplay();
    
    startScreen.classList.add('hidden');
    gameOverScreen.classList.add('hidden');
    
    updateGame();
}

function endGame() {
    gameRunning = false;
    finalScoreDisplay.textContent = score;
    finalLevelDisplay.textContent = level;
    gameOverScreen.classList.remove('hidden');
    // Competitive Phase 1: record the run (best, board, daily challenge).
    if (window.MatrixBest) {
        const out = MatrixBest.finishRun('bullet-dodge', { score: score }, {
            durationSec: (Date.now() - mhRunStart) / 1000,
            runId: mhRunId,
            scoreText: String(score)
        });
        if (bestDisplay && out.best.best) {
            bestDisplay.textContent = MatrixBest.formatBest('bullet-dodge', out.best.best).replace('Best: ', '');
        }
    }
}

startBtn.addEventListener('click', startGame);
restartBtn.addEventListener('click', startGame);

// Initial draw
ctx.fillStyle = '#000';
ctx.fillRect(0, 0, canvas.width, canvas.height);
