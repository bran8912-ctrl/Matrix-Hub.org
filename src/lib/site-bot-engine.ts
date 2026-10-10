// Matrix Hub shared bot engine — static-safe, local-first, no network calls.

export type BotMode = 'oracle' | 'profit';

export interface BotContext {
  roomId?: string;
  path?: string;
}

interface Topic {
  id: string;
  title: string;
  keywords: string[];
  lines: string[];
  deeper: string[];
}

const RULE = '─'.repeat(26);

function frame(persona: string, title: string, lines: string[], tail?: string): string {
  const body = lines.map((l) => `▸ ${l}`).join('\n');
  return `▌${persona} // ${title}\n${RULE}\n${body}${tail ? `\n${RULE}\n${tail}` : ''}`;
}

const ORACLE_TOPICS: Topic[] = [
  {
    id: 'wallet-safety',
    title: 'WALLET SECURITY',
    keywords: ['wallet', 'security', 'safe', 'phishing', 'scam', 'password', 'hack'],
    lines: [
      'Your keys are your identity. No one legitimate will ever ask for them.',
      'Verify every contract address from official sources before signing.',
      'Treat urgency as a weapon — real systems do not rush you.'
    ],
    deeper: [
      'Use a separate wallet for experiments and a cold one for holdings.',
      'Read what you sign. Unlimited approvals are open doors — revoke what you do not use.',
      'Bookmark official links; never trust links from DMs or comments.'
    ]
  },
  {
    id: 'mtx',
    title: 'THE MTX TOKEN',
    keywords: ['mtx', 'token', 'coin', 'balance', 'supply', 'tokenomics', 'matrixhubcoin'],
    lines: [
      'MTX is the utility layer of the Matrix Hub ecosystem.',
      'Judge it by what it does: the contract, the docs, the product.',
      'No promises of profit. Only verifiable function.'
    ],
    deeper: [
      'Read the tokenomics and contract pages before acting on anything.',
      'Confirm the contract address on a block explorer.',
      'Never size a position you cannot afford to lose.'
    ]
  },
  {
    id: 'casino',
    title: 'THE CASINO',
    keywords: ['casino', 'slots', 'blackjack', 'roulette', 'dice', 'plinko', 'mines', 'crash', 'bet', 'gamble', 'wager'],
    lines: [
      'Every game has a house edge. The math does not bend to luck or feeling.',
      'Set a budget before you play and treat it as entertainment spend.',
      'Check the provably-fair and game-math docs to understand the odds.'
    ],
    deeper: [
      'Blackjack: basic strategy minimizes the edge. Roulette: prefer single-zero wheels.',
      'Betting systems like Martingale change variance, not expected value.',
      'If it stops being fun, stop. That is the winning move.'
    ]
  },
  {
    id: 'defi',
    title: 'DECENTRALIZED FINANCE',
    keywords: ['defi', 'yield', 'liquidity', 'staking', 'pool', 'farm', 'apy'],
    lines: [
      'DeFi removes middlemen and replaces them with code. Code has bugs.',
      'Yield is payment for risk — high yield means high risk.',
      'Guaranteed returns are a red flag, always.'
    ],
    deeper: [
      'Check audits, TVL history, and admin key controls.',
      'Understand impermanent loss before providing liquidity.',
      'Start small and test with tiny amounts first.'
    ]
  },
  {
    id: 'dao',
    title: 'GOVERNANCE',
    keywords: ['dao', 'governance', 'vote', 'proposal', 'treasury', 'community'],
    lines: [
      'Governance turns a crowd into a coordinated system.',
      'Healthy DAOs publish rules, treasury flows, and voting outcomes openly.',
      'Power concentrated in few wallets is a warning sign.'
    ],
    deeper: [
      'Check quorum rules and proposal thresholds.',
      'Watch for delegation concentration.',
      'Participation is the real signal of a living DAO.'
    ]
  },
  {
    id: 'blockchain',
    title: 'THE LEDGER',
    keywords: ['blockchain', 'ethereum', 'polygon', 'solidity', 'smart contract', 'gas', 'contract', 'web3'],
    lines: [
      'A blockchain is a shared ledger no single party can quietly rewrite.',
      'A smart contract is a rule that executes exactly as written — for better or worse.',
      'Verify the code, verify the transaction, then trust.'
    ],
    deeper: [
      'Gas is the fee for computation; Polygon keeps it low.',
      'Contracts are public — read them on a block explorer.',
      'Immutable means mistakes are permanent. Test on testnet first.'
    ]
  },
  {
    id: 'nft',
    title: 'DIGITAL OWNERSHIP',
    keywords: ['nft', 'collectible', 'mint', 'token gate', 'non-fungible'],
    lines: [
      'An NFT is a proof of ownership, not a guarantee of value.',
      'Utility and community outlast hype.',
      'Verify the collection and marketplace before minting.'
    ],
    deeper: [
      'Check the contract creator and metadata storage.',
      'Beware of free-mint links from strangers.',
      'Treat purchases as speculative.'
    ]
  },
  {
    id: 'games',
    title: 'THE ARCADE',
    keywords: ['arcade', 'free game', 'snake', 'memory', 'hacking', 'rain', 'neo', 'play'],
    lines: [
      'The arcade is free — no wallet needed.',
      'Try Digital Rain, Hacking Simulator, Bullet Time, Cyber Snake, Code Breaker, and Neo\'s Training.',
      'Head to /games to see them all.'
    ],
    deeper: ['Scores feed the leaderboards.', 'Casino games live separately at /games/casino.']
  },
  {
    id: 'academy',
    title: 'THE ACADEMY',
    keywords: ['academy', 'lesson', 'learn', 'course', 'quiz', 'shipyard', 'fit-up', 'fitup'],
    lines: [
      'The Academy teaches through lessons, glossary terms, and quizzes.',
      'Start at /academy and work through the modules in order.'
    ],
    deeper: ['Use the glossary when a term blocks you.', 'Challenges test what you have learned.']
  },
  {
    id: 'earning',
    title: 'EARNING PATHS',
    keywords: ['earn', 'reward', 'contribute', 'pull request', 'issue', 'bounty'],
    lines: [
      'Value flows to those who create it: code, content, bug reports.',
      'Contribute through GitHub pull requests and quality issues.',
      'Rewards depend on impact, never on promises.'
    ],
    deeper: ['Read the contributing guidelines first.', 'Small, focused changes get reviewed fastest.']
  }
];

