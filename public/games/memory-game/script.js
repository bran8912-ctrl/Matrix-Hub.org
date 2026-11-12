const gameBoard = document.getElementById('game-board');
const movesDisplay = document.getElementById('moves');
const matchesDisplay = document.getElementById('matches');
const timerDisplay = document.getElementById('timer');
const newGameBtn = document.getElementById('new-game-btn');
const difficultyBtn = document.getElementById('difficulty-btn');
const winScreen = document.getElementById('win-screen');
const playAgainBtn = document.getElementById('play-again-btn');
const finalMovesDisplay = document.getElementById('final-moves');
const finalTimeDisplay = document.getElementById('final-time');

// Game state
let cards = [];
let flippedCards = [];
let matchedPairs = 0;
let moves = 0;
let gameStarted = false;
let timerInterval;
let seconds = 0;
let difficulty = 'medium'; // easy, medium, hard

// Matrix symbols for cards
const symbols = ['۞', '▲', '◆', '★', '◉', '▣', '◈', '☯', '⬢', '⬡', '⬟', '⬣'];

// Difficulty settings
const difficulties = {
    easy: { pairs: 6, grid: '3x4' },
    medium: { pairs: 8, grid: '4x4' },
    hard: { pairs: 12, grid: '4x6' }
};

function initGame() {
    mhNewRun();
    resetGame();
    const numPairs = difficulties[difficulty].pairs;
    const selectedSymbols = symbols.slice(0, numPairs);
    const cardSymbols = [...selectedSymbols, ...selectedSymbols];
    
    // Shuffle cards
    cardSymbols.sort(() => Math.random() - 0.5);
    
    // Create cards
    cards = cardSymbols.map((symbol, index) => ({
        id: index,
        symbol: symbol,
        flipped: false,
        matched: false
    }));
    
    // Update grid layout
    const gridCols = difficulty === 'easy' ? 3 : 4;
    gameBoard.style.gridTemplateColumns = `repeat(${gridCols}, 1fr)`;
    
    // Render cards
    renderBoard();
}

function renderBoard() {
    gameBoard.innerHTML = '';
    
    cards.forEach(card => {
        const cardElement = document.createElement('div');
        cardElement.className = 'card';
        cardElement.dataset.id = card.id;
        
        cardElement.innerHTML = `
            <div class="card-front">
                <div class="matrix-pattern"></div>
            </div>
            <div class="card-back">${card.symbol}</div>
        `;
        
        cardElement.addEventListener('click', () => handleCardClick(card.id));
        gameBoard.appendChild(cardElement);
    });
}

function handleCardClick(cardId) {
    const card = cards.find(c => c.id === cardId);
    const cardElement = document.querySelector(`[data-id="${cardId}"]`);
    
    // Ignore if card is already flipped or matched, or if two cards are already flipped
    if (card.flipped || card.matched || flippedCards.length >= 2) {
        return;
    }
    
    // Start timer on first move
    if (!gameStarted) {
        startTimer();
        gameStarted = true;
    }
    
    // Flip card
    card.flipped = true;
    cardElement.classList.add('flipped');
    flippedCards.push(card);
    
    // Check for match when two cards are flipped
    if (flippedCards.length === 2) {
        moves++;
        movesDisplay.textContent = moves;
        
        setTimeout(() => {
            checkMatch();
        }, 800);
    }
}

function checkMatch() {
    const [card1, card2] = flippedCards;
    const card1Element = document.querySelector(`[data-id="${card1.id}"]`);
    const card2Element = document.querySelector(`[data-id="${card2.id}"]`);
    
    if (card1.symbol === card2.symbol) {
        // Match found
        card1.matched = true;
        card2.matched = true;
        card1Element.classList.add('matched');
        card2Element.classList.add('matched');
        
        matchedPairs++;
        matchesDisplay.textContent = `${matchedPairs}/${difficulties[difficulty].pairs}`;
        
        // Check for win
        if (matchedPairs === difficulties[difficulty].pairs) {
            setTimeout(() => {
                winGame();
            }, 500);
        }
    } else {
        // No match - flip back
        card1.flipped = false;
        card2.flipped = false;
        card1Element.classList.remove('flipped');
        card2Element.classList.remove('flipped');
    }
    
    flippedCards = [];
}

function startTimer() {
    seconds = 0;
    timerInterval = setInterval(() => {
        seconds++;
        const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
        const secs = (seconds % 60).toString().padStart(2, '0');
        timerDisplay.textContent = `${mins}:${secs}`;
    }, 1000);
}

function stopTimer() {
    clearInterval(timerInterval);
}

function resetGame() {
    stopTimer();
    cards = [];
    flippedCards = [];
    matchedPairs = 0;
    moves = 0;
    seconds = 0;
    gameStarted = false;
    
    movesDisplay.textContent = '0';
    matchesDisplay.textContent = `0/${difficulties[difficulty].pairs}`;
    timerDisplay.textContent = '00:00';
    winScreen.classList.add('hidden');
}

// Competitive Phase 1 (HUB 155): shared best + local board via MatrixBest.
// Best is per difficulty: fewest moves, then fastest time.
let mhRunStart = Date.now();
let mhRunId = null;
function mhNewRun() {
    mhRunStart = Date.now();
    mhRunId = 'memory-game-' + mhRunStart + '-' + Math.random().toString(36).slice(2, 8);
}
const bestDisplay = document.getElementById('best');
function mhShowStoredBest() {
    if (!window.MatrixBest || !bestDisplay) return;
    const stored = MatrixBest.getBest('memory-game');
    bestDisplay.textContent = stored ? MatrixBest.formatBest('memory-game', stored, difficulty).replace(/^Best \([^)]+\): /, '') : '';
}
if (window.MatrixBest) {
    mhShowStoredBest();
    MatrixBest.renderChallengeInto(document.getElementById('mh-challenge'), 'memory-game');
    MatrixBest.renderStreakInto(document.getElementById('mh-streak'));
}

function winGame() {
    stopTimer();
    finalMovesDisplay.textContent = moves;
    finalTimeDisplay.textContent = timerDisplay.textContent;
    winScreen.classList.remove('hidden');
    // Competitive Phase 1: record the run (best, board, daily challenge).
    if (window.MatrixBest) {
        MatrixBest.finishRun('memory-game', { moves: moves, time: seconds }, {
            durationSec: (Date.now() - mhRunStart) / 1000,
            runId: mhRunId,
            difficulty: difficulty,
            scoreText: moves + ' moves · ' + timerDisplay.textContent,
            verb: 'I finished in'
        });
        mhShowStoredBest();
    }
}

function changeDifficulty() {
    const difficultyOrder = ['easy', 'medium', 'hard'];
    const currentIndex = difficultyOrder.indexOf(difficulty);
    difficulty = difficultyOrder[(currentIndex + 1) % 3];
    
    difficultyBtn.textContent = `DIFFICULTY: ${difficulty.toUpperCase()}`;
    mhShowStoredBest();
    initGame();
}

// Event listeners
newGameBtn.addEventListener('click', initGame);
playAgainBtn.addEventListener('click', initGame);
difficultyBtn.addEventListener('click', changeDifficulty);

// Initialize game on load
initGame();
