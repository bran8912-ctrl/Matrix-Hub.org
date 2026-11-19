import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  REAL_MTX,
  SPOT_CARD_SECONDS,
  SPOT_PASS_MARKS,
  buildDeck,
  burstConfetti,
  loadProgress,
  recordSpotRun,
  saveProgress,
  type SpotDifficulty,
  type SpotProgress,
  type TrainerCard,
} from '../../lib/proving-ground';

// Spot the Fake — the address-check trainer.
//
// The skill being trained is the exact 30-second check the /security page
// and the MTX 101 series teach: compare an address character by character
// against the one real MTX contract, and stop if even one character
// differs. The real address stays pinned as the reference for the whole
// run — comparing against a trusted reference IS the skill.
//
// The known fake (0xDCb5…) appears once per run, as an answer card only;
// every reveal labels it as the flagged fake it is (proof pack §1). It is
// never presented as usable or connected to Matrix Hub.
//
// Scores and progress are device-local (see lib/proving-ground.ts).

const RUN_LENGTH = 10;
// Pass marks live in the lib (SPOT_PASS_MARKS): Normal 8/10, Hard 9/10.

type Phase = 'idle' | 'asking' | 'revealed' | 'done';

function DiffAddress({ shown }: { shown: string }) {
  // Render the shown address aligned against the real one, character by
  // character: green where it matches the real address at that position,
  // red where it differs. This is the teaching moment of every reveal.
  return (
    <span className="font-mono break-all leading-relaxed">
      {shown.split('').map((ch, i) => (
        <span
          key={i}
          className={
            ch === REAL_MTX[i]
              ? 'text-green-300'
              : 'bg-red-500/30 text-red-200 rounded-sm px-[1px] font-bold'
          }
        >
          {ch}
        </span>
      ))}
    </span>
  );
}

function verdictText(card: TrainerCard, correct: boolean): string {
  if (card.kind === 'real') {
    return correct
      ? 'Correct — that is the real MTX contract, character for character.'
      : 'That one was REAL — it matches the contract on /security exactly, all 42 characters.';
  }
  if (card.kind === 'known-fake') {
    return (
      'This is the known fake. PolygonScan itself flags this address as ' +
      'Fake_Phishing8012348 / Phish — Hack, and its contract is not verified. ' +
      'It is not a lookalike of the real address — it is a different contract ' +
      'wearing the MTX name. Never buy it; it is not connected to Matrix Hub in any way.'
    );
  }
  if (card.caseOnly) {
    return (
      `Fake — ${card.changes === 1 ? 'one letter' : `${card.changes} letters`} changed ` +
      'case only. The check is character-by-character: if it does not match ' +
      'exactly, it is not the same contract. Stop.'
    );
  }
  return (
    `Fake — a lookalike with ${card.changes} character` +
    `${card.changes === 1 ? '' : 's'} changed (highlighted red below). ` +
    'One character different = a different contract. Stop.'
  );
}

