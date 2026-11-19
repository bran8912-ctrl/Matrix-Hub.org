import React, { useState } from 'react';
import {
  FAKE_MTX,
  FOUNDER_WALLET,
  PUBLISHED,
  REAL_MTX,
  burstConfetti,
  loadProgress,
  saveProgress,
  scanUrl,
} from '../../lib/proving-ground';

// Read a Contract Like a Pro — a guided verification walk.
//
// Five steps the visitor performs for real, in a second tab, on
// PolygonScan — using Matrix Hub's own verified contracts as the worked
// example. Each step ends with an honest self-attested checkbox ("mark
// when done"): nothing here pretends to verify the visitor actually did
// it, and the page says so. Ticks persist device-locally only.
//
// All facts from the proof pack: §1 (verified source, compiler
// v0.8.34+commit.80d5c536, 200 runs), §2 (supply + cap), §6 (owner
// disclosure), §1 warning box (the fake's PolygonScan flags).

interface Step {
  title: string;
  why: string;
  lookFor: React.ReactNode;
  linkHref: string;
  linkLabel: string;
  external: boolean;
}

const STEPS: Step[] = [
  {
    title: 'Start from the source of truth',
    why: 'Most token scams are just an address pasted into the wrong place. The address you check must come from a source the project itself publishes and stands behind — here, the /security page — never from a post, a DM, or a screenshot someone sent you.',
    lookFor: (
      <>
        On /security, find the MTX contract address. It starts{' '}
        <span className="font-mono text-green-300">0x5330…</span> and ends{' '}
        <span className="font-mono text-green-300">…e266</span>. That is the
        address every step below checks.
      </>
    ),
    linkHref: '/security',
    linkLabel: 'Open /security',
    external: false,
  },
  {
    title: 'Open the contract — is the source verified?',
    why: 'A verified contract means the exact source code is published on PolygonScan for anyone to read, and it matches the code actually running on-chain. An unverified contract asks you to trust a black box.',
    lookFor: (
      <>
        On the <strong>Contract</strong> tab you should see the published
        source, Contract Name <strong>MatrixHubCoin</strong>, compiled with{' '}
        <span className="font-mono text-green-300">v0.8.34+commit.80d5c536</span>{' '}
        (optimization on, 200 runs). MTX is verified on PolygonScan — the full
        source code is public.
      </>
    ),
    linkHref: `${scanUrl(REAL_MTX)}#code`,
    linkLabel: 'Open MTX on PolygonScan — Contract tab',
    external: true,
  },
  {
    title: 'Read the supply — and the hard cap',
    why: 'Supply is where quiet inflation would hide. A hard cap fixed in the code at deployment means not even the contract owner can mint past it.',
    lookFor: (
      <>
        On the <strong>Read Contract</strong> tab, check{' '}
        <span className="font-mono text-green-300">totalSupply</span> and{' '}
        <span className="font-mono text-green-300">MAX_SUPPLY</span>. As
        published on /security (read on-chain {PUBLISHED.readDate}):{' '}
        {PUBLISHED.totalSupply} MTX supplied, hard cap {PUBLISHED.maxSupply}{' '}
        MTX. The chain shows today's live value — supply only moves when
        someone mints.
      </>
    ),
    linkHref: `${scanUrl(REAL_MTX)}#readContract`,
    linkLabel: 'Open MTX on PolygonScan — Read Contract',
    external: true,
  },
  {
    title: 'See who controls it — in the open',
    why: 'Somebody always controls a token contract. The honest move is publishing exactly who, so anyone can watch what that wallet does. Hidden control is the red flag — disclosed control is a fact you can monitor.',
    lookFor: (
      <>
        Still on Read Contract, check{' '}
        <span className="font-mono text-green-300">owner</span>. It returns
        the founder wallet{' '}
        <span className="font-mono text-green-300 break-all">
          {FOUNDER_WALLET}
        </span>{' '}
        — the same address /security discloses. Today, that one wallet can
        change the mint rate, pause minting, and govern the contracts. We
        publish it so anyone can watch what it does.
      </>
    ),
    linkHref: `${scanUrl(REAL_MTX)}#readContract`,
    linkLabel: 'Check the owner on PolygonScan',
    external: true,
  },
  {
    title: 'Learn the warning signs — on the fake',
    why: 'You have just seen what a clean, verified contract page looks like. Now see the opposite, so the difference is burned in before it ever counts.',
    lookFor: (
      <>
        ⚠️ <strong>Warning — this link is the known fake “MTX”.</strong>{' '}
        PolygonScan itself flags the address{' '}
        <span className="font-mono text-red-300 break-all">{FAKE_MTX}</span>{' '}
        as <strong>Fake_Phishing8012348 / Phish — Hack</strong> and warns it
        is a fake token; its contract is not verified. Open the page only to
        see the warnings — never buy it. It is not connected to Matrix Hub in
        any way.
      </>
    ),
    linkHref: scanUrl(FAKE_MTX),
    linkLabel: '⚠️ Open the fake’s page — look, don’t touch',
    external: true,
  },
];

