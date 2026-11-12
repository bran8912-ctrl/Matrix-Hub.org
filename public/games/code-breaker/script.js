const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const codeInput = document.getElementById('codeInput');
const scoreDisplay = document.getElementById('score');
const levelDisplay = document.getElementById('level');
const livesDisplay = document.getElementById('lives');
const gameOverScreen = document.getElementById('gameOver');
const finalScoreDisplay = document.getElementById('finalScore');
const restartBtn = document.getElementById('restartBtn');

// Responsive canvas
function resizeCanvas() {
    const maxWidth = Math.min(800, window.innerWidth - 40);
    const maxHeight = Math.min(500, window.innerHeight - 300);
    canvas.width = maxWidth;
    canvas.height = maxHeight;
}

window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// Game state
let score = 0;
let level = 1;
let lives = 3;
let gameActive = false;
let fallingCodes = [];
let lastSpawnTime = 0;
let spawnInterval = 2000;
// Competitive Phase 1 (HUB 155): shared best + local board via MatrixBest.
let mhRunStart = Date.now();
let mhRunId = null;
function mhNewRun() {
    mhRunStart = Date.now();
    mhRunId = 'code-breaker-' + mhRunStart + '-' + Math.random().toString(36).slice(2, 8);
}
const bestDisplay = document.getElementById('best');
if (window.MatrixBest) {
    const stored = MatrixBest.getBest('code-breaker');
    if (bestDisplay && stored) bestDisplay.textContent = stored.score;
    MatrixBest.renderChallengeInto(document.getElementById('mh-challenge'), 'code-breaker');
    MatrixBest.renderStreakInto(document.getElementById('mh-streak'));
}

// Matrix characters
const matrixChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()';

class FallingCode {
    constructor() {
        this.length = Math.floor(Math.random() * 3) + 3 + Math.floor(level / 3);
        this.text = this.generateCode();
        this.x = Math.random() * (canvas.width - 100) + 50;
        this.y = 0;
        this.speed = 0.3 + (level * 0.05);
        this.width = this.text.length * 15;
        this.height = 30;
    }

    generateCode() {
        let code = '';
        for (let i = 0; i < this.length; i++) {
            code += matrixChars[Math.floor(Math.random() * matrixChars.length)];
        }
        return code;
    }

    update() {
        this.y += this.speed;
    }

    draw() {
        // Glow effect
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#0f0';
        
        // Background
        ctx.fillStyle = 'rgba(0, 50, 0, 0.7)';
        ctx.fillRect(this.x - 10, this.y, this.width + 20, this.height);
        
        // Border
        ctx.strokeStyle = '#0f0';
        ctx.lineWidth = 2;
        ctx.strokeRect(this.x - 10, this.y, this.width + 20, this.height);
        
        // Text
        ctx.fillStyle = '#0f0';
        ctx.font = '20px "Courier New"';
        ctx.textAlign = 'center';
        ctx.fillText(this.text, this.x + this.width / 2, this.y + 22);
        
        ctx.shadowBlur = 0;
    }

    isOffScreen() {
        return this.y > canvas.height;
    }
}

function spawnCode() {
    if (gameActive) {
        fallingCodes.push(new FallingCode());
    }
}

function updateGame(timestamp) {
    if (!gameActive) return;

    // Clear canvas
    ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Spawn new codes
    if (timestamp - lastSpawnTime > spawnInterval) {
        spawnCode();
        lastSpawnTime = timestamp;
    }

    // Update and draw falling codes
    for (let i = fallingCodes.length - 1; i >= 0; i--) {
        const code = fallingCodes[i];
        code.update();
        code.draw();

        // Check if code reached bottom
        if (code.isOffScreen()) {
            fallingCodes.splice(i, 1);
            lives--;
            livesDisplay.textContent = lives;
            
            if (lives <= 0) {
                endGame();
                return;
            }
        }
    }

    requestAnimationFrame(updateGame);
}

function checkCode() {
    const input = codeInput.value.toUpperCase().trim();
    
    if (!input) return;

    for (let i = 0; i < fallingCodes.length; i++) {
        if (fallingCodes[i].text === input) {
            // Correct code!
            score += 10 * level;
            scoreDisplay.textContent = score;
            
            // Create explosion effect
            createExplosion(fallingCodes[i].x + fallingCodes[i].width / 2, fallingCodes[i].y);
            
            fallingCodes.splice(i, 1);
            codeInput.value = '';
            
            // Level up
            if (score > 0 && score % 100 === 0) {
                level++;
                levelDisplay.textContent = level;
                spawnInterval = Math.max(800, spawnInterval - 100);
            }
            
            return;
        }
    }
    
    // Wrong code - shake effect
    codeInput.style.borderColor = '#f00';
    setTimeout(() => {
        codeInput.style.borderColor = '#0f0';
    }, 200);
}

function createExplosion(x, y) {
    ctx.shadowBlur = 30;
    ctx.shadowColor = '#0ff';
    ctx.fillStyle = '#0ff';
    ctx.beginPath();
    ctx.arc(x, y, 20, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
}

function endGame() {
    gameActive = false;
    finalScoreDisplay.textContent = score;
    gameOverScreen.classList.remove('hidden');
    // Competitive Phase 1: record the run (best, board, daily challenge).
    if (window.MatrixBest) {
        const out = MatrixBest.finishRun('code-breaker', { score: score }, {
            durationSec: (Date.now() - mhRunStart) / 1000,
            runId: mhRunId,
            scoreText: String(score)
        });
        if (bestDisplay && out.best.best) bestDisplay.textContent = out.best.best.score;
    }
}

function restartGame() {
    mhNewRun();
    score = 0;
    level = 1;
    lives = 3;
    fallingCodes = [];
    gameActive = true;
    spawnInterval = 2000;
    lastSpawnTime = 0;
    
    scoreDisplay.textContent = score;
    levelDisplay.textContent = level;
    livesDisplay.textContent = lives;
    gameOverScreen.classList.add('hidden');
    codeInput.value = '';
    
    requestAnimationFrame(updateGame);
}

// Event listeners
codeInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        checkCode();
    } else if (e.key === 'Escape') {
        e.preventDefault();
        codeInput.value = '';
    }
});

restartBtn.addEventListener('click', restartGame);

// Auto-focus on mobile
canvas.addEventListener('click', () => {
    codeInput.focus();
});

// Prevent scrolling
document.body.addEventListener('touchmove', (e) => {
    e.preventDefault();
}, { passive: false });

// Start immediately — no name prompt (personal bests only, HUB 155).
// The old prompt flow meant cancelling the prompt stopped the game
// from ever starting; that gate is gone.
function startGame() {
    mhNewRun();
    gameActive = true;
    requestAnimationFrame(updateGame);
}

// Start game on load
setTimeout(startGame, 500);
