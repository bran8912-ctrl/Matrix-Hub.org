// Free-Play Blackjack engine — pure game logic, no UI, no wallet, no MTX.
// Rules (stated on the table): 6-deck shoe, dealer stands on all 17s,
// blackjack pays 3:2, double on any first two cards, split to up to 4
// hands, split aces take exactly one card each. No insurance, no surrender.
//
// Money model: the caller charges bets as they are placed (initial bet,
// +bet per split hand, +bet on double) and credits back `credit` per hand
// at settlement — win returns 2x bet, blackjack 2.5x, push 1x, loss 0.

import {
  type Card,
  type Rng,
  blackjackValue,
  buildShoe,
} from './cards';

export const SHOE_DECKS = 6;
/** Reshuffle point: a fresh shoe is cut in when fewer cards remain. */
export const RESHUFFLE_AT = 52;

export interface HandValue {
  total: number;
  soft: boolean;
}

export function handValue(cards: Card[]): HandValue {
  let total = 0;
  let aces = 0;
  for (const c of cards) {
    total += blackjackValue(c.rank);
    if (c.rank === 'A') aces++;
  }
  let soft = aces > 0;
  while (total > 21 && aces > 0) {
    total -= 10;
    aces--;
    if (aces === 0) soft = false;
  }
  return { total, soft: soft && total <= 21 };
}

export function isBlackjack(cards: Card[]): boolean {
  return cards.length === 2 && handValue(cards).total === 21;
}

export type HandOutcome = 'blackjack' | 'win' | 'lose' | 'push' | 'bust';

export interface PlayerHand {
  cards: Card[];
  bet: number;
  doubled: boolean;
  /** This hand came from splitting aces: one card only, no actions. */
  fromSplitAces: boolean;
  done: boolean;
  outcome?: HandOutcome;
  /** Amount credited back to the bankroll at settlement. */
  credit?: number;
}

export type RoundPhase = 'player' | 'settled';

export class BlackjackRound {
  readonly hands: PlayerHand[] = [];
  readonly dealerCards: Card[] = [];
  active = 0;
  phase: RoundPhase = 'player';
  /** True when the dealer was dealt blackjack (hand ends at the deal). */
  readonly dealerBlackjack: boolean;
  /** True when the player's original hand was blackjack. */
  readonly playerBlackjack: boolean;

  private shoe: Card[];

  constructor(shoe: Card[], bet: number) {
    this.shoe = shoe;
    const hand: PlayerHand = {
      cards: [],
      bet,
      doubled: false,
      fromSplitAces: false,
      done: false,
    };
    this.hands.push(hand);
    // Deal order: player, dealer (up), player, dealer (hole).
    hand.cards.push(this.draw());
    this.dealerCards.push(this.draw());
    hand.cards.push(this.draw());
    this.dealerCards.push(this.draw());

    this.dealerBlackjack = isBlackjack(this.dealerCards);
    this.playerBlackjack = isBlackjack(hand.cards);
    if (this.dealerBlackjack || this.playerBlackjack) {
      this.settle();
    }
  }

  private draw(): Card {
    const card = this.shoe.pop();
    if (!card) throw new Error('Shoe exhausted mid-round');
    return card;
  }

  get activeHand(): PlayerHand | undefined {
    return this.hands[this.active];
  }

  /** The dealer's face-up card (the second card dealt to the player sees index 0). */
  get dealerUpCard(): Card {
    return this.dealerCards[0];
  }

  canDouble(hand: PlayerHand): boolean {
    return (
      this.phase === 'player' &&
      !hand.done &&
      hand.cards.length === 2 &&
      !hand.fromSplitAces
    );
  }

  canSplit(hand: PlayerHand): boolean {
    return (
      this.phase === 'player' &&
      !hand.done &&
      hand.cards.length === 2 &&
      !hand.fromSplitAces &&
      this.hands.length < 4 &&
      blackjackValue(hand.cards[0].rank) === blackjackValue(hand.cards[1].rank)
    );
  }

  hit(): void {
    const hand = this.requireActive();
    hand.cards.push(this.draw());
    if (handValue(hand.cards).total >= 21) {
      hand.done = true;
      this.advance();
    }
  }

  stand(): void {
    const hand = this.requireActive();
    hand.done = true;
    this.advance();
  }

  /** Double down: caller charges one extra bet before/after calling. */
  double(): void {
    const hand = this.requireActive();
    if (!this.canDouble(hand)) throw new Error('Double not available');
    hand.doubled = true;
    hand.bet *= 2;
    hand.cards.push(this.draw());
    hand.done = true;
    this.advance();
  }

  /** Split the active pair. Caller charges one extra bet for the new hand. */
  split(): void {
    const hand = this.requireActive();
    if (!this.canSplit(hand)) throw new Error('Split not available');
    const [first, second] = hand.cards;
    const aces = first.rank === 'A';
    hand.cards = [first];
    hand.fromSplitAces = aces;
    const spawned: PlayerHand = {
      cards: [second],
      bet: hand.bet,
      doubled: false,
      fromSplitAces: aces,
      done: false,
    };
    this.hands.splice(this.active + 1, 0, spawned);
    hand.cards.push(this.draw());
    if (aces) {
      // Split aces take exactly one card and then stand automatically.
      hand.done = true;
      this.advance();
    } else if (handValue(hand.cards).total === 21) {
      hand.done = true;
      this.advance();
    }
  }

  private requireActive(): PlayerHand {
    const hand = this.activeHand;
    if (this.phase !== 'player' || !hand || hand.done) {
      throw new Error('No active hand');
    }
    return hand;
  }

