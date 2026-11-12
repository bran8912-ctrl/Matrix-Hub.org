const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreDisplay = document.getElementById('score');
const highScoreDisplay = document.getElementById('highScore');
const gameOverScreen = document.getElementById('gameOver');
const finalScoreDisplay = document.getElementById('finalScore');
const restartBtn = document.getElementById('restartBtn');

// Responsive canvas
let gridSize = 20;

function resizeCanvas() {
    const maxWidth = Math.min(600, window.innerWidth - 40);
    const maxHeight = Math.min(600, window.innerHeight - 300);
    const size = Math.min(maxWidth, maxHeight);
    canvas.width = size;
    canvas.height = size;
    gridSize = Math.floor(size / 30);
}

window.addEventListener('resize', resizeCanvas);
resizeCanvas();

let snake = [];
let direction = { x: 1, y: 0 };
let nextDirection = { x: 1, y: 0 };
let food = {};
let score = 0;
let highScore = 0;
let gameActive = false;
let gameSpeed = 100;

// Competitive Phase 1 (HUB 155): shared best + local board via MatrixBest.
// The legacy 'cyberSnakeHighScore' key is migrated once into the shared key.
let mhRunStart = Date.now();
let mhRunId = null;
function mhNewRun() {
    mhRunStart = Date.now();
    mhRunId = 'cyber-snake-' + mhRunStart + '-' + Math.random().toString(36).slice(2, 8);
}
if (window.MatrixBest) {
    const stored = MatrixBest.getBest('cyber-snake');
    if (stored) {
        highScore = stored.score;
    } else {
        let legacy = 0;
        try { legacy = parseInt(localStorage.getItem('cyberSnakeHighScore'), 10) || 0; } catch (e) { legacy = 0; }
        if (legacy > 0) {
            MatrixBest.saveBest('cyber-snake', { score: legacy });
            highScore = legacy;
        }
    }
    MatrixBest.renderChallengeInto(document.getElementById('mh-challenge'), 'cyber-snake');
    MatrixBest.renderStreakInto(document.getElementById('mh-streak'));
}

highScoreDisplay.textContent = highScore;

function initGame() {
    snake = [
        { x: 15, y: 15 },
        { x: 14, y: 15 },
        { x: 13, y: 15 }
    ];
    direction = { x: 1, y: 0 };
    nextDirection = { x: 1, y: 0 };
    score = 0;
    scoreDisplay.textContent = score;
    gameActive = true;
    mhNewRun();
    spawnFood();
    gameOverScreen.classList.add('hidden');
}

function spawnFood() {
    const gridCount = Math.floor(canvas.width / gridSize);
    food = {
        x: Math.floor(Math.random() * gridCount),
        y: Math.floor(Math.random() * gridCount)
    };
    
    // Make sure food doesn't spawn on snake
    for (let segment of snake) {
        if (segment.x === food.x && segment.y === food.y) {
            spawnFood();
            return;
        }
    }
}

function drawGrid() {
    ctx.strokeStyle = 'rgba(0, 255, 0, 0.1)';
    ctx.lineWidth = 1;
    
    const gridCount = Math.floor(canvas.width / gridSize);
    for (let i = 0; i <= gridCount; i++) {
        ctx.beginPath();
        ctx.moveTo(i * gridSize, 0);
        ctx.lineTo(i * gridSize, canvas.height);
        ctx.stroke();
        
        ctx.beginPath();
        ctx.moveTo(0, i * gridSize);
        ctx.lineTo(canvas.width, i * gridSize);
        ctx.stroke();
    }
}

function drawSnake() {
    snake.forEach((segment, index) => {
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#0f0';
        
        // Head is brighter
        if (index === 0) {
            ctx.fillStyle = '#0ff';
            ctx.shadowColor = '#0ff';
        } else {
            ctx.fillStyle = '#0f0';
            ctx.shadowColor = '#0f0';
        }
        
        ctx.fillRect(
            segment.x * gridSize + 1,
            segment.y * gridSize + 1,
            gridSize - 2,
            gridSize - 2
        );
    });
    
    ctx.shadowBlur = 0;
}

function drawFood() {
    ctx.shadowBlur = 20;
    ctx.shadowColor = '#f0f';
    ctx.fillStyle = '#f0f';
    
    ctx.beginPath();
    ctx.arc(
        food.x * gridSize + gridSize / 2,
        food.y * gridSize + gridSize / 2,
        gridSize / 2 - 2,
        0,
        Math.PI * 2
    );
    ctx.fill();
    
    ctx.shadowBlur = 0;
}