export default function VerifyWalk() {
  const [steps, setSteps] = useState<boolean[]>(() => loadProgress().verify.steps);
  const [completed, setCompleted] = useState<boolean>(
    () => loadProgress().verify.completed,
  );

  const toggle = (i: number, checked: boolean) => {
    const next = steps.map((s, j) => (j === i ? checked : s));
    const allDone = next.every(Boolean);
    const p = loadProgress();
    p.verify.steps = next;
    if (allDone && !p.verify.completed) {
      p.verify.completed = true;
      setCompleted(true);
      burstConfetti();
    }
    if (!allDone && p.verify.completed) {
      // Un-ticking a step honestly un-completes the module.
      p.verify.completed = false;
      setCompleted(false);
    }
    saveProgress(p);
    setSteps(next);
  };

  const doneCount = steps.filter(Boolean).length;

  return (
    <div>
      <div className="bg-gray-800 border border-green-500/40 rounded-lg p-4 mb-6 flex flex-wrap items-center gap-x-6 gap-y-2">
        <span className="text-gray-200">
          Progress: <strong className="text-green-300">{doneCount} of {STEPS.length} steps</strong>
        </span>
        <div className="flex-1 min-w-[160px] bg-gray-700 rounded-full h-2">
          <div
            className="bg-green-500 h-2 rounded-full transition-all"
            style={{ width: `${(doneCount / STEPS.length) * 100}%` }}
          />
        </div>
        {completed && (
          <span className="text-green-300 font-bold">Module complete ✓</span>
        )}
      </div>

      <p className="text-gray-400 text-sm mb-6">
        How the ticks work, honestly: each checkbox is your own mark that you
        did the step — nothing here can or claims to check your other tab.
        Your ticks are saved only in this browser, on this device.
      </p>

      <ol className="space-y-6">
        {STEPS.map((step, i) => (
          <li
            key={step.title}
            className={`rounded-lg border-2 p-5 ${
              steps[i]
                ? 'border-green-500 bg-green-900/20'
                : 'border-gray-600 bg-gray-800'
            }`}
          >
            <h3 className="text-xl font-bold text-green-400 mb-2">
              Step {i + 1} — {step.title}
            </h3>
            <p className="text-gray-300 mb-3">{step.why}</p>
            <div className="bg-gray-900/60 border border-gray-700 rounded-lg p-4 mb-4 text-gray-200">
              <span className="text-gray-400 text-sm block mb-1">
                What to look for
              </span>
              {step.lookFor}
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <a
                href={step.linkHref}
                {...(step.external
                  ? { target: '_blank', rel: 'noopener noreferrer' }
                  : {})}
                className="bg-green-500 hover:bg-green-400 text-black font-bold px-5 py-2 rounded-lg"
              >
                {step.linkLabel} {step.external ? '↗' : '→'}
              </a>
              <label className="flex items-center gap-2 text-gray-200 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={steps[i]}
                  onChange={(e) => toggle(i, e.target.checked)}
                  className="w-5 h-5 accent-green-500"
                />
                I did this step — mark it done
              </label>
            </div>
          </li>
        ))}
      </ol>

      {completed && (
        <div className="bg-green-900/40 border-2 border-green-500 rounded-lg p-6 mt-8 text-center">
          <p className="text-green-100 text-lg mb-2">
            Module complete ✓ — you have read a real contract like a pro.
          </p>
          <p className="text-gray-300 mb-6">
            Verified source, supply and cap, who controls it, and what a
            flagged page looks like — that five-minute habit is the difference
            between trusting a screenshot and checking the chain yourself.
            Every contract address lives on{' '}
            <a href="/security" className="text-green-400 hover:underline">
              /security
            </a>
            .
          </p>
          <a
            href="/proving-ground"
            className="inline-block bg-green-500 hover:bg-green-400 text-black font-bold px-6 py-3 rounded-lg"
          >
            Back to the Proving Ground
          </a>
        </div>
      )}
    </div>
  );
}
