import React, { useEffect, useState } from 'react';
import { SlotsEngine } from './SlotsEngine';
import type { BetResult, SlotsBetStatus } from '../../utils/casinoBet';
import { Casino } from '../../config/casino';

interface SlotsGameProps {
  walletAddress?: string;
  mtxBalance: number;
  placeSlotsBet: (amount: number) => Promise<BetResult>;
  getSlotsBetStatus: (betId: string) => Promise<SlotsBetStatus>;
  claimPayout: (betId: string) => Promise<string>;
  refreshBalance: () => void;
  onBetPlaced?: (amount: number) => void;
}

const statusStorageKey = (walletAddress: string): string =>
  `matrixhub:slots:activeBet:${walletAddress.toLowerCase()}`;

const explorerBase = Casino.chainId === 80002
  ? 'https://amoy.polygonscan.com'
  : 'https://polygonscan.com';

const PAYTABLE: Array<{ symbols: [number, number, number]; label: string; multiplier: number }> = [
  { symbols: [0, 0, 0], label: 'SEVEN · SEVEN · SEVEN', multiplier: 100 },
  { symbols: [1, 1, 1], label: 'BAR · BAR · BAR', multiplier: 100 },
  { symbols: [2, 2, 2], label: 'BELL · BELL · BELL', multiplier: 40 },
  { symbols: [3, 3, 3], label: 'PLUM · PLUM · PLUM', multiplier: 25 },
  { symbols: [4, 4, 4], label: 'LEMON · LEMON · LEMON', multiplier: 15 },
  { symbols: [5, 5, 5], label: 'CHERRY · CHERRY · CHERRY', multiplier: 12 },
];