const PROFIT_TOPICS: Topic[] = [
  {
    id: 'affiliate',
    title: 'AFFILIATE STRATEGY',
    keywords: ['affiliate', 'commission', 'referral', 'partner'],
    lines: [
      'Recommend only what you would use yourself, and disclose the relationship.',
      'Honest comparisons and tutorials convert better than hype.',
      'Track clicks and sales so you double down on what works.'
    ],
    deeper: ['Build one strong review page before adding more.', 'Place links where the reader decision actually happens.']
  },
  {
    id: 'digital-products',
    title: 'DIGITAL PRODUCTS',
    keywords: ['digital product', 'ebook', 'template', 'download', 'guide', 'sell'],
    lines: [
      'Build once, sell many times: templates, guides, calculators, assets.',
      'Validate demand with a small version before investing weeks.'
    ],
    deeper: ['Pre-sell or collect emails first.', 'Solve one painful problem very well.']
  },
  {
    id: 'traffic',
    title: 'TRAFFIC ENGINE',
    keywords: ['traffic', 'visitors', 'seo', 'search', 'growth', 'audience'],
    lines: [
      'Answer specific questions better than anyone else.',
      'Fast mobile pages, clear titles, and internal links compound over time.',
      'Measure which pages earn visits, then improve those first.'
    ],
    deeper: ['Refresh winning pages instead of only publishing new ones.', 'Own an email list — rented audiences can vanish.']
  },
  {
    id: 'crypto-risk',
    title: 'CRYPTO REALITY CHECK',
    keywords: ['crypto', 'token', 'coin', 'invest', 'trading', 'trade'],
    lines: [
      'Crypto is volatile and regulated unevenly. Losses are real.',
      'Never promise returns; never risk rent money.',
      'Transparency and security are the only durable edge.'
    ],
    deeper: ['Diversify and size positions small.', 'This is information, not financial advice.']
  },
  {
    id: 'passive-income',
    title: 'INCOME ARCHITECTURE',
    keywords: ['passive income', 'make money', 'income', 'revenue', 'earn', 'profit'],
    lines: [
      'Pick one offer, one audience, one channel. Test. Repeat.',
      'Passive income is front-loaded work — income is never guaranteed.'
    ],
    deeper: ['Stack small streams rather than betting on one.', 'Reinvest first earnings into the channel that works.']
  },
  {
    id: 'ads',
    title: 'ADVERTISING',
    keywords: ['ads', 'advertising', 'monetize', 'adsense'],
    lines: [
      'Ads pay best on useful content with a relevant audience.',
      'Read each program\'s eligibility rules before applying.'
    ],
    deeper: ['Balance ad density against page speed.', 'Test placements slowly, one at a time.']
  }
];

