export type BotMode = 'oracle' | 'profit';

export interface BotContext {
  userName?: string;
  roomId?: string;
  previousMessages?: string[];
}

interface BotKnowledgeItem {
  id: string;
  keywords: string[];
  answer: string;
}

const ORACLE_TOPICS: BotKnowledgeItem[] = [
  {
    id: 'wallet-safety',
    keywords: ['wallet', 'security', 'private key', 'seed phrase', 'safe', 'phishing', 'scam', 'password'],
    answer: 'Never share private keys, seed phrases, recovery phrases, or wallet secrets with anyone. Treat every unsolicited request for a wallet action or code review as suspicious. Use official links, verify contract addresses, and keep your wallet isolated from untrusted browser prompts.'
  },
  {
    id: 'mtx',
    keywords: ['mtx', 'token', 'coin', 'balance', 'supply', 'ecosystem'],
    answer: 'MTX is the utility and governance layer for Matrix Hub. It supports access, incentives, and ecosystem functions across the site. The safest way to evaluate it is to inspect the contract, the docs, and the actual product behavior rather than promises or hype.'
  },
  {
    id: 'casino',
    keywords: ['casino', 'slots', 'blackjack', 'roulette', 'dice', 'bet', 'game'],
    answer: 'Matrix Hub casino experiences are designed to be entertained responsibly. Key risk controls are clear rules, transparent odds, bounded bets, and informed play. Always treat gambling as entertainment, not as a strategy for guaranteed returns.'
  },
  {
    id: 'defi',
    keywords: ['defi', 'decentralized finance', 'yield', 'liquidity', 'staking', 'pool'],
    answer: 'DeFi can be powerful, but it is not free of risk. Smart contract bugs, token volatility, and bad incentives can cause major losses. The wise move is to learn protocols deeply, verify audits, and avoid anything promising guaranteed yields.'
  },
  {
    id: 'dao',
    keywords: ['dao', 'governance', 'vote', 'proposal', 'community', 'treasury'],
    answer: 'DAOs work best when power, rules, and incentives are clear. Good governance increases transparency and reduces single-point control. Always inspect voting rules, treasury spending, and proposal criteria before trusting governance language.'
  },
  {
    id: 'blockchain',
    keywords: ['blockchain', 'ethereum', 'solidity', 'smart contract', 'gas', 'contract'],
    answer: 'A blockchain is a shared ledger secured by consensus, while a smart contract is code that enforces rules on-chain. The practical lesson is simple: verify code, verify transactions, and understand the trust assumptions before you trust any project.'
  },
  {
    id: 'nft',
    keywords: ['nft', 'token gate', 'collectible', 'mint', 'digital asset'],
    answer: 'NFTs can represent digital identity, access, or ownership but they are not automatically valuable. Utility, scarcity, and community matter more than hype. Treat NFT purchases as speculative and verify every collection and marketplace carefully.'
  },
  {
    id: 'earning',
    keywords: ['earn', 'reward', 'contribute', 'pull request', 'issue', 'passive income', 'revenue'],
    answer: 'Revenue and growth usually come from solving a real problem, not from random hype. Build useful tools, ship consistently, and measure real user demand. In Matrix Hub, value is created through useful products, clear trust, and measurable traction.'
  },
  {
    id: 'site-tools',
    keywords: ['tool', 'feature', 'tools', 'dashboard', 'tracker', 'chart', 'calculator', 'site', 'page'],
    answer: 'Matrix Hub is designed as a practical toolkit: content, docs, tools, games, and ecosystem utilities. The best strategy is to start with a specific user need, use the site as a working toolkit, and then expand based on what demonstrates genuine value.'
  },
  {
    id: 'greeting',
    keywords: ['hello', 'hi', 'hey', 'good morning', 'good evening', 'help'],
    answer: 'The Matrix is listening. Ask about MTX, casino mechanics, wallet safety, DeFi, governance, or how to get started with the site. Type “help” at any time for a quick guide.'
  }
];

