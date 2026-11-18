// Shared playing-card primitives for the Free-Play Floor.
// Cards are rendered by our own components (text/CSS suits) — no
// third-party card art is used anywhere on the floor.

export type Suit = 'spades' | 'hearts' | 'diamonds' | 'clubs';

export type Rank =
  | 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K';

export interface Card {
  suit: Suit;
  rank: Rank;
}

export const SUITS: Suit[] = ['spades', 'hearts', 'diamonds', 'clubs'];

export const RANKS: Rank[] = [
  'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K',
];

export const SUIT_GLYPH: Record<Suit, string> = {
  spades: '♠',
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
};

export const RED_SUITS: ReadonlySet<Suit> = new Set(['hearts', 'diamonds']);

/** Random source in [0, 1). Injectable so engine tests can seed a shoe. */
export type Rng = () => number;

export const defaultRng: Rng = () => Math.random();

/** Numeric rank for ordering/comparison: 2..10, J=11, Q=12, K=13, A=14. */
export function rankValue(rank: Rank): number {
  if (rank === 'A') return 14;
  if (rank === 'K') return 13;
  if (rank === 'Q') return 12;
  if (rank === 'J') return 11;
  return parseInt(rank, 10);
}

/** Blackjack value: face cards 10, ace 11 (soft handling lives in the engine). */
export function blackjackValue(rank: Rank): number {
  if (rank === 'A') return 11;
  if (rank === 'K' || rank === 'Q' || rank === 'J') return 10;
  return parseInt(rank, 10);
}

export function buildDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ suit, rank });
    }
  }
  return deck;
}

/** Fisher–Yates shuffle; returns a new array, input untouched. */
export function shuffled(cards: Card[], rng: Rng): Card[] {
  const out = cards.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** A shuffled shoe of `decks` standard decks. Draw with pop(). */
export function buildShoe(decks: number, rng: Rng): Card[] {
  const all: Card[] = [];
  for (let d = 0; d < decks; d++) all.push(...buildDeck());
  return shuffled(all, rng);
}

export function cardLabel(card: Card): string {
  return `${card.rank}${SUIT_GLYPH[card.suit]}`;
}
