// Free-Play Video Poker engine — Jacks or Better, full-pay 9/6 table.
// Pure logic: hand evaluation, payouts, and a "Suggest holds" helper that
// follows the standard simple-strategy order for 9/6 Jacks or Better.

import { type Card, rankValue } from './cards';

export type PokerCategory =
  | 'royal-flush'
  | 'straight-flush'
  | 'four-of-a-kind'
  | 'full-house'
  | 'flush'
  | 'straight'
  | 'three-of-a-kind'
  | 'two-pair'
  | 'jacks-or-better'
  | 'nothing';

export interface PaytableRow {
  category: PokerCategory;
  label: string;
  /** Total credits paid when betting 1..5 coins (index 0 = 1 coin). */
  pays: [number, number, number, number, number];
}

export const PAYTABLE: PaytableRow[] = [
  { category: 'royal-flush', label: 'Royal Flush', pays: [250, 500, 750, 1000, 4000] },
  { category: 'straight-flush', label: 'Straight Flush', pays: [50, 100, 150, 200, 250] },
  { category: 'four-of-a-kind', label: 'Four of a Kind', pays: [25, 50, 75, 100, 125] },
  { category: 'full-house', label: 'Full House', pays: [9, 18, 27, 36, 45] },
  { category: 'flush', label: 'Flush', pays: [6, 12, 18, 24, 30] },
  { category: 'straight', label: 'Straight', pays: [4, 8, 12, 16, 20] },
  { category: 'three-of-a-kind', label: 'Three of a Kind', pays: [3, 6, 9, 12, 15] },
  { category: 'two-pair', label: 'Two Pair', pays: [2, 4, 6, 8, 10] },
  { category: 'jacks-or-better', label: 'Jacks or Better', pays: [1, 2, 3, 4, 5] },
];

export function payoutFor(category: PokerCategory, betCoins: number): number {
  const row = PAYTABLE.find((r) => r.category === category);
  if (!row) return 0;
  const idx = Math.min(Math.max(betCoins, 1), 5) - 1;
  return row.pays[idx];
}

export interface PokerEval {
  category: PokerCategory;
  label: string;
}

const CATEGORY_LABEL: Record<PokerCategory, string> = {
  'royal-flush': 'Royal Flush',
  'straight-flush': 'Straight Flush',
  'four-of-a-kind': 'Four of a Kind',
  'full-house': 'Full House',
  flush: 'Flush',
  straight: 'Straight',
  'three-of-a-kind': 'Three of a Kind',
  'two-pair': 'Two Pair',
  'jacks-or-better': 'Jacks or Better',
  nothing: 'No win',
};

