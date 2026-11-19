// MTX 101 Classroom — lesson content for the Clubhouse classroom.
//
// Every lesson is adapted from Anya Kowalski's approved MTX 101 education
// series (bot-core/community/mtx-education-calendar.md), whose drafts were
// claim-checked against the 2026-11-12 public proof pack and the /security
// page. Same discipline here: MTX is a utility token; no price, return, or
// value language anywhere; the mint rate is stated only as the contract's
// mint rate. The void tournament topics (10a/10b) are not lessons and are
// not listed in the syllabus.

export interface QuizQuestion {
  question: string;
  options: string[];
  /** Index into options. */
  answerIndex: number;
  why: string;
}

export interface LessonSlide {
  heading?: string;
  paragraphs?: string[];
  bullets?: string[];
  /** Rendered in a large monospace block (e.g. the contract address). */
  mono?: string;
  callout?: string;
}

export interface Lesson {
  id: string;
  /** Canonical MTX 101 topic number. */
  topic: number;
  title: string;
  subtitle: string;
  minutes: number;
  slides: LessonSlide[];
  quiz: QuizQuestion[];
}

export const REAL_MTX_ADDRESS = '0x53307e1db6c5cb6773c9495ca140372016dfe266';

export const LESSONS: Lesson[] = [
  {
    id: 'lesson-1',
    topic: 1,
    title: "What MTX Is — and What It Isn't",
    subtitle: 'The plain-language start of MTX 101.',
    minutes: 2,
    slides: [
      {
        heading: 'Welcome to MTX 101',
        paragraphs: [
          "Hi, and welcome to MTX 101. We'll keep this simple.",
          'This first lesson covers what MTX is, what it is not, and what this classroom will teach you.',
        ],
      },
      {
        heading: 'What MTX is',
        paragraphs: [
          "MTX is short for MatrixHubCoin. It's a utility token for the Matrix Hub website — you use it with the site's games and site features, on Polygon.",
        ],
      },
      {
        heading: "What it isn't",
        paragraphs: [
          'MTX is not a share in a company, and this series will never describe it that way.',
          "We won't talk about value going up or down, because that's not what this token is for, and it's not a promise anyone can make.",
        ],
      },
      {
        heading: 'What you will learn here',
        bullets: [
          'How MTX works, in plain language',
          'How to check everything yourself',
          'How to stay safe',
        ],
        callout: 'Start here any time: matrix-hub.org/security — the proof page every lesson points back to.',
      },
    ],
    quiz: [
      {
        question: 'What is MTX?',
        options: [
          'A share in a company',
          'A utility token for the Matrix Hub website, on Polygon',
          'A savings account',
        ],
        answerIndex: 1,
        why: 'MTX is MatrixHubCoin — a utility token for the Matrix Hub website (games and site features), on Polygon.',
      },
      {
        question: "Will this series ever tell you MTX's value will go up?",
        options: [
          'Yes — in the later lessons',
          "No — that's not what this token is for, and not a promise anyone can make",
        ],
        answerIndex: 1,
        why: 'The series teaches how MTX works, how to check it, and how to stay safe — never value promises.',
      },
    ],
  },
  {
    id: 'lesson-2',
    topic: 2,
    title: 'The One Real Address',
    subtitle: 'How to check the real MTX contract on /security — every time.',
    minutes: 2,
    slides: [
      {
        heading: 'Only one real MTX contract',
        paragraphs: [
          'There is only one real MTX contract. Save this, and check it before you interact with anything called "MTX":',
        ],
        mono: REAL_MTX_ADDRESS,
        callout: 'That address is on Polygon.',
      },
      {
        heading: 'Check it yourself — 3 steps',
        bullets: [
          '1. Go to matrix-hub.org/security',
          '2. Compare the address there, character by character, with the address in front of you',
          '3. If even one character is different, it is not the same contract — stop',
        ],
      },
      {
        heading: 'Where people get caught out',
        paragraphs: [
          'Copying an address from a random post, comment, or direct message is how people get caught out.',
          'The /security page is the place we point everyone to, every time. Bookmark it — not a screenshot someone sent you.',
        ],
      },
    ],
    quiz: [
      {
        question:
          "A direct message offers you a slightly different MTX address that 'works faster'. What do you do?",
        options: [
          "Use it — it's probably an update",
          'Stop — compare it against /security; one different character means a different contract',
          'Send a small test amount first',
        ],
        answerIndex: 1,
        why: 'There is only one real MTX contract. If even one character differs, it is not the same contract — stop.',
      },
      {
        question: "What's the safest place to copy the MTX address from?",
        options: [
          'A screenshot a friend sent you',
          'The /security page',
          'A comment under a post',
        ],
        answerIndex: 1,
        why: 'Bookmark matrix-hub.org/security — it is the proof page every lesson and post points to.',
      },
    ],
  },
  {
    id: 'lesson-3',
    topic: 3,
    title: 'How the Direct Mint Works',
    subtitle: 'Where new MTX come from — and where they go.',
    minutes: 2,
    slides: [
      {
        heading: 'Where new MTX come from',
        paragraphs: [
          'How do new MTX come into existence? Through a direct mint on matrix-hub.org.',
        ],
      },
      {
        heading: 'The mint rate',
        paragraphs: ['The rate written into that mint is simple:'],
        mono: '1 POL = 1,000 MTX',
        callout:
          "POL is Polygon's coin. You need POL in your own wallet to use the mint. (The mint rate is stated as the contract's rate — not as a market valuation.)",
      },
      {
        heading: 'Straight into your wallet',
        paragraphs: [
          'When you mint, the MTX are created directly into your own wallet.',
          'The site does not hold them for you in an account, and there is no site balance to withdraw later — because the tokens go straight to the wallet you connected.',
        ],
      },
    ],
    quiz: [
      {
        question: 'After you mint, where are your MTX?',
        options: [
          'In a balance on the website',
          'Directly in your own wallet',
          'Held by the site until you ask to withdraw',
        ],
        answerIndex: 1,
        why: 'Minting is non-custodial: the MTX are created directly into the wallet you connected. There is no site balance.',
      },
      {
        question: 'What do you need in your wallet to use the mint?',
        options: ['MTX', "POL — Polygon's coin", 'A site account and password'],
        answerIndex: 1,
        why: "POL is Polygon's coin, and POL in your own wallet is what the mint takes.",
      },
    ],
  },
  {
    id: 'lesson-4',
    topic: 4,
    title: 'Buying Step by Step',
    subtitle: 'The buy page is the mint — the steps, one by one.',
    minutes: 3,
    slides: [
      {
        heading: 'One thing first',
        paragraphs: [
          'A quick clarification first: on Matrix Hub, the "Buy" page is the mint. They are the same thing, not two different systems.',
          'Lesson 3 covered how the mint works. This lesson is the walkthrough — the steps, in order.',
        ],
      },
      {
        heading: 'Step by step',
        bullets: [
          '1. Open matrix-hub.org and go to the Buy / Mint page',
          '2. Connect your own wallet',
          '3. Make sure you have POL in that wallet — POL is what you mint with',
          '4. Enter the amount, review it in your wallet, and confirm only if it matches what you expected',
          '5. The MTX arrive directly in that same wallet',
        ],
      },
      {
        heading: 'Take your time at step 4',
        paragraphs: [
          "Check the site address in your browser, and check the contract if you're unsure — Lessons 1 and 2 show how.",
          'There is no deadline and no countdown. If anything looks off, stop and ask in the group first.',
        ],
      },
    ],
    quiz: [
      {
        question: "On Matrix Hub, what is the 'Buy' page?",
        options: [
          'A separate shop, different from the mint',
          'The mint itself — buying and minting are the same thing',
          'A waiting list for future sales',
        ],
        answerIndex: 1,
        why: 'The Buy page is the mint — the same thing, not two different systems. The MTX are created directly into your wallet.',
      },
      {
        question:
          "You're reviewing the confirmation in your wallet and something looks off. What do you do?",
        options: [
          'Confirm quickly — there might be a countdown',
          "Stop. There is no deadline and no countdown; check the details, and ask first if you're unsure",
          'Confirm a tiny amount to test it',
        ],
        answerIndex: 1,
        why: 'Take your time at the review step. Check the site address in your browser and the contract; if anything looks off, stop and ask in the group first.',
      },
    ],
  },
  {
    id: 'lesson-5',
    topic: 5,
    title: "What 'Non-Custodial' Means",
    subtitle: 'Your wallet, your keys — and your responsibility.',
    minutes: 2,
    slides: [
      {
        heading: 'In plain language',
        paragraphs: [
          "You'll see the word \"non-custodial\" on our pages. Here's what it means in plain language:",
          'The site never holds your MTX. When you mint, the tokens go directly into your own wallet, and they stay there until you decide to do something with them.',
        ],
      },
      {
        heading: 'Your wallet is your responsibility',
        bullets: [
          'Keep your seed phrase offline, private, and never typed into a website or chat',
          'Nobody from the team will ever ask for it',
          "If you lose access to your wallet, we cannot recover it for you — we don't hold a copy, and we don't hold your tokens",
        ],
      },
      {
        heading: 'A trade-off, chosen on purpose',
        paragraphs: [
          "Non-custodial is a trade-off we chose on purpose: you stay in control, and we stay unable to touch what's yours.",
        ],
        callout: 'Start here any time: matrix-hub.org/security — the proof page every lesson points back to.',
      },
    ],
    quiz: [
      {
        question: "What does 'non-custodial' mean on Matrix Hub?",
        options: [
          'The site holds your MTX in an account for you',
          'The site never holds your MTX — they go directly into your own wallet',
          'The site can move your tokens if you ask it to',
        ],
        answerIndex: 1,
        why: 'When you mint, the tokens go directly into your own wallet, and they stay there until you decide to do something with them.',
      },
      {
        question: 'You lose access to your wallet. What can the team do?',
        options: [
          'Recover it — they keep a backup of your access',
          'Reset your seed phrase if you email them',
          "Nothing — they don't hold your tokens or a copy of your access, and they will never ask for your seed phrase",
        ],
        answerIndex: 2,
        why: "We don't hold a copy, and we don't hold your tokens. That is the trade-off: you stay in control, and we stay unable to touch what's yours.",
      },
    ],
  },
  {
    id: 'lesson-6',
    topic: 6,
    title: 'Cashing Out, Honestly',
    subtitle: 'Swapping back via /sell-mtx — with the small-pool note.',
    minutes: 2,
    slides: [
      {
        heading: 'Swapping MTX back',
        paragraphs: [
          '"How do I swap MTX back?" — fair question, and we\'ll answer it straight.',
          'The /sell-mtx page explains, step by step, how swapping MTX back to POL on QuickSwap works. Matrix Hub does not hold your tokens, so there is nothing to "withdraw" from the site itself — the swap happens from your own wallet.',
        ],
      },
      {
        heading: 'The honest part',
        paragraphs: [
          'The swap pool is small today. That means only small amounts swap cleanly for now, and a larger swap may not go through the way you expect.',
        ],
        mono: '1 POL + 1,000 MTX',
        callout: "We'd rather tell you that up front than hide it in small print.",
      },
      {
        heading: 'Before you swap',
        paragraphs: [
          'Please read the /sell-mtx page fully before you try a swap, and start with a very small test amount if you do.',
        ],
        callout: 'The page: matrix-hub.org/sell-mtx — every step, in order.',
      },
    ],
    quiz: [
      {
        question: 'How do you swap MTX back to POL?',
        options: [
          'Withdraw it from your site balance',
          'From your own wallet, via QuickSwap — the /sell-mtx page explains each step',
          'Ask the team to swap it for you',
        ],
        answerIndex: 1,
        why: 'Matrix Hub does not hold your tokens, so there is nothing to withdraw from the site itself — the swap happens from your own wallet, on QuickSwap.',
      },
      {
        question: 'Why start with a very small test amount?',
        options: [
          'The pool is small today (1 POL + 1,000 MTX), so only small amounts swap cleanly for now',
          'Large swaps are blocked on weekdays',
          'The site charges more for a first swap',
        ],
        answerIndex: 0,
        why: 'The swap pool holds 1 POL + 1,000 MTX today, so only small amounts swap cleanly for now. Read the /sell-mtx page fully before you try a swap.',
      },
    ],
  },
];

/** Remaining MTX 101 topics, in canonical topic order — decks in production. */
export const SYLLABUS_UPCOMING: { topic: string; title: string }[] = [
  { topic: '7', title: 'Spotting the fake token (safety)' },
  { topic: '8', title: 'What "verified on PolygonScan" actually means' },
  { topic: '9', title: 'Supply + the hard cap, in plain numbers' },
  { topic: '11 + 12', title: 'Dice, Chainlink VRF fairness, and stuck-bet refund protection' },
  { topic: '13', title: 'Referral invites — cosmetic perks only' },
  { topic: '14', title: 'Honest gaps: audit, single-key control, small pool' },
];
