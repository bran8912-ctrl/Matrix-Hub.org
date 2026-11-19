import React, { useState } from 'react';
import {
  completedCount,
  loadProgress,
  resetProgress,
  type ProvingGroundProgress,
} from '../../lib/proving-ground';

// The Proving Ground landing island: module cards with device-local
// progress, an overall completion state, and a share-to-Telegram link.
// Progress is read from localStorage on this device only (see
// lib/proving-ground.ts) — no account, no server copy, and the page
// copy says exactly that.

interface ModuleInfo {
  key: 'spot' | 'mint' | 'verify';
  step: string;
  title: string;
  href: string;
  blurb: string;
  minutes: string;
  detail: (p: ProvingGroundProgress) => string | null;
}

const MODULES: ModuleInfo[] = [
  {
    key: 'spot',
    step: 'Module 1',
    title: 'Spot the Fake',
    href: '/proving-ground/spot-the-fake',
    blurb:
      'The address-check trainer. Ten contract addresses, one at a time — rule each REAL or FAKE against the one true MTX contract, and see the changed characters lit up after every answer. A Hard mode waits on the trainer: fewer real cards, only the nastiest lookalikes, pass mark 9/10. An optional timed mode puts 15 seconds on each card — run out and the card counts as a miss, like an address you never finished checking.',
    minutes: 'About 3 minutes',
    detail: (p) => {
      const n = p.spot.byDifficulty.normal;
      const h = p.spot.byDifficulty.hard;
      const total = n.runs + h.runs;
      return total > 0
        ? `Best — Normal ${n.best}/10 · Hard ${h.best}/10 · best streak ${Math.max(n.bestStreak, h.bestStreak)} · ${total} run${total === 1 ? '' : 's'}`
        : null;
    },
  },
  {
    key: 'mint',
    step: 'Module 2',
    title: 'How a Mint Works',
    href: '/proving-ground/how-a-mint-works',
    blurb:
      'A guided simulation of the direct mint — POL in, MTX minted straight into your own wallet — animated step by step at the live mint rate read from the contract. Simulation only: nothing is signed and nothing moves.',
    minutes: 'About 2 minutes',
    detail: (p) => (p.mint.runs > 0 ? `Simulation run ${p.mint.runs} time${p.mint.runs === 1 ? '' : 's'}` : null),
  },
  {
    key: 'verify',
    step: 'Module 3',
    title: 'Read a Contract Like a Pro',
    href: '/proving-ground/verify-like-a-pro',
    blurb:
      'A five-step guided walk on the real PolygonScan pages: verified source, supply and hard cap, who controls the contract — and what a flagged fake’s page looks like, so you recognise one on sight.',
    minutes: 'About 5 minutes',
    detail: (p) => {
      const n = p.verify.steps.filter(Boolean).length;
      return n > 0 ? `${n} of 5 steps ticked` : null;
    },
  },
];

function statusOf(p: ProvingGroundProgress, key: ModuleInfo['key']) {
  if (p[key].completed) return { label: 'Completed ✓', cls: 'bg-green-500 text-black' };
  const started =
    key === 'spot'
      ? p.spot.byDifficulty.normal.runs + p.spot.byDifficulty.hard.runs > 0
      : key === 'mint'
        ? p.mint.runs > 0
        : p.verify.steps.some(Boolean);
  return started
    ? { label: 'In progress', cls: 'bg-yellow-500 text-black' }
    : { label: 'Not started', cls: 'bg-gray-600 text-gray-100' };
}

