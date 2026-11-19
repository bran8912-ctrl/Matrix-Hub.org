// Dice Game Engine for Matrix-Hub Casino
export interface DiceResult {
  roll: number;
  target: number;
  win: boolean;
  payout: number;
}

export class DiceEngine {
  static readonly BET_AMOUNT = 1; // 1 MTX per roll
  static readonly MAX_BET_AMOUNT = 1000; // CasinoCore on-chain maximum bet (MTX)
  static readonly MAX_PAYOUT = 100; // CasinoCore on-chain per-bet payout cap (MTX)
  static readonly MIN_TARGET = 2;
  static readonly MAX_TARGET = 98;

  /**
   * Roll the dice using provably fair hash
   */
  static roll(hash: string, target: number, betAmount: number): DiceResult {
    // Generate roll from 1-100 using hash
    const roll = (parseInt(hash.slice(0, 8), 16) % 100) + 1;
    
    // Win if roll is under target
    const win = roll < target;
    
    // Calculate payout based on odds
    // Higher target = easier to win = lower payout
    const winChance = (target - 1) / 100;
    const multiplier = win ? (0.98 / winChance) : 0; // 98% RTP
    const payout = win ? betAmount * multiplier : 0;

    return {
      roll,
      target,
      win,
      payout,
    };
  }

  /**
   * Validate bet and target
   */
  static validateBet(amount: number, target: number): string | null {
    if (amount < this.BET_AMOUNT) {
      return `Minimum bet is ${this.BET_AMOUNT} MTX`;
    }
    if (amount > this.MAX_BET_AMOUNT) {
      return `Maximum bet is ${this.MAX_BET_AMOUNT} MTX`;
    }
    if (target < this.MIN_TARGET || target > this.MAX_TARGET) {
      return `Target must be between ${this.MIN_TARGET} and ${this.MAX_TARGET}`;
    }
    return null;
  }

  /**
   * Calculate potential multiplier for a given target
   */
  static calculateMultiplier(target: number): number {
    const winChance = (target - 1) / 100;
    return 0.98 / winChance;
  }
}
