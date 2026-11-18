import React, { useRef, useState } from 'react';
import {
  PAYTABLE,
  evaluatePokerHand,
  payoutFor,
  suggestHolds,
  type PokerEval,
} from './VideoPokerEngine';
import { type Card, buildDeck, defaultRng, shuffled } from './cards';
import PlayingCard from './PlayingCard';
import type { TableBankProps } from './BlackjackTable';

type Phase = 'betting' | 'draw' | 'settled';

export default function VideoPokerTable({
  bankroll,
  charge,
  credit,
  record,
}: TableBankProps) {
  const drawPileRef = useRef<Card[]>([]);
  const [cards, setCards] = useState<Card[] | null>(null);
  const [holds, setHolds] = useState<boolean[]>([
    false, false, false, false, false,
  ]);
  const [phase, setPhase] = useState<Phase>('betting');
  const [betCoins, setBetCoins] = useState(1);
  const [result, setResult] = useState<PokerEval | null>(null);
  const [payout, setPayout] = useState(0);
  const [notice, setNotice] = useState('');

  function deal(coins: number) {
    if (!charge(coins)) {
      setNotice('Not enough play credits for that bet — lower it, or reset the bankroll above.');
      return;
    }
    setNotice('');
    const deck = shuffled(buildDeck(), defaultRng);
    setCards(deck.slice(0, 5));
    drawPileRef.current = deck.slice(5);
    setHolds([false, false, false, false, false]);
    setResult(null);
    setPayout(0);
    setPhase('draw');
  }

  function draw() {
    if (!cards) return;
    const next = cards.map((c, i) =>
      holds[i] ? c : drawPileRef.current.pop()!,
    );
    const evaluation = evaluatePokerHand(next);
    const pay = payoutFor(evaluation.category, betCoins);
    setCards(next);
    setResult(evaluation);
    setPayout(pay);
    if (pay > 0) credit(pay);
    record('poker', pay - betCoins);
    setPhase('settled');
  }

  function toggleHold(i: number) {
    if (phase !== 'draw') return;
    setHolds((h) => h.map((v, idx) => (idx === i ? !v : v)));
  }

  const canAffordBet = bankroll >= betCoins;

  return (
    <div className="bg-gradient-to-b from-green-950 via-[#0a2e1f] to-black border border-green-500/40 rounded-xl p-4 sm:p-6">
      <div className="flex items-baseline justify-between flex-wrap gap-2 mb-1">
        <h3 className="text-2xl font-bold text-green-400">
          Video Poker — Jacks or Better
        </h3>
        <p className="text-xs text-gray-400">Full-pay 9/6 table · 1–5 credits per hand</p>
      </div>
      <p className="text-xs text-yellow-200/80 mb-4">
        Free practice table — play credits only. Nothing here is wagered and
        nothing can be won or lost.
      </p>

      {/* Paytable */}
      <div className="overflow-x-auto mb-5">
        <table className="w-full text-xs sm:text-sm border-collapse">
          <thead>
            <tr className="text-gray-400">
              <th className="text-left py-1 pr-2 font-normal">Hand</th>
              {[1, 2, 3, 4, 5].map((n) => (
                <th
                  key={n}
                  className={`text-right py-1 px-2 font-normal ${
                    betCoins === n ? 'text-yellow-300 font-bold' : ''
                  }`}
                >
                  {n} {n === 1 ? 'coin' : 'coins'}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PAYTABLE.map((row) => {
              const isWin = result?.category === row.category && phase === 'settled';
              return (
                <tr
                  key={row.category}
                  className={
                    isWin
                      ? 'bg-yellow-400 text-black font-bold'
                      : 'text-gray-300'
                  }
                >
                  <td className="py-1 pr-2">{row.label}</td>
                  {row.pays.map((p, i) => (
                    <td
                      key={i}
                      className={`text-right py-1 px-2 ${
                        betCoins === i + 1 && !isWin
                          ? 'bg-yellow-500/15 text-yellow-200'
                          : ''
                      }`}
                    >
                      {p}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Cards — always one row of five, including on phones */}
      <div className="max-w-xl mx-auto mb-2">
        <div className="flex gap-1.5 sm:gap-3">
          {(cards ?? [null, null, null, null, null]).map((c, i) => (
            <button
              key={i}
              onClick={() => toggleHold(i)}
              disabled={phase !== 'draw'}
              className="flex-1 min-w-0 relative focus:outline-none"
              aria-label={
                c
                  ? `Card ${i + 1}: ${c.rank} of ${c.suit}${holds[i] ? ' (held)' : ''}`
                  : `Card slot ${i + 1}`
              }
            >
              <PlayingCard card={c ?? undefined} />
              {phase !== 'betting' && holds[i] && (
                <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-yellow-400 text-black text-[0.6rem] sm:text-xs font-bold px-1.5 py-0.5 rounded">
                  HELD
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
      <p className="text-center text-xs text-gray-500 mb-4 h-4">
        {phase === 'draw'
          ? 'Tap cards to hold them, then draw.'
          : phase === 'betting'
            ? 'Choose your bet and deal.'
            : ' '}
      </p>

      {notice && <p className="text-sm text-red-400 mb-4 text-center">{notice}</p>}

      {phase === 'settled' && result && (
        <p
          className={`text-center text-lg font-bold mb-4 ${
            payout > 0 ? 'text-yellow-300' : 'text-gray-400'
          }`}
        >
          {payout > 0
            ? `${result.label} — pays ${payout} credits`
            : 'No win this hand'}
        </p>
      )}

      {/* Controls */}
      {phase !== 'draw' && (
        <div className="flex gap-3 flex-wrap justify-center">
          <button
            onClick={() => setBetCoins((b) => (b >= 5 ? 1 : b + 1))}
            className="px-5 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-100 border border-white/25 font-bold rounded-lg"
          >
            Bet One ({betCoins})
          </button>
          <button
            onClick={() => {
              setBetCoins(5);
              deal(5);
            }}
            disabled={bankroll < 5}
            className="px-5 py-2.5 bg-gray-800 hover:bg-gray-700 disabled:bg-gray-800 disabled:text-gray-500 text-yellow-300 border border-yellow-500/50 font-bold rounded-lg"
          >
            Bet Max &amp; Deal
          </button>
          <button
            onClick={() => deal(betCoins)}
            disabled={!canAffordBet}
            className="px-6 py-2.5 bg-green-500 hover:bg-green-400 disabled:bg-gray-700 disabled:text-gray-400 text-black font-bold rounded-lg"
          >
            Deal ({betCoins} {betCoins === 1 ? 'credit' : 'credits'})
          </button>
        </div>
      )}

      {phase === 'draw' && (
        <div className="flex gap-3 flex-wrap justify-center">
          <button
            onClick={() => cards && setHolds(suggestHolds(cards))}
            className="px-5 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-lg"
          >
            💡 Suggest Holds
          </button>
          <button
            onClick={draw}
            className="px-8 py-2.5 bg-green-500 hover:bg-green-400 text-black font-bold rounded-lg"
          >
            Draw
          </button>
        </div>
      )}
    </div>
  );
}