export default function ProvingGroundHome() {
  const [progress, setProgress] = useState<ProvingGroundProgress>(() =>
    loadProgress(),
  );
  const done = completedCount(progress);
  const allDone = done === 3;

  const shareText = encodeURIComponent(
    'I completed the Matrix Hub Proving Ground — hands-on training for checking a token contract yourself: spot the fake address, see how a mint works, read a contract like a pro.',
  );
  const shareUrl = encodeURIComponent('https://matrix-hub.org/proving-ground/');

  const reset = () => {
    resetProgress();
    setProgress(loadProgress());
  };

  return (
    <div>
      {/* Overall progress */}
      <div className="bg-gray-800 border border-green-500/40 rounded-lg p-4 mb-8">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mb-2">
          <span className="text-gray-200">
            Your progress on this device:{' '}
            <strong className="text-green-300">{done} of 3 modules</strong>
          </span>
          {allDone && (
            <span className="text-green-300 font-bold">
              Proving Ground complete 🏆
            </span>
          )}
        </div>
        <div className="w-full bg-gray-700 rounded-full h-3">
          <div
            className="bg-green-500 h-3 rounded-full transition-all"
            style={{ width: `${(done / 3) * 100}%` }}
          />
        </div>
      </div>

      {/* Module cards */}
      <div className="grid gap-6 md:grid-cols-3 mb-8">
        {MODULES.map((m) => {
          const status = statusOf(progress, m.key);
          const detail = m.detail(progress);
          return (
            <div
              key={m.key}
              className="bg-gray-800 border border-gray-600 hover:border-green-500 rounded-lg p-5 flex flex-col transition-colors"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-400 text-sm">{m.step}</span>
                <span
                  className={`text-xs font-bold px-2 py-[2px] rounded ${status.cls}`}
                >
                  {status.label}
                </span>
              </div>
              <h2 className="text-2xl font-bold text-green-400 mb-2">
                {m.title}
              </h2>
              <p className="text-gray-300 mb-3 flex-1">{m.blurb}</p>
              {detail && <p className="text-sm text-gray-400 mb-2">{detail}</p>}
              <p className="text-sm text-gray-500 mb-4">{m.minutes}</p>
              <a
                href={m.href}
                className="bg-green-500 hover:bg-green-400 text-black font-bold px-5 py-2 rounded-lg text-center"
              >
                {progress[m.key].completed
                  ? 'Review module'
                  : status.label === 'In progress'
                    ? 'Continue →'
                    : 'Start →'}
              </a>
            </div>
          );
        })}
      </div>

      {/* Completion state */}
      {allDone ? (
        <div className="bg-green-900/40 border-2 border-green-500 rounded-lg p-6 text-center mb-8">
          <p className="text-2xl font-bold text-green-300 mb-2">
            🏆 Proving Ground complete
          </p>
          <p className="text-gray-200 mb-6 max-w-2xl mx-auto">
            You can run the 30-second address check, you know exactly how a
            mint moves, and you have read a real contract end to end. That is
            the whole MTX 101 skill set — practised, not just read. Pass it
            on: these three habits protect anyone holding any token.
          </p>
          <div className="flex gap-4 justify-center flex-wrap">
            <a
              href={`https://t.me/share/url?url=${shareUrl}&text=${shareText}`}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-green-500 hover:bg-green-400 text-black font-bold px-6 py-3 rounded-lg"
            >
              Share on Telegram ↗
            </a>
            <a
              href="https://t.me/matrixhuborg"
              target="_blank"
              rel="noopener noreferrer"
              className="bg-gray-700 hover:bg-gray-600 text-white font-bold px-6 py-3 rounded-lg"
            >
              Follow MTX 101 on Telegram ↗
            </a>
            <a
              href="/security"
              className="bg-gray-700 hover:bg-gray-600 text-white font-bold px-6 py-3 rounded-lg"
            >
              Re-read the proof page
            </a>
          </div>
        </div>
      ) : (
        <p className="text-gray-400 text-center mb-8">
          Finish all three modules to complete the Proving Ground — your
          completion panel (and the Telegram share) unlocks here.
        </p>
      )}

      <p className="text-sm text-gray-500 text-center">
        Progress is stored only in this browser, on this device — no
        account, nothing sent anywhere.{' '}
        <button onClick={reset} className="underline hover:text-gray-300">
          Reset my progress
        </button>
      </p>
    </div>
  );
}