const PROFIT_TOPICS: BotKnowledgeItem[] = [
  {
    id: 'affiliate',
    keywords: ['affiliate', 'commission', 'referral', 'partner'],
    answer: 'Affiliate marketing works best when the product is genuinely relevant to the audience. Pick a problem people already have, use honest comparisons, and measure what converts instead of chasing hype. Create trust first; the commission follows.'
  },
  {
    id: 'digital-products',
    keywords: ['digital product', 'ebook', 'template', 'download', 'guide', 'resource'],
    answer: 'Digital products win when they solve a clear pain point. Good candidates include checklists, calculators, templates, mini-guides, and toolkits. The key is validation: make a small useful version, test demand, then improve it.'
  },
  {
    id: 'traffic',
    keywords: ['traffic', 'visitors', 'seo', 'search', 'growth', 'audience'],
    answer: 'Traffic is usually a byproduct of useful content. Build pages that answer a specific question, improve discoverability, and make the next step obvious. Good traffic compounds when the content is consistently better than the alternatives.'
  },
  {
    id: 'crypto-risk',
    keywords: ['crypto', 'token', 'coin', 'matrix hub coin', 'risk'],
    answer: 'Crypto projects are high-risk by default. Focus on transparency, real utility, and safety-minded communication. Never promise guaranteed returns or pressure people into quick investments.'
  },
  {
    id: 'passive-income',
    keywords: ['passive income', 'make money', 'earn', 'income', 'revenue'],
    answer: 'A sustainable income stream usually starts with one useful offer and one reliable distribution channel. Test demand with a small solution, learn from the data, and build systems around what people actually pay for.'
  },
  {
    id: 'ads',
    keywords: ['ads', 'advertising', 'monetize', 'monetization', 'support'],
    answer: 'Advertising can work, but it works best when the content is already useful and the audience is relevant. Always review the platform rules, audience fit, and conversion quality before optimizing for ad revenue.'
  },
  {
    id: 'products',
    keywords: ['product', 'saaS', 'software', 'tool', 'dashboard', 'utility'],
    answer: 'Useful software compounds when it solves a real workflow problem. Start with a single workflow, validate real demand, and let feedback drive the next feature. The best products are simple, valuable, and easy to explain.'
  }
];

const SECURITY_PATTERNS = [
  { pattern: /(private\s*key|seed\s*phrase|recovery\s*phrase|mnemonic|secret\s*key)/i, response: 'Never share private keys, recovery phrases, or wallet secrets. The Matrix has blocked this message for safety.' },
  { pattern: /(verify\s*wallet|claim\s*airdrop|guaranteed\s*(profit|returns)|send\s*(eth|mtx|crypto)|limited\s*time)/i, response: 'This looks like a scam or phishing pattern. Never send funds, share keys, or trust urgent wallet requests from unverified sources.' },
  { pattern: /(bit\.ly|tinyurl|goo\.gl|shorturl|t\.co|ow\.ly)/i, response: 'Shortened links are risky. The Oracle advises caution and recommends using verified, direct links only.' }
];

function normalizeText(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9\s-]/g, ' ').replace(/\s+/g, ' ').trim();
}

function scoreKnowledge(query: string, items: BotKnowledgeItem[]): { item: BotKnowledgeItem; score: number } | null {
  const normalized = normalizeText(query);
  let best: { item: BotKnowledgeItem; score: number } | null = null;

  for (const item of items) {
    let score = 0;
    for (const keyword of item.keywords) {
      const keywordText = normalizeText(keyword);
      if (!keywordText) continue;
      const bonus = keywordText.includes(' ') ? 2 : 1;
      if (normalized.includes(keywordText)) score += bonus;
      if (keywordText.split(' ').every((part) => normalized.includes(part))) score += 1;
    }
    if (score > 0 && (!best || score > best.score)) {
      best = { item, score };
    }
  }

  return best;
}