const SECURITY_PATTERNS: RegExp[] = [
  /(private\s*key|seed\s*phrase|recovery\s*phrase|mnemonic|secret\s*key|12\s*words|24\s*words)/i,
  /(verify\s*wallet|claim\s*airdrop|guaranteed\s*(profit|returns?|100x)|send\s*(eth|mtx|crypto|btc)|double\s*your)/i,
  /\b(bit\.ly|tinyurl|goo\.gl|shorturl|t\.co|ow\.ly)\b/i,
  /\b0x[a-fA-F0-9]{64}\b/
];

function normalize(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9\s-]/g, ' ').replace(/\s+/g, ' ').trim();
}

function pickTopic(query: string, topics: Topic[]): Topic | null {
  const q = ` ${normalize(query)} `;
  let best: Topic | null = null;
  let bestScore = 0;
  for (const t of topics) {
    let score = 0;
    for (const k of t.keywords) {
      const nk = normalize(k);
      if (!nk) continue;
      if (q.includes(` ${nk} `) || q.includes(` ${nk}s `)) score += nk.includes(' ') ? 3 : 2;
      else if (nk.length > 4 && q.includes(nk)) score += 1;
    }
    if (score > bestScore) { best = t; bestScore = score; }
  }
  return best;
}

// ── memory (localStorage; safe when unavailable) ──
interface MemoryEntry { q: string; topic: string; t: number }

