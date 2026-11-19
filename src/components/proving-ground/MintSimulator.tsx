import React, { useEffect, useRef, useState } from 'react';
import {
  PUBLISHED,
  burstConfetti,
  loadProgress,
  readMintRate,
  saveProgress,
} from '../../lib/proving-ground';

// How a Mint Works — a guided SIMULATION of the direct mint.
//
// Simulation means simulation: no wallet is connected, no transaction is
// built, nothing is signed, and no real POL or MTX ever moves. The one
// live thing on this page is the mint RATE, read fresh from the MTX
// contract through the Terminal lib's failover pattern; if every
// endpoint fails, the page says so and falls back to the rate published
// on /security — labelled as the published figure, never dressed up as
// a live read. Facts: proof pack §2 ("Minting is open and direct:
// 1 POL = 1,000 MTX, minted straight from the contract into your own
// wallet. There is no site account holding your MTX.").

const AMOUNTS = [0.5, 1, 2, 5];
const STAGE_MS = 1400;

type RateState =
  | { kind: 'loading' }
  | { kind: 'live'; rate: number; paused: boolean | null }
  | { kind: 'failed' };

const STAGE_LABELS = [
  'Your wallet sends POL to the MTX contract',
  'The contract checks the mint is open and counts the POL',
  'The contract mints new MTX at the mint rate',
  'The MTX lands in YOUR wallet — no site account in between',
];