export default function SpotTheFake() {
  const [phase, setPhase] = useState<Phase>('idle');
  const [deck, setDeck] = useState<TrainerCard[]>([]);
  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bestStreakRun, setBestStreakRun] = useState(0);
  const [lastCorrect, setLastCorrect] = useState<boolean | null>(null);
  const [timedOut, setTimedOut] = useState(false);
  const [runTimed, setRunTimed] = useState(false);
  const [timeLeft, setTimeLeft] = useState(SPOT_CARD_SECONDS);
  const [spot, setSpot] = useState<SpotProgress>(() => loadProgress().spot);
  const passedRef = useRef(false);

  // Timed-mode clock. The run's timed-ness is captured at startRun, so
  // flipping the preference between runs never changes a live run. The
  // countdown runs off a deadline timestamp (not tick counting), pauses
  // while the tab is hidden, and a card is "resolved" by whichever of
  // answer / timeout reaches it first — the other becomes a no-op.
  const intervalRef = useRef<number | null>(null);
  const deadlineRef = useRef(0);
  const remainingRef = useRef(SPOT_CARD_SECONDS * 1000);
  const resolvedRef = useRef(true);
  const phaseRef = useRef<Phase>('idle');
  phaseRef.current = phase;

  const difficulty = spot.difficulty;
  const passMark = SPOT_PASS_MARKS[difficulty];
  const totalRuns =
    spot.byDifficulty.normal.runs + spot.byDifficulty.hard.runs;
  const totalTimedRuns =
    spot.byDifficulty.normal.timedRuns + spot.byDifficulty.hard.timedRuns;

  const chooseDifficulty = (d: SpotDifficulty) => {
    if (d === difficulty || phase === 'asking' || phase === 'revealed') return;
    const p = loadProgress();
    p.spot.difficulty = d;
    saveProgress(p);
    setSpot(p.spot);
  };

  const chooseTimed = (on: boolean) => {
    if (on === spot.timed || phase === 'asking' || phase === 'revealed') return;
    const p = loadProgress();
    p.spot.timed = on;
    saveProgress(p);
    setSpot(p.spot);
  };

  const stopTicker = () => {
    if (intervalRef.current !== null) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  const handleTimeout = () => {
    if (resolvedRef.current) return;
    resolvedRef.current = true;
    stopTicker();
    // The clock ran out: the card counts as a miss — no point, streak
    // lost — and the reveal says plainly that it was a timeout.
    setStreak(0);
    setLastCorrect(false);
    setTimedOut(true);
    setPhase('revealed');
  };

  const startTicker = () => {
    stopTicker();
    deadlineRef.current = Date.now() + remainingRef.current;
    intervalRef.current = window.setInterval(() => {
      const leftMs = deadlineRef.current - Date.now();
      if (leftMs <= 0) {
        setTimeLeft(0);
        handleTimeout();
      } else {
        setTimeLeft(leftMs / 1000);
      }
    }, 100);
  };

  // Each fresh card starts unresolved (the answer/timeout race guard);
  // a timed run additionally arms the clock for that card.
  useEffect(() => {
    if (phase !== 'asking') return;
    resolvedRef.current = false;
    if (!runTimed) return;
    remainingRef.current = SPOT_CARD_SECONDS * 1000;
    setTimeLeft(SPOT_CARD_SECONDS);
    startTicker();
    return stopTicker;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, index, runTimed]);

  // Pause while the tab is hidden — no cheap deaths. The remaining time
  // is banked on hide and the deadline rebuilt on show.
  useEffect(() => {
    if (!runTimed) return;
    const onVisibility = () => {
      if (document.hidden) {
        if (intervalRef.current !== null) {
          remainingRef.current = Math.max(
            0,
            deadlineRef.current - Date.now(),
          );
          setTimeLeft(remainingRef.current / 1000);
          stopTicker();
        }
      } else if (
        phaseRef.current === 'asking' &&
        intervalRef.current === null &&
        !resolvedRef.current
      ) {
        startTicker();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runTimed]);

  const card = deck[index];
  const progressLabel = useMemo(
    () => (phase === 'idle' ? '' : `Card ${Math.min(index + 1, RUN_LENGTH)} of ${RUN_LENGTH}`),
    [phase, index],
  );

  const startRun = () => {
    setDeck(buildDeck(difficulty));
    setIndex(0);
    setScore(0);
    setStreak(0);
    setBestStreakRun(0);
    setLastCorrect(null);
    setTimedOut(false);
    setRunTimed(spot.timed);
    passedRef.current = false;
    setPhase('asking');
  };

  const answer = (saidReal: boolean) => {
    if (!card || phase !== 'asking' || resolvedRef.current) return;
    resolvedRef.current = true;
    stopTicker();
    const correct = saidReal === (card.kind === 'real');
    const newScore = score + (correct ? 1 : 0);
    const newStreak = correct ? streak + 1 : 0;
    setScore(newScore);
    setStreak(newStreak);
    setBestStreakRun((b) => Math.max(b, newStreak));
    setLastCorrect(correct);
    setTimedOut(false);
    setPhase('revealed');
  };

  const next = () => {
    if (index + 1 >= RUN_LENGTH) {
      // Run finished — persist this difficulty's bests; a pass at this
      // difficulty's pass mark completes the module.
      const p = loadProgress();
      const runBestStreak = Math.max(bestStreakRun, streak);
      const didPass = recordSpotRun(p, difficulty, score, runBestStreak, runTimed);
      if (didPass && !passedRef.current) {
        passedRef.current = true;
        burstConfetti();
      }
      saveProgress(p);
      setSpot(p.spot);
      setPhase('done');
      return;
    }
    setIndex(index + 1);
    setLastCorrect(null);
    setTimedOut(false);
    setPhase('asking');
  };

  const passed = score >= passMark;

  return (
    <div>
      {/* Pinned reference — the trusted address to compare against */}
      <div className="bg-gray-800 border border-green-500/40 rounded-lg p-4 mb-6">
        <span className="text-gray-400 text-sm block mb-1">
          Your reference — the real MTX contract, from the{' '}
          <a href="/security" className="text-green-400 hover:underline">
            /security
          </a>{' '}
          page
        </span>
        <span className="font-mono text-green-300 break-all text-sm sm:text-base">
          {REAL_MTX}
        </span>
        <span className="text-gray-400 text-sm block mt-2">
          Rule of the check: character by character. If even one character
          differs, it is not the same contract — stop.
        </span>
      </div>

      {/* Difficulty — chosen between runs, kept on this device */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <span className="text-gray-400 text-sm">Difficulty:</span>
        {phase === 'asking' || phase === 'revealed' ? (
          <span className="text-sm font-bold px-3 py-1 rounded bg-gray-700 text-gray-100">
            {difficulty === 'hard' ? 'Hard' : 'Normal'} · pass {passMark}/10
          </span>
        ) : (
          <div className="inline-flex rounded-lg overflow-hidden border border-gray-600">
            {(['normal', 'hard'] as SpotDifficulty[]).map((d) => (
              <button
                key={d}
                onClick={() => chooseDifficulty(d)}
                className={`font-bold px-4 py-2 text-sm ${
                  difficulty === d
                    ? 'bg-green-500 text-black'
                    : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                }`}
              >
                {d === 'hard' ? 'Hard' : 'Normal'} · pass {SPOT_PASS_MARKS[d]}
                /10
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Timer — optional per-card countdown, chosen between runs */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <span className="text-gray-400 text-sm">Timer:</span>
        {phase === 'asking' || phase === 'revealed' ? (
          <span className="text-sm font-bold px-3 py-1 rounded bg-gray-700 text-gray-100">
            {runTimed ? `${SPOT_CARD_SECONDS}s per card` : 'Off'}
          </span>
        ) : (
          <div className="inline-flex rounded-lg overflow-hidden border border-gray-600">
            <button
              onClick={() => chooseTimed(false)}
              className={`font-bold px-4 py-2 text-sm ${
                !spot.timed
                  ? 'bg-green-500 text-black'
                  : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
              }`}
            >
              Off
            </button>
            <button
              onClick={() => chooseTimed(true)}
              className={`font-bold px-4 py-2 text-sm ${
                spot.timed
                  ? 'bg-green-500 text-black'
                  : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
              }`}
            >
              Timed · {SPOT_CARD_SECONDS}s per card
            </button>
          </div>
        )}
      </div>

      {totalRuns > 0 && phase === 'idle' && (
        <p className="text-gray-300 mb-4">
          Your record on this device — Normal: best{' '}
          <strong className="text-green-300">
            {spot.byDifficulty.normal.best}/10
          </strong>
          , streak{' '}
          <strong className="text-green-300">
            {spot.byDifficulty.normal.bestStreak}
          </strong>{' '}
          · Hard: best{' '}
          <strong className="text-green-300">
            {spot.byDifficulty.hard.best}/10
          </strong>
          , streak{' '}
          <strong className="text-green-300">
            {spot.byDifficulty.hard.bestStreak}
          </strong>{' '}
          · {totalRuns} run{totalRuns === 1 ? '' : 's'} played
          {totalTimedRuns > 0
            ? ` (${totalTimedRuns} timed)`
            : ''}
          {spot.completed ? ' — module completed ✓' : ''}.
        </p>
      )}

      {phase === 'idle' && (
        <div className="bg-green-900/40 border-2 border-green-500 rounded-lg p-6 text-center">
          <p className="text-green-100 mb-2 text-lg">
            Ten addresses, one at a time. Rule each one <strong>REAL</strong>{' '}
            or <strong>FAKE</strong>.
          </p>
          {difficulty === 'hard' ? (
            <p className="text-gray-300 mb-6">
              Hard mode: only <strong>two</strong> are the real contract. The
              other eight are the nastiest fakes — lookalikes with two or
              three characters changed, flips of letter case only, and the
              one known fake token that is going around. Score {passMark}/10
              or better to complete the module.
            </p>
          ) : (
            <p className="text-gray-300 mb-6">
              Three are the real contract. The rest are fakes — lookalikes with
              one to three characters changed, and the one known fake token
              that is going around. Score {passMark}/10 or better to complete
              the module.
            </p>
          )}
          {spot.timed && (
            <p className="text-yellow-200 mb-6">
              ⏱ Timed mode is on: <strong>{SPOT_CARD_SECONDS} seconds per card</strong>.
              Run out of time and that card counts as a miss — the reveal
              will say it was a timeout. Switch tabs mid-card and the clock
              pauses until you are back.
            </p>
          )}
          <button
            onClick={startRun}
            className="bg-green-500 hover:bg-green-400 text-black font-bold px-8 py-3 rounded-lg text-lg"
          >
            Start the check
          </button>
        </div>
      )}

      {(phase === 'asking' || phase === 'revealed') && card && (
        <div>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-1 mb-4 text-gray-300">
            <span>{progressLabel}</span>
            <span>
              Score: <strong className="text-green-300">{score}</strong>
            </span>
            <span>
              Streak: <strong className="text-green-300">{streak}</strong>
            </span>
            {runTimed && phase === 'asking' && (
              <span>
                Time:{' '}
                <strong
                  className={timeLeft <= 5 ? 'text-red-300' : 'text-yellow-200'}
                >
                  {Math.ceil(timeLeft)}s
                </strong>
              </span>
            )}
          </div>
          <div className="w-full bg-gray-700 rounded-full h-2 mb-6">
            <div
              className="bg-green-500 h-2 rounded-full transition-all"
              style={{ width: `${((index + (phase === 'revealed' ? 1 : 0)) / RUN_LENGTH) * 100}%` }}
            />
          </div>
          {runTimed && phase === 'asking' && (
            <div className="w-full bg-gray-700 rounded-full h-1.5 -mt-4 mb-6">
              <div
                className={`h-1.5 rounded-full ${
                  timeLeft <= 5 ? 'bg-red-500' : 'bg-yellow-400'
                }`}
                style={{
                  width: `${Math.max(0, Math.min(100, (timeLeft / SPOT_CARD_SECONDS) * 100))}%`,
                }}
              />
            </div>
          )}

          <div className="bg-gray-800 border border-gray-600 rounded-lg p-6 mb-6 text-center">
            <span className="text-gray-400 text-sm block mb-2">
              Is this the real MTX contract?
            </span>
            {phase === 'asking' ? (
              <span className="font-mono text-lg sm:text-2xl break-all text-gray-100">
                {card.address}
              </span>
            ) : (
              <DiffAddress shown={card.address} />
            )}
          </div>

          {phase === 'asking' && (
            <div className="flex gap-4 justify-center">
              <button
                onClick={() => answer(true)}
                className="bg-green-500 hover:bg-green-400 text-black font-bold px-10 py-4 rounded-lg text-xl flex-1 max-w-xs"
              >
                ✓ REAL
              </button>
              <button
                onClick={() => answer(false)}
                className="bg-red-500 hover:bg-red-400 text-white font-bold px-10 py-4 rounded-lg text-xl flex-1 max-w-xs"
              >
                ✗ FAKE
              </button>
            </div>
          )}

          {phase === 'revealed' && (
            <div
              className={`rounded-lg p-5 mb-6 border-2 ${
                lastCorrect
                  ? 'bg-green-900/40 border-green-500 text-green-100'
                  : 'bg-red-900/30 border-red-500 text-red-100'
              }`}
            >
              <p className="font-bold text-lg mb-2">
                {timedOut
                  ? `⏱ Time's up — this one is ${card.kind === 'real' ? 'REAL' : 'FAKE'}.`
                  : `${lastCorrect ? '✓ Correct' : '✗ Not quite'} — this one is ${
                      card.kind === 'real' ? 'REAL' : 'FAKE'
                    }.`}
              </p>
              {timedOut && (
                <p className="mb-3">
                  That card timed out — no ruling inside{' '}
                  {SPOT_CARD_SECONDS} seconds, so it counts as a miss. That
                  is the honest rule of the drill: an address you have not
                  finished checking is an address you do not trust.
                </p>
              )}
              <p className="mb-3">{verdictText(card, Boolean(lastCorrect))}</p>
              {card.kind !== 'real' && (
                <p className="text-sm opacity-90">
                  Above, the address you were shown is lit up against the real
                  one: green matches, <span className="text-red-300 font-bold">red differs</span>.
                  In the wild, do this same comparison against /security
                  before you trust anything called “MTX”.
                </p>
              )}
              <button
                onClick={next}
                className="mt-4 bg-gray-100 hover:bg-white text-black font-bold px-6 py-2 rounded-lg"
              >
                {index + 1 >= RUN_LENGTH ? 'See my score' : 'Next address →'}
              </button>
            </div>
          )}
        </div>
      )}

      {phase === 'done' && (
        <div className="bg-green-900/40 border-2 border-green-500 rounded-lg p-6 text-center">
          <p className="text-3xl font-bold text-green-300 mb-2">
            {score}/10
          </p>
          {runTimed && (
            <p className="text-yellow-200 mb-2">
              ⏱ Timed run — {SPOT_CARD_SECONDS} seconds per card.
            </p>
          )}
          {passed ? (
            <>
              <p className="text-green-100 text-lg mb-2">
                Module complete ✓ — you can run the 30-second check.
              </p>
              <p className="text-gray-300 mb-6">
                That is the whole habit: never trust an address from a post or
                a message. Compare it, character by character, with the one on{' '}
                <a href="/security" className="text-green-400 hover:underline">
                  /security
                </a>
                . One character different = stop.
              </p>
            </>
          ) : (
            <>
              <p className="text-green-100 text-lg mb-2">
                Not yet — the {difficulty === 'hard' ? 'Hard' : 'Normal'} pass
                mark is {passMark}/10.
              </p>
              <p className="text-gray-300 mb-6">
                Tip: don't eyeball the whole string. Walk it in chunks of
                four against the reference at the top, the way the reveal
                highlights do. Run it again — the fakes reshuffle every run.
              </p>
            </>
          )}
          <div className="flex gap-4 justify-center flex-wrap">
            <button
              onClick={startRun}
              className="bg-green-500 hover:bg-green-400 text-black font-bold px-6 py-3 rounded-lg"
            >
              Run it again
            </button>
            <a
              href="/proving-ground"
              className="bg-gray-700 hover:bg-gray-600 text-white font-bold px-6 py-3 rounded-lg"
            >
              Back to the Proving Ground
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