export function readBotMemory(roomId: string): MemoryEntry[] {
  if (typeof window === 'undefined' || !roomId) return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(`matrix_hub_bot_memory_${roomId}`) ?? '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

export function writeBotMemory(roomId: string, q: string, topic: string): void {
  if (typeof window === 'undefined' || !roomId) return;
  try {
    const next = [...readBotMemory(roomId), { q: q.slice(0, 200), topic, t: Date.now() }].slice(-8);
    window.localStorage.setItem(`matrix_hub_bot_memory_${roomId}`, JSON.stringify(next));
  } catch { /* ignore */ }
}

// ── page awareness ──
const PROFIT_PATHS = ['/affiliates', '/money-printer', '/tools', '/useful-tools', '/projects', '/content-feed'];

export function getModeForPath(path = ''): BotMode {
  return PROFIT_PATHS.some((p) => path.startsWith(p)) ? 'profit' : 'oracle';
}

export function getGreeting(path = ''): string {
  const mode = getModeForPath(path);
  if (mode === 'profit') {
    return frame('PROFIT ORACLE', 'ONLINE', [
      'I read the market of ideas, not the future.',
      'Ask about affiliates, traffic, products, or monetization.'
    ], 'Information only — never guaranteed income.');
  }
  if (path.startsWith('/games/casino') || path.startsWith('/casino') || path.startsWith('/mtx-casino')) {
    return frame('ORACLE', 'THE HOUSE ALWAYS WATCHES', [
      'You have entered the casino floor.',
      'Ask about odds, game math, fairness, or safe play.'
    ]);
  }
  if (path.startsWith('/academy')) {
    return frame('ORACLE', 'THE ACADEMY', ['Knowledge is the only unbreakable key.', 'Ask me about lessons, terms, or where to begin.']);
  }
  if (path.startsWith('/wallet') || path.startsWith('/enhanced-wallet') || path.startsWith('/buy-mtx') || path.startsWith('/staking')) {
    return frame('ORACLE', 'WALLET ZONE', ['Guard your keys. Verify every address.', 'Ask me before you sign anything unfamiliar.']);
  }
  return frame('ORACLE', 'WELCOME, SEEKER', [
    'The Matrix reveals itself to those who ask.',
    'Try: MTX, casino odds, wallet safety, DeFi, governance, or the arcade.'
  ]);
}

export function getSuggestions(path = ''): string[] {
  const mode = getModeForPath(path);
  if (mode === 'profit') return ['affiliate marketing', 'grow traffic', 'digital products', 'crypto risk'];
  if (path.includes('casino')) return ['casino odds', 'blackjack strategy', 'is it fair?', 'wallet safety'];
  if (path.startsWith('/academy')) return ['academy', 'how do I start?', 'blockchain basics'];
  return ['what is MTX?', 'wallet safety', 'casino odds', 'free games'];
}

export function buildBotAnswer(mode: BotMode, query: string, ctx: BotContext = {}): { text: string; topic: string } {
  const persona = mode === 'profit' ? 'PROFIT ORACLE' : 'ORACLE';
  const room = ctx.roomId ?? mode;
  const q = normalize(query);

  if (!q) return { text: getGreeting(ctx.path), topic: 'greeting' };

  if (SECURITY_PATTERNS.some((re) => re.test(query))) {
    return {
      topic: 'security-alert',
      text: frame(persona, '⚠ SECURITY BREACH AVERTED', [
        'Never share private keys, seed phrases, or recovery words.',
        'Treat guaranteed-profit offers, shortened links, and urgent claims as scams.',
        'No legitimate team will ever request your secrets.'
      ], 'Stay vigilant.')
    };
  }

  const topics = mode === 'profit' ? PROFIT_TOPICS : ORACLE_TOPICS;
  const all = [...ORACLE_TOPICS, ...PROFIT_TOPICS];
  const memory = readBotMemory(room);
  const last = memory[memory.length - 1];

  // Follow-up: go deeper on the previous topic
  if (/^(more|go deeper|deeper|tell me more|expand|continue|and\??|why\??)$/.test(q) && last) {
    const prev = all.find((t) => t.id === last.topic);
    if (prev) return { topic: prev.id, text: frame(persona, `${prev.title} // DEEPER`, prev.deeper) };
  }

  const match = pickTopic(query, topics) ?? pickTopic(query, all);
  if (match) {
    return { topic: match.id, text: frame(persona, match.title, match.lines, 'Say "more" to go deeper.') };
  }

  if (/\b(help|guide|what can|what do|options|menu)\b/.test(q)) {
    const menu = mode === 'profit'
      ? ['Affiliate strategy', 'Digital products', 'Traffic growth', 'Advertising', 'Crypto risk']
      : ['The MTX token', 'The casino', 'Wallet security', 'DeFi', 'Governance', 'The arcade', 'The academy'];
    return { topic: 'help', text: frame(persona, 'CAPABILITIES', menu) };
  }

  if (/^(hi|hello|hey|yo|sup|good (morning|evening|afternoon))\b/.test(q)) {
    return { topic: 'greeting', text: getGreeting(ctx.path) };
  }

  return {
    topic: 'unknown',
    text: frame(persona, 'SIGNAL UNCLEAR', [
      'I do not have a verified answer for that, and I will not invent one.',
      'Try a narrower question, or type "help" to see what I know.'
    ])
  };
}

// Backwards-compatible helpers
export function buildOracleResponse(query: string, ctx: BotContext = {}): string {
  return buildBotAnswer('oracle', query, ctx).text;
}

export function buildProfitResponse(query: string, ctx: BotContext = {}): string {
  return buildBotAnswer('profit', query, ctx).text;
}