export default function MintSimulator() {
  const [rateState, setRateState] = useState<RateState>({ kind: 'loading' });
  const [amount, setAmount] = useState(1);
  const [stage, setStage] = useState(-1); // -1 idle, 0..3 running, 4 done
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    let alive = true;
    readMintRate().then((r) => {
      if (!alive) return;
      if (r.rate !== null) {
        setRateState({ kind: 'live', rate: r.rate, paused: r.paused });
      } else {
        setRateState({ kind: 'failed' });
      }
    });
    return () => {
      alive = false;
      timers.current.forEach(clearTimeout);
    };
  }, []);

  const liveRate = rateState.kind === 'live' ? rateState.rate : null;
  const effectiveRate = liveRate ?? PUBLISHED.mintRate;
  const minted = amount * effectiveRate;
  const running = stage >= 0 && stage < 4;
  const done = stage === 4;

  const run = () => {
    if (running) return;
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setStage(0);
    for (let s = 1; s <= 3; s += 1) {
      timers.current.push(setTimeout(() => setStage(s), STAGE_MS * s));
    }
    // Final stage and the completion save share one timer, so the saved
    // progress can never lag behind the completion panel on screen.
    timers.current.push(
      setTimeout(() => {
        setStage(4);
        const p = loadProgress();
        p.mint.runs += 1;
        if (!p.mint.completed) {
          p.mint.completed = true;
          burstConfetti();
        }
        saveProgress(p);
      }, STAGE_MS * 4),
    );
  };

  const fmt = (n: number) =>
    n.toLocaleString('en-US', { maximumFractionDigits: 0 });

  return (
    <div>
      {/* Simulation label — persistent, not fine print */}
      <div className="bg-yellow-900/30 border-2 border-yellow-500 rounded-lg p-4 mb-6 text-yellow-100">
        <strong>SIMULATION — not a transaction.</strong> No wallet is
        connected, nothing is sent or signed, and no real POL or MTX moves.
        This page shows you the steps so the real mint holds no surprises.
      </div>

      {/* Live rate strip */}
      <div className="bg-gray-800 border border-green-500/40 rounded-lg p-4 mb-6">
        {rateState.kind === 'loading' && (
          <p className="text-gray-300">
            Reading the live mint rate from the MTX contract…
          </p>
        )}
        {rateState.kind === 'live' && (
          <p className="text-gray-200">
            <span className="inline-block bg-green-500 text-black text-xs font-bold px-2 py-[2px] rounded mr-2 align-middle">
              LIVE READ
            </span>
            Mint rate, read from the contract just now:{' '}
            <strong className="text-green-300">
              1 POL = {fmt(rateState.rate)} MTX
            </strong>
            {rateState.paused === false && (
              <> · minting is <strong className="text-green-300">open</strong></>
            )}
            {rateState.paused === true && (
              <>
                {' '}
                · the live read says minting is currently{' '}
                <strong className="text-yellow-300">paused</strong> — the
                simulation still walks the normal flow so you can learn it
              </>
            )}
            .
          </p>
        )}
        {rateState.kind === 'failed' && (
          <p className="text-gray-200">
            <span className="inline-block bg-red-500 text-white text-xs font-bold px-2 py-[2px] rounded mr-2 align-middle">
              LIVE READ FAILED
            </span>
            The mint rate could not be read from any endpoint just now, so
            this simulation uses the rate published on{' '}
            <a href="/security" className="text-green-400 hover:underline">
              /security
            </a>
            :{' '}
            <strong className="text-green-300">
              1 POL = {fmt(PUBLISHED.mintRate)} MTX
            </strong>{' '}
            (read on-chain {PUBLISHED.readDate}). Check /security for the
            published figures.
          </p>
        )}
      </div>

      {/* Amount picker */}
      <div className="mb-6">
        <span className="text-gray-300 block mb-2">
          How much POL does the simulated wallet send?
        </span>
        <div className="flex gap-2 flex-wrap">
          {AMOUNTS.map((a) => (
            <button
              key={a}
              onClick={() => !running && setAmount(a)}
              className={`px-5 py-2 rounded-lg font-bold border ${
                amount === a
                  ? 'bg-green-500 text-black border-green-500'
                  : 'bg-gray-800 text-gray-200 border-gray-600 hover:border-green-500'
              }`}
            >
              {a} POL
            </button>
          ))}
        </div>
      </div>

      {/* Flow diagram */}
      <div className="bg-gray-800 border border-gray-600 rounded-lg p-6 mb-6">
        <div className="flex items-stretch justify-between gap-2 sm:gap-4 text-center">
          <div
            className={`flex-1 rounded-lg border-2 p-3 sm:p-4 transition-all duration-500 ${
              stage >= 0 ? 'border-green-500 bg-green-900/30' : 'border-gray-600'
            }`}
          >
            <div className="text-2xl mb-1">👛</div>
            <div className="font-bold text-gray-100 text-sm sm:text-base">Your wallet</div>
            <div className="text-gray-400 text-xs sm:text-sm">
              {stage === -1 && 'holds your POL'}
              {stage === 0 && `sending ${amount} POL…`}
              {stage >= 1 && stage < 4 && `${amount} POL sent`}
              {done && `${fmt(minted)} MTX received (simulated)`}
            </div>
          </div>
          <div className="self-center text-2xl text-green-400 shrink-0">
            <span
              className={`inline-block transition-all duration-700 ${
                stage === 0 ? 'translate-x-2 opacity-100' : 'opacity-40'
              }`}
            >
              ➜
            </span>
          </div>
          <div
            className={`flex-1 rounded-lg border-2 p-3 sm:p-4 transition-all duration-500 ${
              stage >= 1 && stage < 4
                ? 'border-green-500 bg-green-900/30'
                : 'border-gray-600'
            } ${stage >= 2 ? 'border-green-500' : ''}`}
          >
            <div className="text-2xl mb-1">📜</div>
            <div className="font-bold text-gray-100 text-sm sm:text-base">MTX contract</div>
            <div className="text-gray-400 text-xs sm:text-sm">
              {stage < 1 && 'waits on Polygon'}
              {stage === 1 && 'checking mint + counting…'}
              {stage === 2 &&
                `minting ${amount} × ${fmt(effectiveRate)} = ${fmt(minted)} MTX…`}
              {stage >= 3 && 'mint complete'}
            </div>
          </div>
          <div className="self-center text-2xl text-green-400 shrink-0">
            <span
              className={`inline-block transition-all duration-700 ${
                stage === 3 ? 'translate-x-2 opacity-100' : 'opacity-40'
              }`}
            >
              ➜
            </span>
          </div>
          <div
            className={`flex-1 rounded-lg border-2 p-3 sm:p-4 transition-all duration-500 ${
              done ? 'border-yellow-400 bg-yellow-900/20' : 'border-gray-600'
            }`}
          >
            <div className="text-2xl mb-1">🪙</div>
            <div className="font-bold text-gray-100 text-sm sm:text-base">Your wallet</div>
            <div className="text-gray-400 text-xs sm:text-sm">
              {done
                ? `+ ${fmt(minted)} MTX (simulated balance)`
                : 'the same wallet — MTX comes straight back to it'}
            </div>
          </div>
        </div>

        {/* Step log */}
        <ol className="mt-6 space-y-2">
          {STAGE_LABELS.map((label, i) => (
            <li
              key={label}
              className={`flex items-start gap-2 ${
                stage > i
                  ? 'text-green-300'
                  : stage === i
                    ? 'text-gray-100 font-bold'
                    : 'text-gray-500'
              }`}
            >
              <span>{stage > i ? '✓' : stage === i ? '▶' : '·'}</span>
              <span>
                {label}
                {i === 2 &&
                  ` — ${amount} POL × ${fmt(effectiveRate)} MTX = ${fmt(minted)} MTX`}
              </span>
            </li>
          ))}
        </ol>
      </div>

      {!done ? (
        <button
          onClick={run}
          disabled={running}
          className="bg-green-500 hover:bg-green-400 disabled:opacity-50 text-black font-bold px-8 py-3 rounded-lg text-lg"
        >
          {running ? 'Simulating…' : 'Run the simulation'}
        </button>
      ) : (
        <div className="bg-green-900/40 border-2 border-green-500 rounded-lg p-6">
          <p className="text-green-100 text-lg mb-2">
            Module complete ✓ — that is the whole mint.
          </p>
          <p className="text-gray-300 mb-2">
            Four steps, and the important one is the last: the MTX is minted{' '}
            <strong className="text-gray-100">
              straight from the contract into your own wallet
            </strong>
            . There is no site account holding your MTX, and nobody in the
            middle who can hold it back.
          </p>
          <p className="text-gray-300 mb-6">
            On the real page you would connect your wallet, send POL to the
            contract, and sign once in your wallet — the simulation never
            asks for any of that.
          </p>
          <div className="flex gap-4 flex-wrap">
            <a
              href="/buy-mtx"
              className="bg-green-500 hover:bg-green-400 text-black font-bold px-6 py-3 rounded-lg"
            >
              See the real mint page →
            </a>
            <button
              onClick={() => setStage(-1)}
              className="bg-gray-700 hover:bg-gray-600 text-white font-bold px-6 py-3 rounded-lg"
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
