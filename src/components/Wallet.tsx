import React, { useState, useEffect, useCallback } from 'react';
import { useAppKitProvider, useAppKitAccount, useAppKit } from '@reown/appkit/react'
import { MTX } from '../config/mtx';
import mtxAbi from '../abi/mtx.json';
import { ensureEthereum } from '../utils/mtxTransfer';

/**
 * Wallet component - React island for wallet connection and MTX balance display
 */
const Wallet = () => {
  const { address, isConnected } = useAppKitAccount()
  const { walletProvider } = useAppKitProvider('eip155')
  const { open } = useAppKit()
  
  // State management
  const [balance, setBalance] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [provider, setProvider] = useState(null);

  /**
   * Fetch MTX token balance for the connected address
   */
  const fetchBalance = useCallback(async (ethersProvider, userAddress) => {
    try {
      const { Contract, formatUnits } = await import('ethers');
      const mtxContract = new Contract(MTX.address, mtxAbi, ethersProvider);
      const rawBalance = await mtxContract.balanceOf(userAddress);
      const decimals = await mtxContract.decimals();
      const formattedBalance = formatUnits(rawBalance, decimals);
      setBalance(formattedBalance);
    } catch (err) {
      console.error('Error fetching balance:', err);
      setError('Failed to fetch MTX balance.');
    }
  }, []);

  /**
   * Fetch balance when wallet is connected
   */
  useEffect(() => {
    const updateBalance = async () => {
      if (!isConnected || !address || !walletProvider) {
        setBalance(null)
        setProvider(null)
        return
      }

      try {
        const { BrowserProvider } = await import('ethers');
        const ethersProvider = new BrowserProvider(walletProvider as any)
        setProvider(ethersProvider)
        
        // Ensure we're on the correct network
        await ensureEthereum() // Ensure we're on the correct network (Polygon)
        
        await fetchBalance(ethersProvider, address)
      } catch (err) {
        console.error('Error setting up wallet:', err)
        setError(err.message || 'Failed to set up wallet connection.')
      }
    }

    updateBalance()
  }, [isConnected, address, walletProvider, fetchBalance])

  /**
   * Add MTX token to user's wallet using EIP-747 (wallet_watchAsset)
   */
  const addTokenToWallet = async () => {
    setError('');
    if (!window.ethereum) {
      setError('Polygon wallet not found.');
      return;
    }

    try {
      const wasAdded = await window.ethereum.request({
        method: 'wallet_watchAsset',
        params: {
          type: 'ERC20',
          options: {
            address: MTX.address,
            symbol: MTX.symbol,
            decimals: MTX.decimals,
            // Optional: add image URL when available
            // image: 'https://matrix-hub.org/mtx-logo.png',
          },
        },
      });

      if (wasAdded) {
        console.log('MTX token successfully added to wallet');
      }
    } catch (err) {
      console.error('Error adding token to wallet:', err);
      setError('Failed to add token to wallet.');
    }
  }

  return (
    <div className="wallet-panel">
      {!isConnected ? (
        <button onClick={async () => { await open(); }} className="btn-connect">Connect Wallet</button>
      ) : (
        <div>
          <div className="address">{address}</div>
          <div className="balance">Balance: {balance ?? '—'}</div>
          <div className="actions">
            <button onClick={addTokenToWallet} className="btn-small">Add MTX to Wallet</button>
          </div>
          {error && <div className="error">{error}</div>}
        </div>
      )}
    </div>
  );
}

export default Wallet;
