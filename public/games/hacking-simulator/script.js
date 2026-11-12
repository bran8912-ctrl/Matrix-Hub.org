const terminalOutput = document.getElementById('terminal-output');
const terminalInput = document.getElementById('terminal-input');
const startBtn = document.getElementById('start-btn');
const restartBtn = document.getElementById('restart-btn');
const scoreDisplay = document.getElementById('score');
const levelDisplay = document.getElementById('level');
const accuracyDisplay = document.getElementById('accuracy');
const missionText = document.getElementById('mission-text');
const finishBtn = document.getElementById('finish-btn');
const endScreen = document.getElementById('end-screen');
const finalScoreDisplay = document.getElementById('final-score');
const playAgainBtn = document.getElementById('play-again-btn');
const bestDisplay = document.getElementById('best');

// Competitive Phase 1 (HUB 155): shared best + local board via MatrixBest.
// This game previously had no end state at all (roadmap fix H-1): a run
// now ends when the player clicks FINISH RUN, which lands the end screen.
let mhRunStart = Date.now();
let mhRunId = null;
function mhNewRun() {
    mhRunStart = Date.now();
    mhRunId = 'hacking-simulator-' + mhRunStart + '-' + Math.random().toString(36).slice(2, 8);
}
if (window.MatrixBest) {
    const stored = MatrixBest.getBest('hacking-simulator');
    if (bestDisplay && stored) bestDisplay.textContent = stored.score;
    MatrixBest.renderChallengeInto(document.getElementById('mh-challenge'), 'hacking-simulator');
    MatrixBest.renderStreakInto(document.getElementById('mh-streak'));
}

function finishRun() {
    if (!gameActive) return;
    gameActive = false;
    finalScoreDisplay.textContent = score;
    endScreen.classList.remove('mh-hidden');
    terminalInput.disabled = true;
    startBtn.disabled = false;
    addLine('');
    addLine('Run finished. Final score: ' + score, 'system-line');
    // Competitive Phase 1: record the run (best, board, daily challenge).
    if (window.MatrixBest) {
        const out = MatrixBest.finishRun('hacking-simulator', { score: score }, {
            durationSec: (Date.now() - mhRunStart) / 1000,
            runId: mhRunId,
            scoreText: String(score)
        });
        if (bestDisplay && out.best.best) bestDisplay.textContent = out.best.best.score;
    }
}

let score = 0;
let level = 1;
let totalAttempts = 0;
let successfulAttempts = 0;
let currentTarget = '';
let gameActive = false;

const codeSequences = [
    'SYSTEM.ACCESS',
    'ROOT.OVERRIDE',
    'FIREWALL.BYPASS',
    'ENCRYPTION.DECRYPT',
    'DATABASE.QUERY',
    'KERNEL.INJECT',
    'NETWORK.SCAN',
    'ADMIN.PRIVILEGE',
    'PROTOCOL.BREACH',
    'MATRIX.ENTER',
    'CIPHER.BREAK',
    'MAINFRAME.ACCESS',
    'SECURITY.DISABLE',
    'BACKDOOR.OPEN',
    'TRACE.EVADE',
    'PASSWORD.CRACK',
    'AUTHENTICATION.BYPASS',
    'UPLOAD.VIRUS',
    'DOWNLOAD.DATA',
    'EXECUTE.COMMAND'
];

const hackingMessages = [
    'Bypassing security protocols...',
    'Decrypting access codes...',
    'Breaching firewall layer...',
    'Accessing mainframe...',
    'Establishing backdoor...',
    'Gaining root access...',
    'Uploading exploit...',
    'Scanning for vulnerabilities...',
    'Injecting payload...',
    'Escalating privileges...'
];

function addLine(text, className = '') {
    const line = document.createElement('div');
    line.className = `terminal-line ${className}`;
    line.textContent = text;
    terminalOutput.appendChild(line);
    terminalOutput.scrollTop = terminalOutput.scrollHeight;
}

function addTargetLine(text) {
    const line = document.createElement('div');
    line.className = 'terminal-line';
    line.innerHTML = `[TARGET] >>> <span class="target-code">${text}</span>`;
    terminalOutput.appendChild(line);
    terminalOutput.scrollTop = terminalOutput.scrollHeight;
}

function getRandomSequence() {
    return codeSequences[Math.floor(Math.random() * codeSequences.length)];
}

function getRandomMessage() {
    return hackingMessages[Math.floor(Math.random() * hackingMessages.length)];
}

function startGame() {
    mhNewRun();
    endScreen.classList.add('mh-hidden');
    gameActive = true;
    score = 0;
    level = 1;
    totalAttempts = 0;
    successfulAttempts = 0;
    
    terminalOutput.innerHTML = '';
    updateStats();
    
    addLine('='.repeat(50), 'system-line');
    addLine('MATRIX HACKING SYSTEM v3.14', 'system-line');
    addLine('='.repeat(50), 'system-line');
    addLine('');
    addLine('Initializing connection...');
    
    setTimeout(() => {
        addLine('Connection established.', 'success-line');
        addLine('');
        nextChallenge();
    }, 1000);
    
    startBtn.disabled = true;
    terminalInput.disabled = false;
    terminalInput.focus();
    missionText.textContent = 'Type the code sequences exactly as shown to hack the system!';
}

function nextChallenge() {
    if (!gameActive) return;
    
    currentTarget = getRandomSequence();
    addLine('');
    addLine(getRandomMessage(), 'system-line');
    addTargetLine(currentTarget);
    terminalInput.value = '';
    terminalInput.focus();
}

function checkInput() {
    const input = terminalInput.value.trim();
    
    if (!input) return;
    
    totalAttempts++;
    addLine(`> ${input}`);
    
    if (input === currentTarget) {
        successfulAttempts++;
        const points = level * 10;
        score += points;
        
        addLine(`✓ ACCESS GRANTED! +${points} points`, 'success-line');
        
        if (successfulAttempts % 5 === 0) {
            level++;
            addLine('', 'system-line');
            addLine(`>>> LEVEL UP! NOW AT LEVEL ${level} <<<`, 'success-line');
            addLine('', 'system-line');
        }
        
        updateStats();
        
        setTimeout(() => {
            nextChallenge();
        }, 1000);
        
    } else {
        addLine('✗ ACCESS DENIED! Incorrect sequence.', 'error-line');
        updateStats();
        terminalInput.value = '';
    }
}

function updateStats() {
    scoreDisplay.textContent = score;
    levelDisplay.textContent = level;
    
    const accuracy = totalAttempts > 0 
        ? Math.round((successfulAttempts / totalAttempts) * 100) 
        : 100;
    accuracyDisplay.textContent = accuracy + '%';
}

function restartGame() {
    endScreen.classList.add('mh-hidden');
    gameActive = false;
    terminalOutput.innerHTML = '';
    terminalInput.value = '';
    startBtn.disabled = false;
    terminalInput.disabled = true;
    missionText.textContent = 'Type the highlighted code sequences as they appear to hack into the system...';
    score = 0;
    level = 1;
    totalAttempts = 0;
    successfulAttempts = 0;
    updateStats();
}

// Event listeners
startBtn.addEventListener('click', startGame);
restartBtn.addEventListener('click', restartGame);
finishBtn.addEventListener('click', finishRun);
playAgainBtn.addEventListener('click', startGame);

terminalInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && gameActive) {
        checkInput();
    }
});

// Initialize
terminalInput.disabled = true;
updateStats();

// Boot sequence on load
window.addEventListener('load', () => {
    addLine('System ready. Click START HACKING to begin.', 'system-line');
});
