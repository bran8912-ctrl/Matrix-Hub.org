import React, { useEffect, useState } from 'react';
import { DiceEngine, type DiceResult } from './DiceEngine';
import type { BetResult, BetStatus } from '../../utils/casinoBet';
import { Casino } from '../../config/casino';

interface DiceGameProps {
  walletAddress?: string;
  mtxBalance: number;
  placeBet: (amount: number, target: number) => Promise<BetResult>;
  getBetStatus: (betId: string) => Promise<BetStatus>;
  claimPayout: (betId: string) => Promise<string>;
  refreshBalance: () => void;
  onBetPlaced?: (amount: number) => void;
}

const statusStorageKey = (walletAddress: string): string =>
  `matrixhub:dice:activeBet:${walletAddress.toLowerCase()}`;

const explorerBase = Casino.chainId === 80002
  ? 'https://amoy.polygonscan.com'
  : 'https://polygonscan.com';

export default function DiceGame({
  walletAddress,
  mtxBalance = 0,
  placeBet,
  getBetStatus,
  claimPayout,
  refreshBalance,
  onBetPlaced,
}: DiceGameProps) {
  const [betAmount, setBetAmount] = useState(DiceEngine.BET_AMOUNT);
  const [target, setTarget] = useState(50);
  const [result, setResult] = useState<DiceResult | null>(null);
  const [betStatus, setBetStatus] = useState<BetStatus['status'] | 'idle'>('idle');
  const [activeBetId, setActiveBetId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [statusRetry, setStatusRetry] = useState(0);
  const [error, setError] = useState('');
  const [txHash, setTxHash] = useState('');
  const [claimTxHash, setClaimTxHash] = useState('');

  const multiplier = DiceEngine.calculateMultiplier(target);
  const winChance = ((target - 1) / 100) * 100;
  const claimable = betStatus === 'settled' && result?.win === true;

  useEffect(() => {
    if (!walletAddress) {
      setActiveBetId(null);
      setBetStatus('idle');
      return;
    }
    const storedBetId = window.sessionStorage.getItem(statusStorageKey(walletAddress));
    if (storedBetId) {
      setActiveBetId(storedBetId);
      setBetStatus('pending');
    }
  }, [walletAddress]);

  useEffect(() => {
    if (!activeBetId || betStatus === 'settled' || betStatus === 'claimed') return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const refreshStatus = async () => {
      setCheckingStatus(true);
      try {
        const snapshot = await getBetStatus(activeBetId);
        if (cancelled) return;
        setBetStatus(snapshot.status);
        if (snapshot.status !== 'pending') {
          setResult({
            roll: snapshot.roll,
            target: snapshot.target,
            win: snapshot.win,
            payout: snapshot.payout,
          });
          if (snapshot.status === 'settled' && !snapshot.win && walletAddress) {
            window.sessionStorage.removeItem(statusStorageKey(walletAddress));
          }
        } else {
          timer = setTimeout(refreshStatus, 5000);
        }
        setError('');
      } catch (cause: unknown) {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : 'Could not check the on-chain bet status.');
          timer = setTimeout(refreshStatus, 5000);
        }
      } finally {
        if (!cancelled) setCheckingStatus(false);
      }
    };

    void refreshStatus();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [activeBetId, betStatus, getBetStatus, walletAddress, statusRetry]);

  async function handleRoll() {
    if (!walletAddress) {
      setError('Please connect your wallet first.');
      return;
    }
    if (betStatus === 'pending' || claimable) {
      setError('Settle or claim your current bet before placing another.');
      return;
    }
    if (Number(mtxBalance) <= 0) {
      setError('You need MTX to play. Buy MTX first.');
      return;
    }

    const betError = DiceEngine.validateBet(betAmount, target);
    if (betError) {
      setError(betError);
      return;
    }
    if (mtxBalance < betAmount) {
      setError(`Insufficient MTX balance. Need ${betAmount} MTX.`);
      return;
    }

    setError('');
    setTxHash('');
    setClaimTxHash('');
    setResult(null);
    setBetStatus('idle');
    setLoading(true);

    try {
      const bet = await placeBet(betAmount, target);
      setTxHash(bet.txHash);
      setActiveBetId(bet.betId);
      setBetStatus('pending');
      window.sessionStorage.setItem(statusStorageKey(walletAddress), bet.betId);
      onBetPlaced?.(betAmount);
      await refreshBalance();
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : 'Failed to submit the VRF-backed dice bet.');
      console.error(cause);
    } finally {
      setLoading(false);
    }
  }

  async function handleClaim() {
    if (!activeBetId || !walletAddress) return;
    setError('');
    setLoading(true);
    try {
      const hash = await claimPayout(activeBetId);
      setClaimTxHash(hash);
      setBetStatus('claimed');
      window.sessionStorage.removeItem(statusStorageKey(walletAddress));
      await refreshBalance();
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : 'Failed to claim the settled MTX payout.');
      console.error(cause);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto p-6 bg-gray-900 rounded-lg border-2 border-green-500">
      <h2 className="text-3xl font-bold text-green-400 mb-4 text-center">Dice</h2>

      <div className="mb-6 text-center">
        <p className="text-gray-300 mb-2">Minimum bet: {DiceEngine.BET_AMOUNT} MTX</p>
        <p className="text-yellow-400 font-semibold">Your balance: {mtxBalance.toFixed(2)} MTX</p>
      </div>

      <div className="bg-black p-8 rounded-lg mb-6 text-center">
        <div className="text-8xl mb-4" aria-hidden="true">🎲</div>
        {result ? (
          <div className="text-6xl font-bold text-white">{result.roll}</div>
        ) : (
          <div className="text-6xl font-bold text-gray-600">?</div>
        )}
      </div>

      {betStatus === 'pending' && activeBetId && (
        <div className="text-center mb-4 p-4 rounded bg-blue-900 text-blue-100">
          <p className="text-xl font-semibold">Waiting for Chainlink VRF</p>
          <p className="mt-1">Bet #{activeBetId} is pending. Its result cannot be cancelled or rerolled.</p>
          {checkingStatus && <p className="mt-2 text-sm">Checking for fulfillment…</p>}
          {error && (
            <button
              onClick={() => setStatusRetry((attempt) => attempt + 1)}
              className="mt-2 underline"
            >
              Retry status check
            </button>
          )}
        </div>
      )}

      {result && (
        <div className={`text-center mb-4 p-4 rounded ${result.win ? 'bg-green-900' : 'bg-red-900'}`}>
          {result.win ? (
            <>
              <p className="text-2xl font-bold text-green-300">YOU WIN</p>
              <p className="text-xl text-green-200">Rolled {result.roll} (under {result.target})</p>
              <p className="text-lg text-green-100">Payout: {result.payout.toFixed(2)} MTX</p>
              {claimable && (
                <button
                  onClick={handleClaim}
                  disabled={loading}
                  className="mt-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white font-bold py-2 px-5 rounded"
                >
                  {loading ? 'Claiming…' : 'Claim MTX payout'}
                </button>
              )}
              {betStatus === 'claimed' && <p className="mt-2">Payout claimed.</p>}
            </>
          ) : (
            <>
              <p className="text-xl font-semibold text-red-300">Bet lost</p>
              <p className="text-lg text-red-200">Rolled {result.roll} (needed under {result.target})</p>
            </>
          )}
        </div>
      )}

      {txHash && (
        <div className="bg-gray-800 text-green-400 p-3 rounded mb-4 text-center text-sm">
          VRF request transaction:{' '}
          <a href={`${explorerBase}/tx/${txHash}`} target="_blank" rel="noopener noreferrer" className="underline">
            View transaction
          </a>
        </div>
      )}

      {claimTxHash && (
        <div className="bg-gray-800 text-green-400 p-3 rounded mb-4 text-center text-sm">
          Payout claim transaction:{' '}
          <a href={`${explorerBase}/tx/${claimTxHash}`} target="_blank" rel="noopener noreferrer" className="underline">
            View transaction
          </a>
        </div>
      )}

      <div className="bg-gray-800 p-4 rounded-lg mb-4 space-y-4">
        <div>
          <label className="block text-gray-300 mb-2">Bet Amount (MTX)</label>
          <input
            type="number"
            min={DiceEngine.BET_AMOUNT}
            step={0.5}
            value={betAmount}
            onChange={(event) => setBetAmount(Math.max(DiceEngine.BET_AMOUNT, Number(event.target.value)))}
            className="w-full bg-gray-700 text-white px-4 py-2 rounded border border-gray-600"
          />
        </div>

        <div>
          <div className="flex justify-between mb-2">
            <label className="text-gray-300">Roll Under: {target}</label>
            <span className="text-green-400 font-semibold">{multiplier.toFixed(2)}x</span>
          </div>
          <input
            type="range"
            min={DiceEngine.MIN_TARGET}
            max={DiceEngine.MAX_TARGET}
            value={target}
            onChange={(event) => setTarget(Number(event.target.value))}
            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
          />
          <div className="flex justify-between text-xs text-gray-400 mt-1">
            <span>{DiceEngine.MIN_TARGET}</span>
            <span className="text-yellow-400">Win chance: {winChance.toFixed(1)}%</span>
            <span>{DiceEngine.MAX_TARGET}</span>
          </div>
        </div>
      </div>

      {error && <div className="bg-red-900 text-red-200 p-3 rounded mb-4 text-center">{error}</div>}

      <button
        onClick={handleRoll}
        disabled={loading || !walletAddress || betStatus === 'pending' || claimable}
        className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white font-bold py-4 px-6 rounded-lg text-xl transition-colors"
      >
        {loading ? 'Processing…' : walletAddress ? `ROLL DICE (${betAmount} MTX)` : 'Connect wallet to play'}
      </button>

      <div className="mt-6 p-4 bg-gray-800 rounded">
        <h3 className="text-lg font-semibold text-green-400 mb-2">How to Play</h3>
        <ul className="text-sm text-gray-300 space-y-1 list-disc list-inside">
          <li>Choose your bet and a target from 2 to 98.</li>
          <li>Chainlink VRF supplies the roll after the bet is confirmed.</li>
          <li>Win if the on-chain roll is lower than your target.</li>
          <li>Winning payouts are 98% RTP before the configured per-bet cap.</li>
          <li>Winning MTX is claimed after settlement; pending bets cannot be cancelled.</li>
        </ul>
      </div>
    </div>
  );
}