function rankCounts(cards: Card[]): Map<number, number> {
  const counts = new Map<number, number>();
  for (const c of cards) {
    const v = rankValue(c.rank);
    counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  return counts;
}

function isFlush(cards: Card[]): boolean {
  return cards.every((c) => c.suit === cards[0].suit);
}

/** Returns the high card of the straight (5 for the wheel), or 0 if none. */
function straightHigh(cards: Card[]): number {
  const values = [...new Set(cards.map((c) => rankValue(c.rank)))].sort(
    (a, b) => a - b,
  );
  if (values.length !== 5) return 0;
  if (values[4] - values[0] === 4) return values[4];
  // Wheel: A-2-3-4-5
  if (values.join(',') === '2,3,4,5,14') return 5;
  return 0;
}

export function evaluatePokerHand(cards: Card[]): PokerEval {
  if (cards.length !== 5) throw new Error('Poker hand must have 5 cards');
  const counts = rankCounts(cards);
  const groups = [...counts.values()].sort((a, b) => b - a);
  const flush = isFlush(cards);
  const sHigh = straightHigh(cards);

  let category: PokerCategory;
  if (flush && sHigh === 14) category = 'royal-flush';
  else if (flush && sHigh > 0) category = 'straight-flush';
  else if (groups[0] === 4) category = 'four-of-a-kind';
  else if (groups[0] === 3 && groups[1] === 2) category = 'full-house';
  else if (flush) category = 'flush';
  else if (sHigh > 0) category = 'straight';
  else if (groups[0] === 3) category = 'three-of-a-kind';
  else if (groups[0] === 2 && groups[1] === 2) category = 'two-pair';
  else if (groups[0] === 2) {
    const pairRank = [...counts.entries()].find(([, n]) => n === 2)![0];
    category = pairRank >= 11 ? 'jacks-or-better' : 'nothing';
  } else category = 'nothing';

  return { category, label: CATEGORY_LABEL[category] };
}

// ─── Suggest holds (simple strategy, 9/6 Jacks or Better) ──────────────
// Ordered rules — the first match wins, mirroring the published simple
// strategy order. Returns a hold mask aligned with the dealt cards.

type Mask = boolean[];

function maskOf(indices: number[]): Mask {
  const mask: Mask = [false, false, false, false, false];
  for (const i of indices) mask[i] = true;
  return mask;
}

const ALL: Mask = [true, true, true, true, true];
const NONE: Mask = [false, false, false, false, false];

function indicesOf(cards: Card[], pred: (c: Card) => boolean): number[] {
  const out: number[] = [];
  cards.forEach((c, i) => {
    if (pred(c)) out.push(i);
  });
  return out;
}

function isHighCard(c: Card): boolean {
  return rankValue(c.rank) >= 11;
}

function isRoyalRank(c: Card): boolean {
  return rankValue(c.rank) >= 10;
}

/** Find 4 cards of one suit contained in `ranks` set (a royal draw). */
function royalDraw(cards: Card[], count: number): number[] | null {
  for (const suit of ['spades', 'hearts', 'diamonds', 'clubs'] as const) {
    const idx = indicesOf(
      cards,
      (c) => c.suit === suit && isRoyalRank(c),
    );
    if (idx.length === count) return idx;
  }
  return null;
}

function suitedIndices(cards: Card[], count: number): number[] | null {
  for (const suit of ['spades', 'hearts', 'diamonds', 'clubs'] as const) {
    const idx = indicesOf(cards, (c) => c.suit === suit);
    if (idx.length === count) return idx;
  }
  return null;
}

/**
 * Find a 4-card straight draw. `outside` = both ends open (no ace, run of
 * four distinct ranks spanning 3, max rank <= K). Inside draws are runs
 * with a gap or an ace end. Returns the indices or null.
 */
function straightDraw(
  cards: Card[],
  kind: 'outside' | 'inside',
  minHighCards = 0,
): number[] | null {
  // Try every 4-card subset.
  for (let skip = 0; skip < 5; skip++) {
    const idx = [0, 1, 2, 3, 4].filter((i) => i !== skip);
    const values = idx.map((i) => rankValue(cards[i].rank));
    if (new Set(values).size !== 4) continue;
    const sorted = [...values].sort((a, b) => a - b);
    const hasAce = sorted.includes(14);
    const span = sorted[3] - sorted[0];
    // Ace-low draws (A-2-3-4, A-3-4-5, ...): the ace plays low, so the
    // other three ranks sit within 2..5 and the draw completes with the
    // one missing low card — always an inside draw.
    const aceLowShape = hasAce && sorted[0] >= 2 && sorted[2] <= 5;
    const effectiveSpan = aceLowShape ? 3 : span;
    const isRunShape =
      aceLowShape || effectiveSpan <= 4;
    if (!isRunShape) continue;
    const isOutside =
      !hasAce && effectiveSpan === 3 && sorted[3] <= 13 && sorted[0] >= 2;
    if (kind === 'outside' && !isOutside) continue;
    if (kind === 'inside' && isOutside) continue;
    const highCards = values.filter((v) => v >= 11).length;
    if (highCards < minHighCards) continue;
    return idx;
  }
  return null;
}

/** Find a 3-card straight-flush draw (same suit, straight still possible). */
function straightFlushDraw3(cards: Card[]): number[] | null {
  for (let a = 0; a < 5; a++)
    for (let b = a + 1; b < 5; b++)
      for (let c = b + 1; c < 5; c++) {
        const idx = [a, b, c];
        const trio = idx.map((i) => cards[i]);
        if (!trio.every((t) => t.suit === trio[0].suit)) continue;
        const values = trio.map((t) => rankValue(t.rank)).sort((x, y) => x - y);
        if (new Set(values).size !== 3) continue;
        // Straight possible if the three ranks fit inside some 5-rank window.
        const aceLow = values[2] === 14 && values[0] === 2 && values[1] <= 4;
        if (aceLow || values[2] - values[0] <= 4) return idx;
      }
  return null;
}

export function suggestHolds(cards: Card[]): Mask {
  if (cards.length !== 5) throw new Error('Poker hand must have 5 cards');
  const evaluation = evaluatePokerHand(cards);
  const counts = rankCounts(cards);

  // 1. Pat royal / straight flush / four of a kind / full house.
  if (
    evaluation.category === 'royal-flush' ||
    evaluation.category === 'straight-flush' ||
    evaluation.category === 'four-of-a-kind' ||
    evaluation.category === 'full-house'
  ) {
    return ALL;
  }

  // 2. Four to a royal flush (beats a pat flush/straight/trips).
  const fourRoyal = royalDraw(cards, 4);
  if (fourRoyal) return maskOf(fourRoyal);

  // 3. Pat flush / pat straight — hold all five.
  if (evaluation.category === 'flush' || evaluation.category === 'straight') {
    return ALL;
  }
  // 3b. Three of a kind — hold the trips.
  if (evaluation.category === 'three-of-a-kind') {
    const tripsRank = [...counts.entries()].find(([, n]) => n === 3)![0];
    return maskOf(indicesOf(cards, (c) => rankValue(c.rank) === tripsRank));
  }

  // 4. Four to a straight flush.
  for (const suit of ['spades', 'hearts', 'diamonds', 'clubs'] as const) {
    const idx = indicesOf(cards, (c) => c.suit === suit);
    if (idx.length === 4) {
      const values = idx.map((i) => rankValue(cards[i].rank));
      if (new Set(values).size === 4) {
        const sorted = [...values].sort((a, b) => a - b);
        const aceLow =
          sorted[3] === 14 && sorted[0] >= 2 && sorted[2] <= 5;
        if (aceLow || sorted[3] - sorted[0] <= 4) return maskOf(idx);
      }
    }
  }

  // 5. Two pair — hold both pairs.
  if (evaluation.category === 'two-pair') {
    const pairRanks = [...counts.entries()]
      .filter(([, n]) => n === 2)
      .map(([r]) => r);
    return maskOf(
      indicesOf(cards, (c) => pairRanks.includes(rankValue(c.rank))),
    );
  }

  // 6. High pair (jacks or better).
  const pairEntry = [...counts.entries()].find(([, n]) => n === 2);
  if (pairEntry && pairEntry[0] >= 11) {
    return maskOf(indicesOf(cards, (c) => rankValue(c.rank) === pairEntry[0]));
  }

  // 7. Three to a royal flush.
  const threeRoyal = royalDraw(cards, 3);
  if (threeRoyal) return maskOf(threeRoyal);

  // 8. Four to a flush.
  const fourFlush = suitedIndices(cards, 4);
  if (fourFlush) return maskOf(fourFlush);

  // 9. Low pair.
  if (pairEntry) {
    return maskOf(indicesOf(cards, (c) => rankValue(c.rank) === pairEntry[0]));
  }

  // 10. Four to an outside straight.
  const outside = straightDraw(cards, 'outside');
  if (outside) return maskOf(outside);

  // 11. Two suited high cards.
  for (const suit of ['spades', 'hearts', 'diamonds', 'clubs'] as const) {
    const idx = indicesOf(
      cards,
      (c) => c.suit === suit && isHighCard(c),
    );
    if (idx.length >= 2) return maskOf(idx.slice(0, 2));
  }

  // 12. Three to a straight flush.
  const sfDraw = straightFlushDraw3(cards);
  if (sfDraw) return maskOf(sfDraw);

  // 13. Four to an inside straight with 3+ high cards.
  const inside3 = straightDraw(cards, 'inside', 3);
  if (inside3) return maskOf(inside3);

  // 14. QJ unsuited.
  const hasRank = (r: number) =>
    indicesOf(cards, (c) => rankValue(c.rank) === r);
  const queens = hasRank(12);
  const jacks = hasRank(11);
  if (queens.length && jacks.length) {
    return maskOf([queens[0], jacks[0]]);
  }

  // 15. Four to an inside straight with 2 high cards.
  const inside2 = straightDraw(cards, 'inside', 2);
  if (inside2) return maskOf(inside2);

  // 16. KQ or KJ unsuited.
  const kings = hasRank(13);
  if (kings.length && queens.length) return maskOf([kings[0], queens[0]]);
  if (kings.length && jacks.length) return maskOf([kings[0], jacks[0]]);

  // 17. Suited ten + high card (JT / QT / KT suited).
  const tens = hasRank(10);
  if (tens.length) {
    for (const i of tens) {
      const partner = indicesOf(
        cards,
        (c) => c.suit === cards[i].suit && isHighCard(c),
      );
      if (partner.length) return maskOf([i, partner[0]]);
    }
  }

  // 18. Two unsuited high cards (take the two lowest — charts prefer
  // keeping the lower pair of high cards when three are present).
  const highIdx = indicesOf(cards, isHighCard);
  if (highIdx.length >= 2) {
    const sorted = [...highIdx].sort(
      (a, b) => rankValue(cards[a].rank) - rankValue(cards[b].rank),
    );
    return maskOf([sorted[0], sorted[1]]);
  }

  // 19. One high card — prefer J, then Q, then K, then A.
  for (const r of [11, 12, 13, 14]) {
    const idx = hasRank(r);
    if (idx.length) return maskOf([idx[0]]);
  }

  // 20. Nothing worth keeping.
  return NONE;
}
