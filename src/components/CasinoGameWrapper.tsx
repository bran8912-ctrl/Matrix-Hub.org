import React, { useState, useEffect, useCallback } from 'react';
import type { Eip1193Provider } from 'ethers';
import { useAppKitProvider, useAppKitAccount, useAppKit } from '@reown/appkit/react'
import { MTX } from '../config/mtx';
import {
  claimCasinoPayout,
  getCasinoBetStatus,
  placeCasinoBet,
  type BetResult,
  type BetStatus,
} from '../utils/casinoBet';
import { Casino } from '../config/casino';

// Deployed MTX token contract address and ABI
const MTX_TOKEN_ADDRESS = MTX.address;
const MTX_TOKEN_ABI = [
  // Minimal ABI for ERC-20 balanceOf
  "function balanceOf(address owner) view returns (uint256)",
  "function decimals() view returns (uint8)",
];

interface CasinoGameWrapperProps {
  game?: string;
  children: (props: {
    walletAddress?: string;
    mtxBalance: number;
    placeBet: (amount: number, target: number) => Promise<BetResult>;
    getBetStatus: (betId: string) => Promise<BetStatus>;
    claimPayout: (betId: string) => Promise<string>;
    refreshBalance: () => void;
  }) => React.ReactNode;
}

export default function CasinoGameWrapper({ game, children }: CasinoGameWrapperProps) {
  const { address, isConnected } = useAppKitAccount()
  const { walletProvider } = useAppKitProvider('eip155')
  const { open } = useAppKit()
  
  const [balance, setBalance] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  const fetchBalance = useCallback(async () => {
    // Only run client-side and when wallet is connected
    if (typeof window === 'undefined' || !isConnected || !address || !walletProvider) {
      setBalance(0)
      return
    }

    // Skip balance fetch if the MTX contract is not yet deployed
    if (!MTX.isDeployed) {
      setBalance(0)
      return
    }

    try {
      // Dynamically import ethers so the server/build step won't try to bundle it
      const { BrowserProvider, Contract, formatUnits } = await import('ethers');

      const provider = new BrowserProvider(walletProvider as unknown as Eip1193Provider)
      const token = new Contract(MTX_TOKEN_ADDRESS, MTX_TOKEN_ABI, provider)
      const rawBalance = await token.balanceOf(address)
      const decimals = await token.decimals()
      const formatted = Number(formatUnits(rawBalance, decimals))
      setBalance(formatted)
      setError('') // Clear any previous transient error on success
    } catch (err) {
      setError('Failed to fetch MTX balance.')
      console.error(err)
    }
  }, [isConnected, address, walletProvider]);

  // Fetch MTX balance when wallet is connected (runs client-side)
  useEffect(() => {
    fetchBalance()
  }, [fetchBalance])

  const handlePlaceBet = useCallback(async (amount: number, target: number): Promise<BetResult> => {
    if (!walletProvider) {
      throw new Error('Wallet not connected.');
    }
    const result = await placeCasinoBet(walletProvider as unknown as Eip1193Provider, amount, target);
    // Refresh balance after bet
    await fetchBalance();
    return result;
  }, [walletProvider, fetchBalance]);

  const handleGetBetStatus = useCallback(async (betId: string): Promise<BetStatus> => {
    if (!walletProvider) throw new Error('Wallet not connected.');
    return getCasinoBetStatus(walletProvider as unknown as Eip1193Provider, betId);
  }, [walletProvider]);

  const handleClaimPayout = useCallback(async (betId: string): Promise<string> => {
    if (!walletProvider) throw new Error('Wallet not connected.');
    const txHash = await claimCasinoPayout(walletProvider as unknown as Eip1193Provider, betId);
    await fetchBalance();
    return txHash;
  }, [walletProvider, fetchBalance]);

  if (game !== 'dice') {
    return (
      <div className="max-w-2xl mx-auto p-6 bg-gray-900 rounded-lg border-2 border-yellow-500 text-center">
        <h3 className="text-2xl font-bold text-yellow-300 mb-3">Game unavailable</h3>
        <p className="text-gray-300">
          This game is disabled until its outcome and payout are settled from an on-chain VRF request.
        </p>
        <a href="/games/casino/dice" className="inline-block mt-4 text-green-400 underline">
          Go to Dice
        </a>
      </div>
    );
  }

  if (!Casino.isFullyDeployed) {
    return (
      <div className="max-w-2xl mx-auto p-6 bg-gray-900 rounded-lg border-2 border-yellow-500 text-center">
        <h3 className="text-2xl font-bold text-yellow-300 mb-3">Dice wagers are not live</h3>
        <p className="text-gray-300">
          The VRF casino contracts have not been deployed and validated on {Casino.chainName}.
          No MTX will be transferred.
        </p>
      </div>
    );
  }

  return (
    <div>
      {!isConnected || !address ? (
        <div className="max-w-2xl mx-auto p-6 bg-gray-900 rounded-lg border-2 border-green-500 text-center">
          <h3 className="text-2xl font-bold text-green-400 mb-4">Connect Your Wallet</h3>
          <p className="text-gray-300 mb-6">Connect your wallet to check your MTX balance and play casino games.</p>
          <button
            onClick={async () => { setLoading(true); await open(); setLoading(false); }}
            disabled={loading}
            className="bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white font-bold py-3 px-6 rounded-lg text-lg transition-colors"
          >
            {loading ? 'Connecting...' : 'Connect Wallet'}
          </button>
          {error && (
            <div className="mt-4 text-red-400">{error}</div>
          )}
        </div>
      ) : (
        <>
          <div className="mb-4 p-4 bg-gray-800 rounded-lg border border-green-500">
            <div className="flex justify-between items-center">
              <div>
                <span className="text-gray-400">Wallet: </span>
                <span className="text-green-400 font-mono">{address.slice(0, 6)}...{address.slice(-4)}</span>
              </div>
              <div>
                <span className="text-gray-400">MTX Balance: </span>
                <span className="text-yellow-400 font-bold">{balance.toFixed(2)} MTX</span>
              </div>
            </div>
          </div>
          {children({
            walletAddress: address,
            mtxBalance: balance,
            placeBet: handlePlaceBet,
            getBetStatus: handleGetBetStatus,
            claimPayout: handleClaimPayout,
            refreshBalance: fetchBalance,
          })}
        </>
      )}
    </div>
  );
}