function updateSnake() {
    if (!gameActive) return;
    
    direction = { ...nextDirection };
    
    const head = { x: snake[0].x + direction.x, y: snake[0].y + direction.y };
    
    const gridCount = Math.floor(canvas.width / gridSize);
    
    // Check wall collision
    if (head.x < 0 || head.x >= gridCount || head.y < 0 || head.y >= gridCount) {
        endGame();
        return;
    }
    
    // Check self collision
    for (let segment of snake) {
        if (segment.x === head.x && segment.y === head.y) {
            endGame();
            return;
        }
    }
    
    snake.unshift(head);
    
    // Check food collision
    if (head.x === food.x && head.y === food.y) {
        score += 10;
        scoreDisplay.textContent = score;
        spawnFood();
        
        if (score > highScore) {
            highScore = score;
            highScoreDisplay.textContent = highScore;
        }
    } else {
        snake.pop();
    }
}

function draw() {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    drawGrid();
    drawFood();
    drawSnake();
}

function gameLoop() {
    if (!gameActive) return;
    
    updateSnake();
    draw();
    
    setTimeout(() => {
        requestAnimationFrame(gameLoop);
    }, gameSpeed);
}

function endGame() {
    gameActive = false;
    finalScoreDisplay.textContent = score;
    gameOverScreen.classList.remove('hidden');
    mhFinishRun();
}

// Competitive Phase 1: persist best + local board via the shared
// finishRun path (best, NEW BEST, rank on this device, board top 5,
// daily challenge, share card).
function mhFinishRun() {
    if (!window.MatrixBest) return;
    const out = MatrixBest.finishRun('cyber-snake', { score: score }, {
        durationSec: (Date.now() - mhRunStart) / 1000,
        runId: mhRunId,
        scoreText: String(score)
    });
    if (out.best.best) {
        highScore = out.best.best.score;
        highScoreDisplay.textContent = highScore;
    }
}

function changeDirection(newDir) {
    // Prevent 180-degree turns
    if (newDir.x !== -direction.x && newDir.y !== -direction.y) {
        nextDirection = newDir;
    }
}

// Keyboard controls
document.addEventListener('keydown', (e) => {
    if (!gameActive && e.key !== 'Enter') return;
    
    switch (e.key) {
        case 'ArrowUp':
        case 'w':
        case 'W':
            e.preventDefault();
            changeDirection({ x: 0, y: -1 });
            break;
        case 'ArrowDown':
        case 's':
        case 'S':
            e.preventDefault();
            changeDirection({ x: 0, y: 1 });
            break;
        case 'ArrowLeft':
        case 'a':
        case 'A':
            e.preventDefault();
            changeDirection({ x: -1, y: 0 });
            break;
        case 'ArrowRight':
        case 'd':
        case 'D':
            e.preventDefault();
            changeDirection({ x: 1, y: 0 });
            break;
    }
});

// Mobile touch controls
let touchStartX = 0;
let touchStartY = 0;

canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
});

canvas.addEventListener('touchend', (e) => {
    e.preventDefault();
    const touchEndX = e.changedTouches[0].clientX;
    const touchEndY = e.changedTouches[0].clientY;
    
    const deltaX = touchEndX - touchStartX;
    const deltaY = touchEndY - touchStartY;
    
    if (Math.abs(deltaX) > Math.abs(deltaY)) {
        // Horizontal swipe
        if (deltaX > 0) {
            changeDirection({ x: 1, y: 0 });
        } else {
            changeDirection({ x: -1, y: 0 });
        }
    } else {
        // Vertical swipe
        if (deltaY > 0) {
            changeDirection({ x: 0, y: 1 });
        } else {
            changeDirection({ x: 0, y: -1 });
        }
    }
});

// Mobile button controls
document.querySelectorAll('.arrow-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        e.preventDefault();
        const dir = btn.dataset.dir;
        switch (dir) {
            case 'up':
                changeDirection({ x: 0, y: -1 });
                break;
            case 'down':
                changeDirection({ x: 0, y: 1 });
                break;
            case 'left':
                changeDirection({ x: -1, y: 0 });
                break;
            case 'right':
                changeDirection({ x: 1, y: 0 });
                break;
        }
    });
});

restartBtn.addEventListener('click', () => {
    initGame();
    gameLoop();
});

// Prevent scrolling
document.body.addEventListener('touchmove', (e) => {
    e.preventDefault();
}, { passive: false });

// Start immediately — no name prompt (personal bests only, HUB 155).
function startGame() {
    initGame();
    gameLoop();
}

startGame();
