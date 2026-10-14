/**
 * Example: Integrating spendMTX in a Casino Game
 * 
 * This file demonstrates how to integrate the MTX transfer utility
 * in a casino game component for placing bets.
 */

import { spendMTX } from '../../src/utils/mtxTransfer';

// Casino vault address (replace with actual deployed vault address)
const CASINO_VAULT_ADDRESS = '0x0000000000000000000000000000000000000000';

/**
 * Example: Place a casino bet using spendMTX
 */
export async function placeCasinoBet(betAmount: number, gameType: string) {
  try {
    console.log(`Placing ${betAmount} MTX bet on ${gameType}...`);
    
    // Transfer MTX to casino vault
    const txHash = await spendMTX(
      CASINO_VAULT_ADDRESS,
      betAmount.toString()
    );
    
    console.log('Bet transaction successful:', txHash);
    
    // Call backend API to register bet
    const response = await fetch('/api/place-bet', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        gameType,
        betAmount,
        txHash,
      })
    });
    
    const result = await response.json();
    
    return {
      success: true,
      txHash,
      gameId: result.gameId,
      message: `Bet placed successfully!`
    };
    
  } catch (error: any) {
    console.error('Failed to place bet:', error);
    
    if (error.message.includes('Insufficient MTX balance')) {
      return {
        success: false,
        message: `Insufficient MTX. You need ${betAmount} MTX to play.`
      };
    } else if (error.message.includes('rejected')) {
      return {
        success: false,
        message: 'Transaction was cancelled.'
      };
    } else {
      return {
        success: false,
        message: 'Failed to place bet. Please try again.'
      };
    }
  }
}