export function readBotMemory(roomId: string): Array<{ q: string; a: string; t: number }> {
  if (typeof window === 'undefined' || !roomId) return [];
  try {
    const raw = window.localStorage.getItem(`matrix_hub_bot_memory_${roomId}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function writeBotMemory(roomId: string, question: string, answer: string): void {
  if (typeof window === 'undefined' || !roomId) return;
  try {
    const existing = readBotMemory(roomId);
    const next = [...existing, { q: question, a: answer, t: Date.now() }].slice(-8);
    window.localStorage.setItem(`matrix_hub_bot_memory_${roomId}`, JSON.stringify(next));
  } catch {
    // localStorage may be unavailable in some browsers or private contexts
  }
}

export function buildOracleResponse(query: string, context: BotContext = {}): string {
  const normalized = normalizeText(query);
  if (!normalized) return 'The Oracle is ready. Ask about MTX, casino mechanics, wallet safety, DeFi, or governance.';

  for (const entry of SECURITY_PATTERNS) {
    if (entry.pattern.test(query)) {
      return `${entry.response} ${ORACLE_TOPICS.find((item) => item.id === 'wallet-safety')?.answer ?? ''}`.trim();
    }
  }

  const memory = readBotMemory(context.roomId ?? 'oracle');
  if (memory.length > 0) {
    const last = memory[memory.length - 1];
    if (normalized.includes('again') || normalized.includes('more') || normalized.includes('expand')) {
      return last.a;
    }
  }

  const bestMatch = scoreKnowledge(query, ORACLE_TOPICS);
  if (bestMatch && bestMatch.score > 0) {
    return bestMatch.item.answer;
  }

  if (/what can|help|guide|what do|what are/.test(normalized)) {
    return 'The Oracle can help with MTX, casino mechanics, wallet safety, DeFi, governance, and site tools. Ask a specific question and the Matrix will narrow the answer.';
  }

  return 'The Oracle sees your question, seeker. The Matrix is broad, but the safest path is to ask a specific question about MTX, wallet safety, casino rules, governance, or site tools.';
}

export function buildProfitResponse(query: string, context: BotContext = {}): string {
  const normalized = normalizeText(query);
  if (!normalized) return 'I can help with affiliate marketing, traffic, product ideas, or monetization. Ask me about a specific audience or revenue model.';

  const memory = readBotMemory(context.roomId ?? 'profit');
  if (memory.length > 0) {
    const last = memory[memory.length - 1];
    if (normalized.includes('again') || normalized.includes('repeat') || normalized.includes('more')) {
      return last.a;
    }
  }

  const bestMatch = scoreKnowledge(query, PROFIT_TOPICS);
  if (bestMatch && bestMatch.score > 0) {
    return bestMatch.item.answer;
  }

  if (/traffic|audience|growth|seo/.test(normalized)) {
    return 'Start by solving one real problem for one clear audience, then measure which content brings traffic and which offers convert. Great monetization usually follows a repeatable user journey, not a random idea.';
  }

  return 'Useful monetization usually starts with one real user problem and one practical offer. Ask about affiliate marketing, digital products, traffic, crypto risk, or ad models and I’ll narrow the path.';
}

export function describeBotIntent(query: string): string {
  const normalized = normalizeText(query);
  const all = [...ORACLE_TOPICS, ...PROFIT_TOPICS];
  const best = scoreKnowledge(query, all);
  return best?.item.id ?? 'general';
}

export function renderContextAwareGreeting(userName?: string): string {
  const name = userName?.trim() || 'seeker';
  return `Welcome back, ${name}. The Matrix is ready. Ask about MTX, wallet safety, casino rules, monetization, or growth.`;
}

export function buildBotAnswer(mode: BotMode, query: string, context: BotContext = {}): string {
  return mode === 'profit' ? buildProfitResponse(query, context) : buildOracleResponse(query, context);
}

export const ORACLE_KNOWLEDGE = ORACLE_TOPICS;
export const PROFIT_KNOWLEDGE = PROFIT_TOPICS;