  private advance(): void {
    this.active++;
    while (this.active < this.hands.length) {
      const hand = this.hands[this.active];
      if (hand.cards.length === 1) {
        hand.cards.push(this.draw());
      }
      if (hand.fromSplitAces) {
        hand.done = true;
        this.active++;
        continue;
      }
      if (handValue(hand.cards).total === 21) {
        hand.done = true;
        this.active++;
        continue;
      }
      break;
    }
    if (this.active >= this.hands.length) {
      this.dealerPlay();
      this.settle();
    }
  }

  private dealerPlay(): void {
    const anyLive = this.hands.some(
      (h) => handValue(h.cards).total <= 21,
    );
    if (!anyLive) return; // every hand busted — dealer does not draw
    // Dealer stands on all 17s, including soft 17.
    while (handValue(this.dealerCards).total < 17) {
      this.dealerCards.push(this.draw());
    }
  }

  private settle(): void {
    this.phase = 'settled';
    const dealerTotal = handValue(this.dealerCards).total;
    const dealerBust = dealerTotal > 21;
    for (const hand of this.hands) {
      const total = handValue(hand.cards).total;
      if (total > 21) {
        hand.outcome = 'bust';
        hand.credit = 0;
      } else if (
        this.playerBlackjack &&
        this.hands.length === 1 &&
        hand === this.hands[0]
      ) {
        if (this.dealerBlackjack) {
          hand.outcome = 'push';
          hand.credit = hand.bet;
        } else {
          hand.outcome = 'blackjack';
          hand.credit = hand.bet * 2.5; // stake back + 3:2
        }
      } else if (this.dealerBlackjack) {
        hand.outcome = 'lose';
        hand.credit = 0;
      } else if (dealerBust) {
        hand.outcome = 'win';
        hand.credit = hand.bet * 2;
      } else if (total > dealerTotal) {
        hand.outcome = 'win';
        hand.credit = hand.bet * 2;
      } else if (total < dealerTotal) {
        hand.outcome = 'lose';
        hand.credit = 0;
      } else {
        hand.outcome = 'push';
        hand.credit = hand.bet;
      }
      hand.done = true;
    }
  }

  /** Total amount to credit back across all hands (valid once settled). */
  totalCredit(): number {
    return this.hands.reduce((sum, h) => sum + (h.credit ?? 0), 0);
  }
}

/** A fresh shuffled shoe for the table. */
export function freshShoe(rng: Rng): Card[] {
  return buildShoe(SHOE_DECKS, rng);
}

// ─── Basic strategy hint ────────────────────────────────────────────────
// Standard basic strategy for this table's rules: dealer stands on all
// 17s, double after split allowed, no surrender. Returns the recommended
// action; when the recommended double/split is unavailable the hint falls
// back the way the charts do (double → hit, except soft 18 → stand;
// split → play the hand as its total).

export type StrategyAction = 'hit' | 'stand' | 'double' | 'split';

export interface StrategyHint {
  action: StrategyAction;
  text: string;
}

const ACTION_TEXT: Record<StrategyAction, string> = {
  hit: 'Hit',
  stand: 'Stand',
  double: 'Double down',
  split: 'Split the pair',
};

export function basicStrategyHint(
  cards: Card[],
  dealerUp: Card,
  opts: { canDouble: boolean; canSplit: boolean },
): StrategyHint {
  const up = blackjackValue(dealerUp.rank); // ace = 11
  const { total, soft } = handValue(cards);
  const isPair =
    cards.length === 2 &&
    blackjackValue(cards[0].rank) === blackjackValue(cards[1].rank);

  let action: StrategyAction | undefined;

  if (isPair && opts.canSplit) {
    const pairValue = blackjackValue(cards[0].rank);
    if (cards[0].rank === 'A' || pairValue === 8) action = 'split';
    else if (pairValue === 10) action = 'stand';
    else if (pairValue === 5) action = undefined; // never split 5s — play as hard 10
    else if (pairValue === 4) action = up === 5 || up === 6 ? 'split' : 'hit';
    else if (pairValue === 2 || pairValue === 3)
      action = up >= 2 && up <= 7 ? 'split' : 'hit';
    else if (pairValue === 6) action = up >= 2 && up <= 6 ? 'split' : 'hit';
    else if (pairValue === 7) action = up >= 2 && up <= 7 ? 'split' : 'hit';
    else if (pairValue === 9)
      action = up === 7 || up >= 10 ? 'stand' : 'split';
  }

  if (!action && soft) {
    if (total >= 20) action = 'stand';
    else if (total === 19) action = up === 6 ? 'double' : 'stand';
    else if (total === 18) {
      if (up >= 3 && up <= 6) action = 'double';
      else if (up === 2 || up === 7 || up === 8) action = 'stand';
      else action = 'hit';
    } else if (total === 17) action = up >= 3 && up <= 6 ? 'double' : 'hit';
    else if (total === 15 || total === 16)
      action = up >= 4 && up <= 6 ? 'double' : 'hit';
    else action = up >= 5 && up <= 6 ? 'double' : 'hit'; // soft 13/14
  }

  if (!action) {
    if (total <= 8) action = 'hit';
    else if (total === 9) action = up >= 3 && up <= 6 ? 'double' : 'hit';
    else if (total === 10) action = up <= 9 ? 'double' : 'hit';
    else if (total === 11) action = 'double';
    else if (total === 12) action = up >= 4 && up <= 6 ? 'stand' : 'hit';
    else if (total <= 16) action = up <= 6 ? 'stand' : 'hit';
    else action = 'stand';
  }

  if (action === 'double' && !opts.canDouble) {
    action = soft && total === 18 ? 'stand' : 'hit';
  }
  if (action === 'split' && !opts.canSplit) {
    // Should not happen (split branch requires canSplit), but stay safe.
    action = 'hit';
  }

  return { action, text: ACTION_TEXT[action] };
}
