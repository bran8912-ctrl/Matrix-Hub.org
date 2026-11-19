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
  /**
   * Canonical MTX 101 topic number — or null for a lesson adapted from
   * series material that carries no standalone topic number (Lesson 9,
   * drawn from the swap lessons). Null renders with no topic tag; a
   * number is never invented for a lesson the calendar does not number.
   * The one paired lesson (Lesson 12, built from the calendar's paired
   * Topics 11 + 12 post) carries the string '11 + 12' — the same
   * representation SYLLABUS_UPCOMING used for it — naming both topics
   * rather than inventing a merged number.
   */
  topic: number | string | null;
  title: string;
  subtitle: string;
  minutes: number;
  slides: LessonSlide[];
  quiz: QuizQuestion[];
}

export const REAL_MTX_ADDRESS = '0x53307e1db6c5cb6773c9495ca140372016dfe266';

/**
 * The known fake "MTX" — WARNING ONLY. PolygonScan flags this address as
 * Fake_Phishing8012348 / Phish — Hack (proof pack). It appears in Lesson 7
 * only, and only as a labelled warning example — the same discipline as the
 * Proving Ground's Spot the Fake trainer. Never present it as MTX.
 */
export const FAKE_MTX_ADDRESS = '0xDCb51dE3359C946364F707556aC8e6C6f2e69A8a';

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
  {
    id: 'lesson-7',
    topic: 7,
    title: 'Spotting the Fake Token',
    subtitle: 'The flagged fake, shown only as a warning — and the rules that protect you.',
    minutes: 3,
    slides: [
      {
        heading: '⚠️ A fake token is out there',
        paragraphs: [
          'Safety lesson — please read, even if you never use MTX.',
          'There is a fake token using a similar name. PolygonScan flags that address as Fake_Phishing8012348 / Phish — Hack.',
        ],
        mono: FAKE_MTX_ADDRESS,
        callout:
          'WARNING — this is NOT MTX. Do not use it. It is shown here only as a labelled warning, so you can recognise and avoid it.',
      },
      {
        heading: 'Three rules that protect you',
        bullets: [
          '1. The team will never ask for your seed phrase. Anyone who does is not us',
          '2. There is no "send tokens to verify your wallet" step. It does not exist',
          '3. Always compare any address with the real one on matrix-hub.org/security before you do anything',
        ],
      },
      {
        heading: 'If someone pressures you',
        paragraphs: [
          'If someone messages you offering help that involves your seed phrase or sending tokens first, close the chat and tell an admin in the main group.',
          'No rush, no pressure — real help never needs either of those things.',
        ],
        callout:
          "This lesson is the short version. Ruth's Safety Bulletin #1 is the long version — ask an admin if you want the link. Hands-on practice: the Proving Ground's Spot the Fake trainer.",
      },
    ],
    quiz: [
      {
        question:
          'PolygonScan flags the look-alike token in this lesson as "Fake_Phishing8012348 / Phish — Hack". What is it?',
        options: [
          'A newer, faster version of MTX',
          'NOT MTX — a flagged fake, shown in this lesson only as a labelled warning so you can avoid it',
          'A test token the team wants you to try',
        ],
        answerIndex: 1,
        why: 'There is only one real MTX contract (Lesson 2). The flagged address is a fake using a similar name — recognise it, and avoid it.',
      },
      {
        question:
          'A message says: "Send some tokens first so we can verify your wallet, and type in your seed phrase." What do you do?',
        options: [
          'Send a small amount — a verification step sounds official',
          'Close the chat and tell an admin — there is no "send tokens to verify" step, and the team will never ask for your seed phrase',
          'Share the seed phrase but send nothing',
        ],
        answerIndex: 1,
        why: 'Both requests are the warning signs from this lesson. Real help never needs your seed phrase or tokens sent first.',
      },
    ],
  },
  {
    id: 'lesson-8',
    topic: 8,
    title: 'Reading PolygonScan Without Panic',
    subtitle: 'What "verified" really means — and what it does not.',
    minutes: 2,
    slides: [
      {
        heading: 'What "verified" actually means',
        paragraphs: [
          'We say our contracts are "verified on PolygonScan." What does that actually mean — and what does it not mean?',
          'It means the source code for the contract is public on PolygonScan, and anyone can read it and check that the published code matches the contract running on Polygon.',
        ],
      },
      {
        heading: 'Open to read — all 5 contracts',
        paragraphs: [
          "All 5 project contracts are verified this way. You don't have to take our word for how a contract behaves — you, or anyone you trust who reads code, can look.",
        ],
        callout: 'Start at matrix-hub.org/security and follow the links yourself.',
      },
      {
        heading: 'What verified does NOT mean',
        paragraphs: [
          'Verification is not an audit, and it is not a guarantee.',
          'A separate, external audit is a different step — we have requested quotes for one, it is in progress, and we have not had one yet. We say that plainly on /security, and we say it here too.',
        ],
        callout: 'Verified = open to read. That transparency is the point — no panic, and no blind trust either.',
      },
    ],
    quiz: [
      {
        question: 'What does "verified on PolygonScan" mean?',
        options: [
          'An external firm has audited the contract and guarantees it',
          'The source code is public, and anyone can check it matches the contract running on Polygon',
          'PolygonScan recommends the token',
        ],
        answerIndex: 1,
        why: 'Verification means the published source code can be read and checked against the contract on-chain. All 5 project contracts are verified this way.',
      },
      {
        question: 'Has Matrix Hub had a separate, external audit?',
        options: [
          "No — quotes have been requested and it is in progress; verification is not an audit, and we say so plainly",
          'Yes — verification on PolygonScan was the audit',
          'Yes — before the contracts were deployed',
        ],
        answerIndex: 0,
        why: 'Verification is not an audit. An external audit is a different step — requested, in progress, and not done yet.',
      },
    ],
  },
  {
    id: 'lesson-9',
    topic: null,
    title: 'Fees and Slippage in Plain Words',
    subtitle: 'Two swap words, explained plainly — with the small-pool note.',
    minutes: 3,
    slides: [
      {
        heading: 'Two words, in plain words',
        paragraphs: [
          'Fee: a small cost for doing something. Every action on a blockchain network — a mint, a swap — carries a small network fee. On Polygon, that fee is paid in POL, which is one more reason the earlier lessons tell you to keep POL in your wallet.',
          'Slippage: the gap between the amount you expected to receive from a swap and the amount you actually receive.',
        ],
      },
      {
        heading: 'Why slippage grows in a small pool',
        paragraphs: [
          'A swap pool is two piles of tokens. When you swap, you take from one pile and add to the other — so every swap changes the balance, and the next swap is worked out from the new balance.',
          'Our swap pool is small today:',
        ],
        mono: '1 POL + 1,000 MTX',
        callout: 'In a small pool, a larger swap moves the balance a lot — so it may not go through the way you expect.',
      },
      {
        heading: 'Three habits that keep it simple',
        bullets: [
          'Read the estimate before you confirm — and confirm only if it matches what you expected',
          'Start with a very small test amount if you swap',
          'Read the /sell-mtx page fully before you try a swap',
        ],
        callout: 'None of this is hidden: the pool size and every step are on matrix-hub.org/sell-mtx and /security.',
      },
    ],
    quiz: [
      {
        question: 'In plain words, what is slippage?',
        options: [
          'A penalty the website adds to large swaps',
          'The gap between the amount you expected to receive from a swap and the amount you actually receive',
          'A discount for swapping small amounts',
        ],
        answerIndex: 1,
        why: 'Slippage is that gap. It is a property of how swap pools work — and it grows when the pool is small.',
      },
      {
        question: 'Why can a larger swap come out worse than expected here?',
        options: [
          'The pool is small today (1 POL + 1,000 MTX), so a larger swap moves its balance a lot',
          'The site charges extra for a first swap',
          'Swaps only work at certain times of day',
        ],
        answerIndex: 0,
        why: 'Every swap changes the pool balance, and the next one is worked out from the new balance. That is why Lesson 6 says: start with a very small test amount.',
      },
    ],
  },
  {
    id: 'lesson-10',
    topic: 9,
    title: 'Supply + the hard cap, in plain numbers',
    subtitle: 'Two public numbers: what exists today, and the limit in the code.',
    minutes: 2,
    slides: [
      {
        heading: 'How much MTX exists today',
        paragraphs: [
          'Two numbers explain MTX supply, and both are public. The first is how much exists right now:',
        ],
        mono: '105,100 MTX',
        callout:
          'That is the total supply today — every MTX in existence, counted by the contract itself.',
      },
      {
        heading: 'The hard cap',
        paragraphs: [
          'The second number is the limit. The contract has a hard cap — the most MTX that can ever be created — and it was written into the contract code when the contract was deployed:',
        ],
        mono: '100,000,000 MTX',
        callout:
          '"Written into the contract" matters: it is not a promise in a post — it is a limit in the verified code, and the contract refuses any mint that would go past it.',
      },
      {
        heading: 'New MTX only appear when someone mints',
        paragraphs: [
          "Supply does not grow on its own, and nobody mints in bulk ahead of time. New MTX are created only when a person uses the direct mint (Lesson 3), at the contract's mint rate of 1,000 MTX per POL — created in that moment, straight into that person's own wallet.",
          'So the supply number moves only when someone mints — and it can never move past the cap. This lesson states what exists now and what the limit is; it makes no forecast about what the numbers will look like later.',
        ],
        callout:
          'Check both numbers yourself, any time: the supply and the cap are readable on the contract on PolygonScan, linked from matrix-hub.org/security.',
      },
    ],
    quiz: [
      {
        question: 'How much MTX exists today — and where can you check that number yourself?',
        options: [
          'Nobody knows — the supply is private',
          '105,100 MTX — on the contract itself, via PolygonScan, linked from /security',
          'Whatever the most recent social post says',
        ],
        answerIndex: 1,
        why: 'The total supply is public: 105,100 MTX today. You do not have to take a post\'s word for it — the number is readable on the contract on PolygonScan, and /security links there.',
      },
      {
        question: 'What does the hard cap of 100,000,000 MTX mean, mechanically?',
        options: [
          'A target the team hopes to stay under',
          'A limit written into the contract code — the contract refuses any mint that would create more than the cap',
          'The amount of MTX scheduled to exist next year',
        ],
        answerIndex: 1,
        why: 'The cap is in the verified code, fixed when the contract was deployed — not a promise. And new MTX appear only when someone mints, so supply moves only through minting, never past the cap.',
      },
    ],
  },
  {
    id: 'lesson-11',
    topic: 13,
    title: 'Referral Invites — Cosmetic Perks Only',
    subtitle: 'What invites are, what the perks are — and what they are not.',
    minutes: 2,
    slides: [
      {
        heading: 'Bringing a friend along',
        paragraphs: [
          'Matrix Hub has referral invites. You get a personal invite code and link — and a QR code on the /wallet page — to share with a friend.',
          'Invites are a way to bring a friend along to try the arcade games and read the education posts with you. A referral counts when your friend joins through your link and completes a game round — not on a click or a visit. Your friend then gets a short receipt code to share back with you, and entering it records the referral.',
        ],
      },
      {
        heading: 'What the perks actually are',
        paragraphs: [
          'When a referral counts, the perks are badges and a game theme — things that change how the site looks and feels:',
        ],
        bullets: [
          'For you: the "First Friend" badge on your invite card',
          'For your friend: a "Welcome to the Hub" badge and the "Neon Grid" game theme',
        ],
        callout: 'That is the whole list. The perks are site features — a badge on a card, colours in a game.',
      },
      {
        heading: 'What the perks are not',
        paragraphs: [
          "Please don't share your invite link with promises attached — there is nothing attached beyond the cosmetic feature itself. A perk cannot be cashed out, transferred for value, or spent, and referral perks never include MTX, POL, or any token.",
        ],
        callout:
          'Referral perks are cosmetic site features only. No cash, no crypto, no monetary value.',
      },
    ],
    quiz: [
      {
        question:
          'Your friend joins through your invite and completes a game round. What do you receive?',
        options: [
          'An MTX bonus in your wallet',
          'The "First Friend" badge — a cosmetic site feature',
          'A cash payment for recruiting them',
        ],
        answerIndex: 1,
        why: 'Referral perks are badges and game themes only — cosmetic site features. They never include MTX, POL, cash, or anything with monetary value.',
      },
      {
        question:
          'Someone posts: "Use my invite link — we\'ll both earn money from it." Is that true?',
        options: [
          'Yes — invites pay both sides',
          'No — referral perks are cosmetic site features only, with no cash, no crypto, and no monetary value; never share an invite with promises attached',
          'Yes, but only for the inviter',
        ],
        answerIndex: 1,
        why: 'There is nothing attached to an invite beyond the cosmetic feature itself. Promising earnings from an invite link is exactly what this lesson warns against.',
      },
    ],
  },
  {
    id: 'lesson-12',
    topic: '11 + 12',
    title: 'Dice, Chainlink VRF fairness, and stuck-bet refund protection',
    subtitle: 'How a Dice roll is decided, and the refund rule if a result never arrives.',
    minutes: 3,
    slides: [
      {
        heading: 'Dice, as it actually runs',
        paragraphs: [
          'Dice is the one casino game live on Matrix Hub today. The other casino games are still in testnet development, and they are labelled that way on the site. A Dice bet is placed on-chain, in MTX, and the contract\'s published limits are:',
        ],
        mono: 'Bets 1–1,000 MTX · max payout per bet 100 MTX',
        callout:
          'Dice is a gambling game, and you can lose the MTX you wager. 18+ only — and only take part if online wagering is legal where you live; the casino is not licensed or regulated by any gambling authority.',
      },
      {
        heading: 'How a bet is routed — and where the roll comes from',
        paragraphs: [
          'When a bet is placed, the contract itself routes it on-chain: 88% to the payout side, 6% to liquidity, 4% to the reserve, 2% to development. No MTX is burned by the casino. Those are the rules in the verified code — not settings the website can quietly change per bet.',
          'The contract does not pick the result — and neither does the website or our server. The contract requests randomness from Chainlink VRF (version 2.5), a service run by the Chainlink network on Polygon, through Chainlink\'s coordinator. The request is an on-chain record, and the random result comes back on-chain, where the contract uses it to settle the bet — so both halves, the asking and the answer, are public records anyone can look up. The randomness engine is a separate contract, registered with Chainlink\'s coordinator, and that registration is itself readable on-chain.',
          'And honestly: the casino is brand new, and no bets have been placed on it yet. This lesson describes how Dice works as it is coded — not a busy game in full swing, and not results anyone has had.',
        ],
        callout:
          'Nothing here asks you to trust a promise. The checkable part is the mechanism: the request, the result, and the code are all on-chain — and the casino contracts are verified on PolygonScan (Lesson 8), so you can read exactly how a bet asks for its result and uses it.',
      },
      {
        heading: 'If a result never arrives: the refund rule',
        paragraphs: [
          'Very rarely, a requested result might never come back, and a bet would sit unsettled. The contract has a rule for exactly that, written into its code: the player gets back their full stake — the whole amount bet, paid from the reserve. The share of the bet already routed to liquidity and development is not deducted from the player; the house absorbs it.',
          'One honest detail: the refund is run by the operator — a person on the team invokes it once the wait has passed. It is not automatic, and a player cannot trigger it themselves. What anyone can do at any time is check: the contract itself will say when any bet becomes refundable (the refundableAt check on CasinoCore). A bet becomes refundable once it has been waiting:',
        ],
        mono: '3,600 seconds (1 hour)',
        callout:
          'Full stake back, after 1 hour, operator-run — and when any bet becomes refundable is readable on the contract itself, linked from matrix-hub.org/security.',
      },
    ],
    quiz: [
      {
        question: 'Where does a Dice result come from?',
        options: [
          'The website\'s server picks a number when you bet',
          'Chainlink VRF — the contract requests randomness on-chain from the Chainlink network, and the request and the result are both on-chain records',
          'The site owner chooses the results at the end of the day',
        ],
        answerIndex: 1,
        why: 'The contract requests randomness from Chainlink\'s coordinator — the site does not pick the number. The request and the arriving result are on-chain records anyone can check, in contracts verified on PolygonScan.',
      },
      {
        question: "A bet's random result never arrives. What does the contract's rule say?",
        options: [
          'The bet is simply lost — a stuck bet is gone',
          'After 1 hour (3,600 seconds), the operator can refund the full stake from the reserve — it is operator-run, not automatic, and the share already routed away is not deducted from the player',
          'The player can refund themselves instantly, at any time, with one click',
        ],
        answerIndex: 1,
        why: 'The refund function is governance-run: once a bet has been waiting past the 3,600-second timeout, the full stake is paid back from the reserve — the house absorbs the routed-away share. It is not instant and not self-service, but anyone can check when a bet becomes refundable on the contract itself.',
      },
    ],
  },
  {
    id: 'lesson-13',
    topic: 14,
    title: 'Honest Gaps: Audit, Single-Key Control, Small Pool',
    subtitle: 'The closing lesson — three open gaps, stated as plainly as the proofs.',
    minutes: 3,
    slides: [
      {
        heading: 'Gap one: no external audit yet',
        paragraphs: [
          'We finish this series the way it started: plainly. This closing lesson covers what is not in place yet — three gaps we disclose openly. The first is the audit.',
          "Lesson 8 explained what \"verified on PolygonScan\" means: the source code of all 5 project contracts is public, and anyone can read it and check it against what runs on-chain. But verification is not an audit. The contracts passed an internal audit and a full testnet rehearsal — they have not had an independent external audit.",
          'We have requested audit quotes from two firms. No audit has been commissioned, and none has been completed. Until one is done, we will keep saying it exactly that way: no external audit yet.',
        ],
        callout:
          "Verified means open to read — it is not an outsider's stamp of approval. That stamp does not exist yet, and this lesson won't pretend it does.",
      },
      {
        heading: 'Gap two: one key controls the contracts',
        paragraphs: [
          "Today, one wallet controls the MTX token and the casino contracts: the founder's wallet. That single key can change the mint rate, pause minting, and govern the casino contracts. Its address is published — here it is, and it is also on the /security page, so anyone can watch what it does:",
        ],
        mono: '0x9fb4bb44d8d962d695fc93b3dc15f1b287391077',
        callout:
          'A multisig wallet exists — but no contract has been handed over to it, so it controls nothing today. Until that changes, using these contracts means trusting that one key holder. That is a trust assumption, and we name it rather than dress it up.',
      },
      {
        heading: 'Gap three: the pool is small — and the point of this series',
        paragraphs: [
          "The third gap is the swap pool. The QuickSwap pool that swaps MTX and POL is small — the block below is its whole contents today, and no swaps have gone through it yet. A further 99,000 MTX sits in a separate contract, the LiquidityRouter, set aside for liquidity — it is not in the pool, and we don't pretend it is.",
          'What that means in practice is Lesson 9 applied: in a pool this small, only small amounts swap cleanly. A larger swap moves the pool\'s balance a lot, so it can come out worse than the estimate suggested. If you swap at all, read the /sell-mtx page first and start with a very small test amount. We make no promises about the pool growing — it is what it is today, and we say so.',
          "All three gaps in this lesson are written down on the /security page, and we will update that page as they close. That was the point of this whole series: not \"trust us\" — check for yourself. You now have every tool the series could give you: the real address, the verified code, the numbers, and the list of what is still missing.",
        ],
        mono: '1 POL + 1,000 MTX',
        callout:
          'Every gap in this lesson is on matrix-hub.org/security — check there any time, and hold us to updating it as things change.',
      },
    ],
    quiz: [
      {
        question: 'Our contracts are verified on PolygonScan. What is still missing?',
        options: [
          'Nothing — verification is the final step',
          'An independent external audit — quotes have been requested from two firms, but no audit has been commissioned or completed yet',
          'A listing on an exchange',
        ],
        answerIndex: 1,
        why: "Verification means the code is public and readable (Lesson 8). An external audit is a separate step, done by an independent firm: quotes requested from two firms, none commissioned, none completed. We keep saying 'no external audit yet' until that changes.",
      },
      {
        question: 'Who controls the MTX token and the casino contracts today?',
        options: [
          'A multisig wallet shared by the team',
          'Nobody — the contracts run themselves',
          'One founder wallet — its address is published on /security; a multisig exists, but no contract has been handed over to it, so it controls nothing today',
        ],
        answerIndex: 2,
        why: 'Every owner and governance read returns the single founder wallet (proof pack §6). The multisig exists, but governance has not been transferred to it — so today, control is one key, and the address is public so anyone can watch what it does.',
      },
    ],
  },
];

/**
 * Remaining MTX 101 topics — NONE. The series is complete: every topic on
 * Anya's calendar that carries a lesson is live in LESSONS above (Topic 14
 * is Lesson 13, the closing lesson), and the classroom index renders its
 * completion note from this empty list. A new topic joins this list only
 * when there is verified material to teach — a topic is never announced
 * ahead of its proof.
 */
export const SYLLABUS_UPCOMING: { topic: string; title: string }[] = [];
