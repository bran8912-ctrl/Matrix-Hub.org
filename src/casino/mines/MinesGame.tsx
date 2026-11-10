import React, { useState } from 'react';
import { MinesEngine, type MinesGameState, type MinesResult } from './MinesEngine';
import { type BetResult } from '../../utils/casinoBet';

interface MinesGameProps {
  walletAddress?: string;
  mtxBalance: number;
  placeBet?: (amount: number, gameData?: string) => Promise<BetResult>;
  refreshBalance?: () => void;
  onBetPlaced?: (amount: number) => void;
}

export default function MinesGame({ mtxBalance = 0, refreshBalance: _refreshBalance }: MinesGameProps) {
  const [betAmount, setBetAmount] = useState(MinesEngine.BET_AMOUNT);
  const [numMines, setNumMines] = useState(5);
  const [gameState, setGameState] = useState<MinesGameState | null>(null);
  const [lastResult, setLastResult] = useState<MinesResult | null>(null);
  const [error, setError] = useState('');

  // G-05 (2026-11-10): Mines is DISABLED with real funds. There is no
  // on-chain Mines settlement, so this component must never place a bet or
  // start a local Math.random board with MTX at stake. The previous code had
  // an off-chain / transfer-fallback path (local random game) and an
  // "on-chain mode" branch that started a local board after a Dice bet —
  // both have been removed entirely. This function now only explains why the
  // game cannot start. Remove this guard only when a VRF-backed on-chain
  // Mines flow exists (new contract work + audit). The placeBet/onBetPlaced
  // props are accepted for interface compatibility and deliberately ignored.
  async function startNewGame() {
    setError(
      'Mines is disabled until game actions and payouts are settled on-chain. ' +
      'No bet was placed and no MTX moved.'
    );
  }

  function revealCell(cellIndex: number) {
    if (!gameState || gameState.gameOver) return;

    try {
      const result = MinesEngine.revealCell(gameState, cellIndex, betAmount);
      setLastResult(result);
      setGameState({ ...gameState });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'An error occurred');
    }
  }

  function cashOut() {
    if (!gameState || gameState.gameOver) return;

    try {
      const payout = MinesEngine.cashOut(gameState, betAmount);
      setLastResult({
        cellIndex: -1,
        isMine: false,
        gameOver: true,
        won: true,
        currentMultiplier: gameState.currentMultiplier,
        payout,
      });
      setGameState({ ...gameState });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'An error occurred');
    }
  }

  function renderCell(index: number) {
    if (!gameState) return null;

    const isRevealed = gameState.revealedCells[index];
    const isMine = gameState.minePositions.has(index);
    const showMine = isRevealed && isMine;
    const showSafe = isRevealed && !isMine;
    const canClick = gameState && !gameState.gameOver && !isRevealed;

    return (
      <button
        key={index}
        onClick={() => revealCell(index)}
        disabled={!canClick}
        className={`
          w-16 h-16 rounded border-2 font-bold text-xl transition-all
          ${showMine ? 'bg-red-600 border-red-700' : ''}
          ${showSafe ? 'bg-green-600 border-green-700' : ''}
          ${!isRevealed ? 'bg-gray-700 border-gray-600 hover:bg-gray-600' : ''}
          ${canClick ? 'cursor-pointer' : 'cursor-not-allowed'}
        `}
      >
        {showMine && '💣'}
        {showSafe && '💎'}
      </button>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-6 bg-gray-900 rounded-lg border-2 border-green-500">
      <h2 className="text-3xl font-bold text-green-400 mb-4 text-center">💣 Mines</h2>
      
      <div className="mb-6 text-center">
        <p className="text-gray-300 mb-2">Minimum bet: {MinesEngine.BET_AMOUNT} MTX</p>
        <p className="text-yellow-400 font-semibold">Your balance: {mtxBalance.toFixed(2)} MTX</p>
      </div>

      {/* Disabled notice — Mines has no on-chain settlement (G-05). */}
      <div className="mb-6 p-4 bg-yellow-900 border-2 border-yellow-500 rounded-lg text-center">
        <p className="text-yellow-300 font-bold">⛔ Mines is disabled</p>
        <p className="text-yellow-100 text-sm mt-1">
          Mines has no on-chain settlement yet — game actions and payouts must be settled on-chain before it can accept MTX. No bet can be placed from this page.
        </p>
      </div>

      {/* Game Status */}
      {gameState && (
        <div className="bg-gray-800 p-4 rounded-lg mb-4 text-center">
          <div className="text-2xl font-bold text-green-400 mb-2">
            {gameState.currentMultiplier.toFixed(2)}x
          </div>
          <div className="text-sm text-gray-300">
            Potential payout: {(betAmount * gameState.currentMultiplier).toFixed(2)} MTX
          </div>
        </div>
      )}

      {/* Result Display */}
      {lastResult?.gameOver && (
        <div className={`text-center mb-4 p-4 rounded ${lastResult.won ? 'bg-green-900' : 'bg-red-900'}`}>
          {lastResult.won ? (
            <>
              <p className="text-2xl font-bold text-green-300">🎉 CASHED OUT! 🎉</p>
              <p className="text-xl text-green-200">
                Won {lastResult.payout.toFixed(2)} MTX at {lastResult.currentMultiplier.toFixed(2)}x
              </p>
            </>
          ) : (
            <>
              <p className="text-2xl font-bold text-red-300">💥 BOOM!</p>
              <p className="text-xl text-red-200">Hit a mine! Better luck next time.</p>
            </>
          )}
        </div>
      )}

      {/* Game Grid */}
      {gameState ? (
        <div className="mb-4">
          <div className="grid grid-cols-5 gap-2 justify-center mb-4">
            {Array.from({ length: MinesEngine.GRID_SIZE }, (_, i) => renderCell(i))}
          </div>
          
          {!gameState.gameOver && (
            <button
              onClick={cashOut}
              className="w-full bg-yellow-600 hover:bg-yellow-700 text-white font-bold py-3 px-6 rounded-lg text-lg transition-colors"
            >
              💰 CASH OUT ({(betAmount * gameState.currentMultiplier).toFixed(2)} MTX)
            </button>
          )}
        </div>
      ) : (
        <div className="bg-gray-800 p-8 rounded-lg mb-4">
          <div className="grid grid-cols-5 gap-2 mb-4">
            {Array.from({ length: 25 }, (_, i) => (
              <div key={i} className="w-16 h-16 bg-gray-700 rounded border-2 border-gray-600"></div>
            ))}
          </div>
        </div>
      )}

      {/* Setup Controls (only show when no active game) */}
      {!gameState || gameState.gameOver ? (
        <div className="bg-gray-800 p-4 rounded-lg mb-4 space-y-4">
          <div>
            <label className="block text-gray-300 mb-2">Bet Amount (MTX)</label>
            <input
              type="number"
              min={MinesEngine.BET_AMOUNT}
              step={0.5}
              value={betAmount}
              onChange={(e) => setBetAmount(Math.max(MinesEngine.BET_AMOUNT, Number(e.target.value)))}
              className="w-full bg-gray-700 text-white px-4 py-2 rounded border border-gray-600"
            />
          </div>

          <div>
            <label className="block text-gray-300 mb-2">
              Number of Mines: {numMines}
            </label>
            <input
              type="range"
              min={MinesEngine.MIN_MINES}
              max={MinesEngine.MAX_MINES}
              value={numMines}
              onChange={(e) => setNumMines(Number(e.target.value))}
              className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
            />
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>Low Risk</span>
              <span>High Risk</span>
            </div>
          </div>
        </div>
      ) : null}

      {/* Error Display */}
      {error && (
        <div className="bg-red-900 text-red-200 p-3 rounded mb-4 text-center">
          {error}
        </div>
      )}

      {/* Start/Restart Button — permanently disabled until on-chain Mines exists (G-05). */}
      {(!gameState || gameState.gameOver) && (
        <button
          onClick={startNewGame}
          disabled
          title="Mines is disabled until game actions and payouts are settled on-chain."
          className="w-full bg-gray-600 text-white font-bold py-4 px-6 rounded-lg text-xl transition-colors cursor-not-allowed"
        >
          ⛔ MINES DISABLED — NO ON-CHAIN SETTLEMENT YET
        </button>
      )}

      {/* Info */}
      <div className="mt-6 p-4 bg-gray-800 rounded">
        <h3 className="text-lg font-semibold text-green-400 mb-2">How to Play</h3>
        <ul className="text-sm text-gray-300 space-y-1 list-disc list-inside">
          <li>Choose bet amount and number of mines</li>
          <li>Click cells to reveal safe gems (💎)</li>
          <li>Avoid mines (💣)!</li>
          <li>Each safe reveal increases your multiplier</li>
          <li>Cash out anytime to claim your winnings</li>
          <li>More mines = higher risk = bigger multipliers</li>
        </ul>
      </div>
    </div>
  );
}
