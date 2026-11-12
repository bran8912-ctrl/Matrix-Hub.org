// Slots Game Engine for Matrix-Hub Casino — DISPLAY / VERIFICATION ONLY.
//
// The authoritative Slots maths live on-chain in CasinoCore
// (placeSlotsBet / slotsSymbolAt / slotsReelsFromWord /
// slotsMultiplierForReels / slotsRtpBps). This module mirrors them
// exactly so the UI can render symbols and a player can verify a
// settled spin off-chain. It must NEVER decide the outcome of a bet:
// outcomes come only from the VRF word settled by CasinoCore.
//
// Design: bot-core/go-live/next-casino-game-design.md (Nina Petrov,
// 2026-11-10). 3 reels, 20 stops each, one shared strip:
// SEVEN x1, BAR x2, BELL x3, PLUM x4, LEMON x4, CHERRY x6 (8,000 combos).
// Paytable (multiplier of the bet): 3x SEVEN 100, 3x BAR 100,
// 3x BELL 40, 3x PLUM 25, 3x LEMON 15, 3x CHERRY 12, two CHERRY on
// reels 1-2 only 1x (stake back). RTP = 7,636 / 8,000 = 95.45%.

export const SLOTS_SYMBOL_NAMES = ['SEVEN', 'BAR', 'BELL', 'PLUM', 'LEMON', 'CHERRY'] as const;
export const SLOTS_SYMBOL_EMOJI = ['7️⃣', '🍺', '🔔', '🟣', '🍋', '🍒'] as const;

/** Symbol id at each of the 20 stop positions (index = position). */
export const SLOTS_STRIP: readonly number[] = [
  0, // 0: SEVEN
  1, 1, // 1-2: BAR
  2, 2, 2, // 3-5: BELL
  3, 3, 3, 3, // 6-9: PLUM
  4, 4, 4, 4, // 10-13: LEMON
  5, 5, 5, 5, 5, 5, // 14-19: CHERRY
];

export interface SlotsResult {
  reels: [number, number, number];
  symbols: [number, number, number];
  win: boolean;
  payout: number;
  multiplier: number;
}

export class SlotsEngine {
  static readonly BET_AMOUNT = 1; // 1 MTX per spin (v1, bounded by the 100 MTX max-payout cap)
  static readonly MAX_MULTIPLIER = 100;
  static readonly RTP = 0.9545; // 95.45%

  static symbolAt(position: number): number {
    return SLOTS_STRIP[position];
  }

  static symbolEmoji(symbolId: number): string {
    return SLOTS_SYMBOL_EMOJI[symbolId] ?? '❓';
  }

  static symbolName(symbolId: number): string {
    return SLOTS_SYMBOL_NAMES[symbolId] ?? 'UNKNOWN';
  }

  /** The exact on-chain derivation: word % 20, (word / 20) % 20, (word / 400) % 20. */
  static reelsFromWord(word: bigint): [number, number, number] {
    return [
      Number(word % 20n),
      Number((word / 20n) % 20n),
      Number((word / 400n) % 20n),
    ];
  }

  static multiplierForReels(reels: readonly [number, number, number]): number {
    const [s0, s1, s2] = reels.map((position) => SLOTS_STRIP[position]);
    if (s0 === s1 && s1 === s2) {
      return [100, 100, 40, 25, 15, 12][s0];
    }
    if (s0 === 5 && s1 === 5) return 1; // two CHERRY, reels 1-2 only
    return 0;
  }

  /** Reproduce a settled spin from its VRF word (verification display only). */
  static resultFromWord(word: bigint, betAmount: number): SlotsResult {
    const reels = SlotsEngine.reelsFromWord(word);
    const symbols = reels.map((position) => SLOTS_STRIP[position]) as [number, number, number];
    const multiplier = SlotsEngine.multiplierForReels(reels);
    const payout = betAmount * multiplier;
    return { reels, symbols, win: payout > 0, payout, multiplier };
  }

  static validateBet(amount: number): string | null {
    if (amount !== SlotsEngine.BET_AMOUNT) {
      return `Slots v1 accepts exactly ${SlotsEngine.BET_AMOUNT} MTX per spin`;
    }
    return null;
  }
}
