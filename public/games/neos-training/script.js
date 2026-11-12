const targetArea = document.getElementById('targetArea');
const target = document.getElementById('target');
const instructions = document.getElementById('instructions');
const reactionTimeDisplay = document.getElementById('reactionTime');
const bestTimeDisplay = document.getElementById('bestTime');
const roundDisplay = document.getElementById('round');
const resultsScreen = document.getElementById('results');
const avgTimeDisplay = document.getElementById('avgTime');
const finalBestDisplay = document.getElementById('finalBest');
const ratingDisplay = document.getElementById('rating');
const restartBtn = document.getElementById('restartBtn');

let round = 0;
let maxRounds = 10;
let startTime = 0;
let waiting = false;
let reactionTimes = [];
let bestTime = Infinity;
let timeoutId = null;

// Competitive Phase 1 (HUB 155): shared best + local board via MatrixBest.
// The stored best is the fastest single reaction time (lower is better).
let mhRunStart = Date.now();
let mhRunId = null;
let mhStoredBestMs = null;
function mhNewRun() {
    mhRunStart = Date.now();
    mhRunId = 'neos-training-' + mhRunStart + '-' + Math.random().toString(36).slice(2, 8);
}
if (window.MatrixBest) {
    const stored = MatrixBest.getBest('neos-training');
    if (stored) {
        mhStoredBestMs = stored.timeMs;
        bestTimeDisplay.textContent = stored.timeMs;
    }
    MatrixBest.renderChallengeInto(document.getElementById('mh-challenge'), 'neos-training');
    MatrixBest.renderStreakInto(document.getElementById('mh-streak'));
}

function startRound() {
    if (round >= maxRounds) {
        endGame();
        return;
    }

    round++;
    roundDisplay.textContent = round;
    instructions.textContent = 'Wait...';
    target.classList.add('hidden');
    waiting = true;

    // Random delay between 1-4 seconds
    const delay = Math.random() * 3000 + 1000;
    
    timeoutId = setTimeout(() => {
        showTarget();
    }, delay);
}

function showTarget() {
    if (!waiting) return;
    
    // Random position
    const areaRect = targetArea.getBoundingClientRect();
    const maxX = areaRect.width - 80;
    const maxY = areaRect.height - 80;
    
    const x = Math.random() * maxX + 20;
    const y = Math.random() * maxY + 20;
    
    target.style.left = x + 'px';
    target.style.top = y + 'px';
    target.classList.remove('hidden');
    
    instructions.textContent = 'CLICK NOW!';
    startTime = Date.now();
    waiting = false;
}

function handleTargetClick(e) {
    e.stopPropagation();
    
    if (waiting) {
        // Clicked too early
        instructions.textContent = 'Too early! Wait for the target...';
        instructions.style.color = '#f00';
        clearTimeout(timeoutId);
        setTimeout(() => {
            instructions.style.color = '#0f0';
            startRound();
        }, 1000);
        return;
    }
    
    if (target.classList.contains('hidden')) {
        return;
    }
    
    const reactionTime = Date.now() - startTime;
    reactionTimes.push(reactionTime);
    
    reactionTimeDisplay.textContent = reactionTime;
    
    if (reactionTime < bestTime) {
        bestTime = reactionTime;
        bestTimeDisplay.textContent = bestTime;
        
        // Flash effect for new best
        bestTimeDisplay.style.color = '#ff0';
        setTimeout(() => {
            bestTimeDisplay.style.color = '#0ff';
        }, 500);
    }
    
    target.classList.add('hidden');
    
    // Visual feedback
    createClickEffect(e.clientX - targetArea.getBoundingClientRect().left, 
                      e.clientY - targetArea.getBoundingClientRect().top);
    
    setTimeout(() => {
        startRound();
    }, 500);
}

function createClickEffect(x, y) {
    const effect = document.createElement('div');
    effect.style.position = 'absolute';
    effect.style.left = x + 'px';
    effect.style.top = y + 'px';
    effect.style.width = '100px';
    effect.style.height = '100px';
    effect.style.border = '3px solid #0ff';
    effect.style.borderRadius = '50%';
    effect.style.transform = 'translate(-50%, -50%)';
    effect.style.animation = 'expandFade 0.5s ease-out';
    effect.style.pointerEvents = 'none';
    
    targetArea.appendChild(effect);
    
    setTimeout(() => {
        effect.remove();
    }, 500);
}

function endGame() {
    const avgTime = Math.round(reactionTimes.reduce((a, b) => a + b, 0) / reactionTimes.length);
    
    avgTimeDisplay.textContent = avgTime;
    finalBestDisplay.textContent = bestTime;
    
    // Rating based on average time
    let rating = '';
    if (avgTime < 200) {
        rating = '🏆 NEO LEVEL - You are The One!';
    } else if (avgTime < 250) {
        rating = '⚡ MORPHEUS LEVEL - Exceptional!';
    } else if (avgTime < 300) {
        rating = '🎯 TRINITY LEVEL - Impressive!';
    } else if (avgTime < 400) {
        rating = '💪 AGENT LEVEL - Good!';
    } else {
        rating = '🔋 TRAINEE - Keep practicing!';
    }
    
    ratingDisplay.textContent = rating;
    resultsScreen.classList.remove('hidden');

    // Competitive Phase 1: record the run (best, board, daily challenge).
    if (window.MatrixBest && bestTime < Infinity && reactionTimes.length) {
        MatrixBest.finishRun('neos-training', { timeMs: bestTime }, {
            durationSec: (Date.now() - mhRunStart) / 1000,
            runId: mhRunId,
            scoreText: bestTime + ' ms',
            verb: 'My fastest reaction was'
        });
        const storedNow = MatrixBest.getBest('neos-training');
        if (storedNow) mhStoredBestMs = storedNow.timeMs;
    }
}

function resetGame() {
    mhNewRun();
    round = 0;
    reactionTimes = [];
    bestTime = Infinity;
    roundDisplay.textContent = '0';
    reactionTimeDisplay.textContent = '---';
    bestTimeDisplay.textContent = mhStoredBestMs !== null ? mhStoredBestMs : '---';
    instructions.textContent = 'Click when the target appears!';
    resultsScreen.classList.add('hidden');
    target.classList.add('hidden');
    
    setTimeout(() => {
        startRound();
    }, 1000);
}

// Event listeners
target.addEventListener('click', handleTargetClick);
target.addEventListener('touchend', (e) => {
    e.preventDefault();
    handleTargetClick(e);
});

targetArea.addEventListener('click', (e) => {
    if (e.target === targetArea || e.target === instructions) {
        if (waiting) {
            // Clicked too early
            instructions.textContent = 'Too early! Wait for the target...';
            instructions.style.color = '#f00';
            clearTimeout(timeoutId);
            setTimeout(() => {
                instructions.style.color = '#0f0';
                startRound();
            }, 1000);
        }
    }
});

restartBtn.addEventListener('click', resetGame);

// Add CSS for click effect animation
const style = document.createElement('style');
style.textContent = `
    @keyframes expandFade {
        from {
            transform: translate(-50%, -50%) scale(0);
            opacity: 1;
        }
        to {
            transform: translate(-50%, -50%) scale(2);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);

// Prevent accidental scrolling
document.body.addEventListener('touchmove', (e) => {
    e.preventDefault();
}, { passive: false });

// Start immediately — no name prompt (personal bests only, HUB 155).
mhNewRun();
setTimeout(() => {
    startRound();
}, 1500);
