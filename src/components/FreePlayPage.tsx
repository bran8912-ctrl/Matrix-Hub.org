import React, { useRef, useState } from 'react';
import BlackjackTable from '../casino/freeplay/BlackjackTable';
import VideoPokerTable from '../casino/freeplay/VideoPokerTable';

// Free-Play Floor shell: one shared play-credit bankroll and one session
// stats strip across both practice tables. Play credits have no value —
// no wallet is connected and no MTX is involved anywhere on this floor.
// Composition lives in this client module (never as .astro render props)
// so both tables ship in the client bundle — the Dice blank-page lesson.

const STARTING_BANKROLL = 1000;

type Tab = 'blackjack' | 'poker';

interface GameStats {
  rounds: number;
  net: number;
}

function initialTab(): Tab {
  if (typeof window !== 'undefined') {
    const hash = window.location.hash.toLowerCase();
    if (hash.includes('poker')) return 'poker';
    if (hash.includes('blackjack')) return 'blackjack';
  }
  return 'blackjack';
}

export default function FreePlayPage() {
  const [bankroll, setBankroll] = useState(STARTING_BANKROLL);
  const bankrollRef = useRef(STARTING_BANKROLL);
  const [tab, setTab] = useState<Tab>(initialTab);
  const [stats, setStats] = useState<Record<Tab, GameStats>>({
    blackjack: { rounds: 0, net: 0 },
    poker: { rounds: 0, net: 0 },
  });

  const charge = (amount: number): boolean => {
    if (amount > bankrollRef.current) return false;
    bankrollRef.current -= amount;
    setBankroll(bankrollRef.current);
    return true;
  };

  const credit = (amount: number): void => {
    bankrollRef.current += amount;
    setBankroll(bankrollRef.current);
  };

  const record = (game: Tab, net: number): void => {
    setStats((s) => ({
      ...s,
      [game]: { rounds: s[game].rounds + 1, net: s[game].net + net },
    }));
  };

  const reset = (): void => {
    bankrollRef.current = STARTING_BANKROLL;
    setBankroll(STARTING_BANKROLL);
    setStats({
      blackjack: { rounds: 0, net: 0 },
      poker: { rounds: 0, net: 0 },
    });
  };

  const selectTab = (t: Tab): void => {
    setTab(t);
    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', `#${t === 'poker' ? 'video-poker' : 'blackjack'}`);
    }
  };

  const fmtNet = (n: number) => (n > 0 ? `+${n}` : `${n}`);

  return (
    <div>
      {/* Bankroll + session stats */}
      <div className="bg-gray-800 border border-green-500/40 rounded-lg p-4 mb-6 flex flex-wrap items-center gap-x-6 gap-y-2">
        <div>
          <span className="text-gray-400 text-sm block">Play bankroll</span>
          <span className="text-2xl font-bold text-yellow-300">
            {bankroll.toLocaleString()} credits
          </span>
        </div>
        <div className="text-sm text-gray-300">
          <span className="text-gray-400">Blackjack:</span>{' '}
          {stats.blackjack.rounds} rounds · net {fmtNet(stats.blackjack.net)}
        </div>
        <div className="text-sm text-gray-300">
          <span className="text-gray-400">Video Poker:</span>{' '}
          {stats.poker.rounds} hands · net {fmtNet(stats.poker.net)}
        </div>
        <button
          onClick={reset}
          className="ml-auto px-4 py-2 bg-gray-900 hover:bg-black text-green-300 border border-green-500/50 text-sm font-bold rounded-lg"
        >
          Reset to 1,000
        </button>
        {bankroll < 5 && (
          <p className="w-full text-sm text-yellow-200">
            Out of play credits? Reset the bankroll — it&apos;s free,
            that&apos;s the point of the floor.
          </p>
        )}
      </div>

      {/* Table tabs */}
      <div className="flex gap-2 mb-6" role="tablist" aria-label="Free-play tables">
        <button
          role="tab"
          aria-selected={tab === 'blackjack'}
          onClick={() => selectTab('blackjack')}
          className={`px-5 py-2.5 rounded-lg font-bold border ${
            tab === 'blackjack'
              ? 'bg-green-500 text-black border-green-500'
              : 'bg-gray-800 text-gray-200 border-white/20 hover:bg-gray-700'
          }`}
        >
          🃏 Blackjack
        </button>
        <button
          role="tab"
          aria-selected={tab === 'poker'}
          onClick={() => selectTab('poker')}
          className={`px-5 py-2.5 rounded-lg font-bold border ${
            tab === 'poker'
              ? 'bg-green-500 text-black border-green-500'
              : 'bg-gray-800 text-gray-200 border-white/20 hover:bg-gray-700'
          }`}
        >
          🎴 Video Poker
        </button>
      </div>

      {tab === 'blackjack' ? (
        <BlackjackTable
          bankroll={bankroll}
          charge={charge}
          credit={credit}
          record={record}
        />
      ) : (
        <VideoPokerTable
          bankroll={bankroll}
          charge={charge}
          credit={credit}
          record={record}
        />
      )}
    </div>
  );
}