export default function SlotsGame({
  walletAddress,
  mtxBalance = 0,
  placeSlotsBet,
  getSlotsBetStatus,
  claimPayout,
  refreshBalance,
  onBetPlaced,
}: SlotsGameProps) {
  const [settled, setSettled] = useState<SlotsBetStatus | null>(null);
  const [betStatus, setBetStatus] = useState<SlotsBetStatus['status'] | 'idle'>('idle');
  const [activeBetId, setActiveBetId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [statusRetry, setStatusRetry] = useState(0);
  const [error, setError] = useState('');
  const [txHash, setTxHash] = useState('');
  const [claimTxHash, setClaimTxHash] = useState('');

  const claimable = betStatus === 'settled' && settled?.win === true;

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
    if (!activeBetId || betStatus === 'settled' || betStatus === 'claimed' || betStatus === 'refunded') return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const refreshStatus = async () => {
      setCheckingStatus(true);
      try {
        const snapshot = await getSlotsBetStatus(activeBetId);
        if (cancelled) return;
        setBetStatus(snapshot.status);
        if (snapshot.status !== 'pending') {
          setSettled(snapshot);
          if (snapshot.status === 'settled' && !snapshot.win && walletAddress) {
            window.sessionStorage.removeItem(statusStorageKey(walletAddress));
          }
          if (snapshot.status === 'refunded' && walletAddress) {
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
  }, [activeBetId, betStatus, getSlotsBetStatus, walletAddress, statusRetry]);

  async function handleSpin() {
    if (!walletAddress) {
      setError('Please connect your wallet first.');
      return;
    }
    if (betStatus === 'pending' || claimable) {
      setError('Settle or claim your current spin before placing another.');
      return;
    }
    if (Number(mtxBalance) <= 0) {
      setError('You need MTX to play. Buy MTX first.');
      return;
    }
    const betError = SlotsEngine.validateBet(SlotsEngine.BET_AMOUNT);
    if (betError) {
      setError(betError);
      return;
    }
    if (mtxBalance < SlotsEngine.BET_AMOUNT) {
      setError(`Insufficient MTX balance. Need ${SlotsEngine.BET_AMOUNT} MTX.`);
      return;
    }

    setError('');
    setTxHash('');
    setClaimTxHash('');
    setSettled(null);
    setBetStatus('idle');
    setLoading(true);

    try {
      const bet = await placeSlotsBet(SlotsEngine.BET_AMOUNT);
      setTxHash(bet.txHash);
      setActiveBetId(bet.betId);
      setBetStatus('pending');
      window.sessionStorage.setItem(statusStorageKey(walletAddress), bet.betId);
      onBetPlaced?.(SlotsEngine.BET_AMOUNT);
      await refreshBalance();
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : 'Failed to submit the VRF-backed slots bet.');
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

  const reelEmojis = settled?.symbols
    ? settled.symbols.map((symbol) => SlotsEngine.symbolEmoji(symbol))
    : ['❓', '❓', '❓'];

  return (
    <div className="max-w-3xl mx-auto p-6 bg-gray-900 rounded-lg border-2 border-green-500">
      <h2 className="text-3xl font-bold text-green-400 mb-4 text-center">🎰 Slots</h2>

      {/* Honest state: Slots is built and proven on the Amoy testnet
          (mock VRF) but is NOT live on Polygon mainnet — the mainnet
          CasinoCore does not expose placeSlotsBet yet. */}
      <div className="mb-6 p-4 rounded bg-yellow-900/60 border border-yellow-500 text-center">
        <p className="text-yellow-200 font-semibold">Slots is in build — not live on Polygon mainnet</p>
        <p className="text-sm text-yellow-100/80 mt-1">
          Spins settle on-chain through CasinoCore + Chainlink VRF where the Slots contract is
          deployed (currently the Polygon Amoy testnet only). Testnet spins use a mock VRF and
          test MTX — they prove the mechanics, not fairness, and carry no value.
        </p>
      </div>

      <div className="mb-6 text-center">
        <p className="text-gray-300 mb-2">Slots v1: {SlotsEngine.BET_AMOUNT} MTX per spin · RTP 95.45%</p>
        <p className="text-yellow-400 font-semibold">Your balance: {mtxBalance.toFixed(2)} MTX</p>
      </div>

      {/* Reels Display */}
      <div className="bg-black p-8 rounded-lg mb-6 flex justify-center items-center gap-4">
        {reelEmojis.map((emoji, i) => (
          <div key={i} className="text-6xl">{emoji}</div>
        ))}
      </div>
      {settled?.symbols && (
        <p className="text-center text-gray-400 text-sm -mt-4 mb-6">
          {settled.symbols.map((symbol) => SlotsEngine.symbolName(symbol)).join(' · ')}
          {settled.reels ? ` — stops ${settled.reels.join(', ')}` : ''}
        </p>
      )}

      {betStatus === 'pending' && activeBetId && (
        <div className="text-center mb-4 p-4 rounded bg-blue-900 text-blue-100">
          <p className="text-xl font-semibold">Waiting for the random draw…</p>
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

      {betStatus === 'refunded' && (
        <div className="text-center mb-4 p-4 rounded bg-gray-700 text-gray-100">
          <p className="text-xl font-semibold">Spin refunded</p>
          <p className="mt-1">The draw never arrived, so governance refunded the full stake.</p>
        </div>
      )}

      {settled && betStatus !== 'pending' && betStatus !== 'refunded' && (
        <div className={`text-center mb-4 p-4 rounded ${settled.win ? 'bg-green-900' : 'bg-red-900'}`}>
          {settled.win ? (
            <>
              <p className="text-2xl font-bold text-green-300">YOU WIN</p>
              <p className="text-xl text-green-200">
                {settled.multiplier}x — payout {settled.payout.toFixed(2)} MTX
              </p>
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
            <p className="text-xl font-semibold text-red-300">No winning line. Spin again?</p>
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

      {error && betStatus !== 'pending' && (
        <div className="bg-red-900 text-red-200 p-3 rounded mb-4 text-center">{error}</div>
      )}

      <button
        onClick={handleSpin}
        disabled={loading || !walletAddress || betStatus === 'pending' || claimable}
        className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white font-bold py-4 px-6 rounded-lg text-xl transition-colors"
      >
        {loading ? 'Processing…' : walletAddress ? `🎰 SPIN (${SlotsEngine.BET_AMOUNT} MTX)` : 'Connect wallet to play'}
      </button>

      {/* Payout Table (multipliers of the 1 MTX spin) */}
      <div className="mt-6 p-4 bg-gray-800 rounded">
        <h3 className="text-lg font-semibold text-green-400 mb-2">Payouts (x your spin)</h3>
        <div className="text-sm text-gray-300 space-y-1">
          {PAYTABLE.map((row) => (
            <div key={row.label} className="flex justify-between">
              <span>{row.symbols.map((s) => SlotsEngine.symbolEmoji(s)).join(' ')} <span className="text-gray-500">{row.label}</span></span>
              <span>{row.multiplier}x</span>
            </div>
          ))}
          <div className="flex justify-between">
            <span>🍒 🍒 <span className="text-gray-500">CHERRY · CHERRY on reels 1–2 only</span></span>
            <span>1x (stake back)</span>
          </div>
        </div>
      </div>

      <div className="mt-6 p-4 bg-gray-800 rounded">
        <h3 className="text-lg font-semibold text-green-400 mb-2">How to Play</h3>
        <ul className="text-sm text-gray-300 space-y-1 list-disc list-inside">
          <li>One spin costs exactly 1 MTX in v1 (the 100x top prize is bounded by the 100 MTX per-bet payout cap).</li>
          <li>One VRF word lands all three reels: word % 20, (word / 20) % 20, (word / 400) % 20 against a public 20-stop strip.</li>
          <li>Three of a kind pays per the table; two CHERRY pays stake back only on reels 1–2.</li>
          <li>Winning MTX is claimed after settlement; pending spins cannot be cancelled.</li>
          <li>If the draw never arrives, a spin still pending after 1 hour can be refunded in full by governance.</li>
        </ul>
      </div>
    </div>
  );
}
