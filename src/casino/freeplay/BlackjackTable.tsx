import React, { useRef, useState } from 'react';
import {
  BlackjackRound,
  RESHUFFLE_AT,
  basicStrategyHint,
  freshShoe,
  handValue,
} from './BlackjackEngine';
import { type Card, defaultRng } from './cards';
import PlayingCard from './PlayingCard';

export interface TableBankProps {
  bankroll: number;
  /** Deduct credits if affordable; returns false (and changes nothing) otherwise. */
  charge: (amount: number) => boolean;
  /** Credit winnings back to the shared play bankroll. */
  credit: (amount: number) => void;
  /** Record a finished round for the session stats strip. */
  record: (game: 'blackjack' | 'poker', net: number) => void;
}

const CHIP_VALUES = [5, 25, 100, 500];
const MIN_BET = 5;

export default function BlackjackTable({
  bankroll,
  charge,
  credit,
  record,
}: TableBankProps) {
  const shoeRef = useRef<Card[]>([]);
  const chargedRef = useRef(0);
  const [round, setRound] = useState<BlackjackRound | null>(null);
  const [, setTick] = useState(0);
  const [pendingBet, setPendingBet] = useState(25);
  const [lastBet, setLastBet] = useState(25);
  const [notice, setNotice] = useState<string>('');
  const [shuffledNote, setShuffledNote] = useState(false);

  const bump = () => setTick((t) => t + 1);
  const inRound = round !== null && round.phase === 'player';
  const settled = round !== null && round.phase === 'settled';

  function finalize(r: BlackjackRound) {
    const back = r.totalCredit();
    if (back > 0) credit(back);
    record('blackjack', back - chargedRef.current);
  }

  function deal(bet: number) {
    if (bet < MIN_BET) {
      setNotice(`Minimum bet is ${MIN_BET} play credits.`);
      return;
    }
    if (shoeRef.current.length < RESHUFFLE_AT) {
      shoeRef.current = freshShoe(defaultRng);
      setShuffledNote(true);
    } else {
      setShuffledNote(false);
    }
    if (!charge(bet)) {
      setNotice('Not enough play credits for that bet — lower it, or reset the bankroll above.');
      return;
    }
    setNotice('');
    chargedRef.current = bet;
    setLastBet(bet);
    const r = new BlackjackRound(shoeRef.current, bet);
    setRound(r);
    if (r.phase === 'settled') finalize(r);
    bump();
  }

  function act(fn: () => void, extraCharge = 0) {
    if (!round) return;
    if (extraCharge > 0) {
      if (!charge(extraCharge)) {
        setNotice('Not enough play credits for that move.');
        return;
      }
      chargedRef.current += extraCharge;
    }
    fn();
    if (round.phase === 'settled') finalize(round);
    bump();
  }

  const activeHand = round?.activeHand;
  const canDoubleHand =
    !!round && !!activeHand && round.canDouble(activeHand) && bankroll >= activeHand.bet;
  const canSplitHand =
    !!round && !!activeHand && round.canSplit(activeHand) && bankroll >= activeHand.bet;
  const hint =
    inRound && activeHand
      ? basicStrategyHint(activeHand.cards, round.dealerUpCard, {
          canDouble: canDoubleHand,
          canSplit: canSplitHand,
        })
      : null;

  const dealerValue = round ? handValue(round.dealerCards) : null;

  return (
    <div className="bg-gradient-to-b from-green-950 via-[#0a2e1f] to-black border border-green-500/40 rounded-xl p-4 sm:p-6">
      <div className="flex items-baseline justify-between flex-wrap gap-2 mb-1">
        <h3 className="text-2xl font-bold text-green-400">Blackjack</h3>
        <p className="text-xs text-gray-400">
          6-deck shoe · dealer stands on all 17s · blackjack pays 3:2
        </p>
      </div>
      <p className="text-xs text-yellow-200/80 mb-4">
        Free practice table — play credits only. Nothing here is wagered and
        nothing can be won or lost.
      </p>

      {/* Dealer */}
      <div className="mb-5">
        <div className="flex items-center gap-3 mb-2">
          <span className="text-sm font-bold text-gray-300 uppercase tracking-wide">
            Dealer
          </span>
          {round && (
            <span className="text-sm text-green-300">
              {settled
                ? `— ${dealerValue!.total}${dealerValue!.soft ? ' (soft)' : ''}`
                : `— showing ${handValue([round.dealerUpCard]).total}`}
            </span>
          )}
        </div>
        <div className="flex gap-2 flex-wrap min-h-[4.5rem]">
          {round ? (
            round.dealerCards.map((c, i) =>
              i === 1 && !settled ? (
                <div key={i} className="w-14 sm:w-20">
                  <PlayingCard />
                </div>
              ) : (
                <div key={i} className="w-14 sm:w-20">
                  <PlayingCard card={c} />
                </div>
              ),
            )
          ) : (
            <p className="text-gray-500 text-sm self-center">
              Place a bet and deal to start a hand.
            </p>
          )}
        </div>
      </div>

      {/* Player hands */}
      {round && (
        <div className="flex flex-col gap-4 mb-5">
          {round.hands.map((hand, hi) => {
            const v = handValue(hand.cards);
            const isActive = inRound && round.active === hi;
            return (
              <div
                key={hi}
                className={`rounded-lg p-3 border ${
                  isActive
                    ? 'border-yellow-400 bg-white/5'
                    : 'border-white/10'
                }`}
              >
                <div className="flex items-center gap-3 mb-2 flex-wrap">
                  <span className="text-sm font-bold text-gray-300 uppercase tracking-wide">
                    {round.hands.length > 1 ? `Hand ${hi + 1}` : 'Your hand'}
                  </span>
                  <span className="text-sm text-green-300">
                    {v.total}
                    {v.soft && v.total !== 21 ? ' (soft)' : ''}
                    {v.total > 21 ? ' — bust' : ''}
                  </span>
                  <span className="text-xs text-gray-400">
                    Bet: {hand.bet}
                    {hand.doubled ? ' (doubled)' : ''}
                  </span>
                  {settled && hand.outcome && (
                    <span
                      className={`text-xs font-bold px-2 py-0.5 rounded ${
                        hand.outcome === 'blackjack'
                          ? 'bg-yellow-400 text-black'
                          : hand.outcome === 'win'
                            ? 'bg-green-500 text-black'
                            : hand.outcome === 'push'
                              ? 'bg-gray-500 text-white'
                              : 'bg-red-800 text-white'
                      }`}
                    >
                      {hand.outcome === 'blackjack'
                        ? `BLACKJACK — pays ${hand.credit}`
                        : hand.outcome === 'win'
                          ? `WIN — pays ${hand.credit}`
                          : hand.outcome === 'push'
                            ? 'PUSH — bet back'
                            : hand.outcome === 'bust'
                              ? 'BUST'
                              : 'LOSE'}
                    </span>
                  )}
                </div>
                <div className="flex gap-2 flex-wrap">
                  {hand.cards.map((c, ci) => (
                    <div key={ci} className="w-14 sm:w-20">
                      <PlayingCard card={c} small />
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Strategy hint */}
      {inRound && hint && (
        <p className="text-sm text-cyan-300 mb-4">
          💡 Basic strategy: <strong>{hint.text}</strong>
        </p>
      )}

      {notice && <p className="text-sm text-red-400 mb-4">{notice}</p>}
      {shuffledNote && inRound && (
        <p className="text-xs text-gray-500 mb-4">
          A fresh 6-deck shoe was shuffled for this hand.
        </p>
      )}

      {/* Controls */}
      {!inRound && (
        <div>
          <div className="flex items-center gap-2 flex-wrap mb-3">
            <span className="text-sm text-gray-300 mr-1">Your bet:</span>
            {CHIP_VALUES.map((v) => (
              <button
                key={v}
                onClick={() => setPendingBet((b) => b + v)}
                className="w-11 h-11 rounded-full border-2 border-dashed border-white/60 bg-green-700 hover:bg-green-600 text-white font-bold text-sm shadow"
                aria-label={`Add ${v} credits to bet`}
              >
                {v}
              </button>
            ))}
            <span className="ml-2 text-lg font-bold text-yellow-300">
              {pendingBet} credits
            </span>
            <button
              onClick={() => setPendingBet(0)}
              className="text-xs text-gray-400 underline ml-1"
            >
              Clear
            </button>
          </div>
          <div className="flex gap-3 flex-wrap">
            <button
              onClick={() => deal(pendingBet)}
              disabled={pendingBet < MIN_BET}
              className="px-6 py-2.5 bg-green-500 hover:bg-green-400 disabled:bg-gray-700 disabled:text-gray-400 text-black font-bold rounded-lg"
            >
              Deal
            </button>
            {settled && lastBet >= MIN_BET && (
              <button
                onClick={() => deal(lastBet)}
                className="px-6 py-2.5 bg-gray-800 hover:bg-gray-700 text-green-300 border border-green-500/50 font-bold rounded-lg"
              >
                Rebet &amp; Deal ({lastBet})
              </button>
            )}
            {settled && (
              <button
                onClick={() => {
                  setRound(null);
                  setNotice('');
                }}
                className="px-6 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-200 border border-white/20 font-bold rounded-lg"
              >
                New Hand
              </button>
            )}
          </div>
          {settled && round && (
            <p className="text-sm text-gray-300 mt-3">
              Round net:{' '}
              <strong
                className={
                  round.totalCredit() - chargedRef.current > 0
                    ? 'text-green-400'
                    : round.totalCredit() - chargedRef.current < 0
                      ? 'text-red-400'
                      : 'text-gray-300'
                }
              >
                {round.totalCredit() - chargedRef.current > 0 ? '+' : ''}
                {round.totalCredit() - chargedRef.current} credits
              </strong>
            </p>
          )}
        </div>
      )}

      {inRound && (
        <div className="flex gap-3 flex-wrap">
          <button
            onClick={() => act(() => round.hit())}
            className="px-6 py-2.5 bg-green-500 hover:bg-green-400 text-black font-bold rounded-lg"
          >
            Hit
          </button>
          <button
            onClick={() => act(() => round.stand())}
            className="px-6 py-2.5 bg-gray-800 hover:bg-gray-700 text-white border border-white/30 font-bold rounded-lg"
          >
            Stand
          </button>
          <button
            onClick={() =>
              activeHand && act(() => round.double(), activeHand.bet)
            }
            disabled={!canDoubleHand}
            className="px-6 py-2.5 bg-yellow-500 hover:bg-yellow-400 disabled:bg-gray-700 disabled:text-gray-400 text-black font-bold rounded-lg"
          >
            Double
          </button>
          <button
            onClick={() =>
              activeHand && act(() => round.split(), activeHand.bet)
            }
            disabled={!canSplitHand}
            className="px-6 py-2.5 bg-cyan-600 hover:bg-cyan-500 disabled:bg-gray-700 disabled:text-gray-400 text-white font-bold rounded-lg"
          >
            Split
          </button>
        </div>
      )}
    </div>
  );
}
