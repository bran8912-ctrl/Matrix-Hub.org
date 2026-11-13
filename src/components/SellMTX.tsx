import React, { useState, useEffect } from 'react';
import { MTX } from '../config/mtx';
import mtxAbi from '../abi/mtx.json';

/**
 * SellMTX Component - Read-only MTX balance for the connected wallet.
 *
 * MTX is non-custodial: buying mints it straight into the buyer's own
 * wallet, so Matrix Hub never holds it and there is nothing to withdraw
 * from the site. Cashing out means swapping MTX for POL on QuickSwap —
 * the swap button lives on the page next to this component. This
 * component only reads the balance; it never sends a transaction.
 */
const SellMTX: React.FC = () => {
  const [account, setAccount] = useState('');
  const [balance, setBalance] = useState('');
  const [note, setNote] = useState('');

  useEffect(() => {
    const readBalance = async () => {
      if (!MTX.isDeployed) {
        setNote('MTX contract address is not configured yet.');
        return;
      }
      if (!window.ethereum) {
        setNote('No wallet detected. Install MetaMask or a compatible wallet, connect it, and this page will show the MTX balance it holds.');
        return;
      }
      try {
        const { BrowserProvider, Contract, formatEther } = await import('ethers');
        const provider = new BrowserProvider(window.ethereum as any);
        // eth_accounts reads the already-connected account without a popup.
        const accounts: string[] = await (window.ethereum as any).request({ method: 'eth_accounts' });
        if (!accounts || accounts.length === 0) {
          setAccount('');
          setBalance('');
          setNote('Connect your wallet using the button at the top of the page, and your MTX balance will show here.');
          return;
        }
        const address = accounts[0];
        const mtxContract = new Contract(MTX.address, mtxAbi, provider);
        const rawBalance = await mtxContract.balanceOf(address);
        setAccount(address);
        setBalance(
          Number(formatEther(rawBalance)).toLocaleString('en-US', { maximumFractionDigits: 4 })
        );
        setNote('');
      } catch (err) {
        console.error('Error reading MTX balance:', err);
        setNote('Could not read your MTX balance from the blockchain. Refresh the page and make sure your wallet is on Polygon (Chain ID 137).');
      }
    };

    readBalance();

    const eth = window.ethereum as any;
    if (eth?.on) {
      eth.on('accountsChanged', readBalance);
      eth.on('chainChanged', readBalance);
      return () => {
        eth.removeListener?.('accountsChanged', readBalance);
        eth.removeListener?.('chainChanged', readBalance);
      };
    }
  }, []);

  const shortAccount = account ? `${account.slice(0, 6)}…${account.slice(-4)}` : '';

  return (
    <div className="sell-mtx">
      {account && balance !== '' ? (
        <div
          className="balance"
          style={{
            textAlign: 'center',
            padding: '1.5rem',
            background: 'rgba(0, 255, 153, 0.05)',
            border: '1px solid rgba(0, 255, 153, 0.2)',
            borderRadius: '8px',
            minWidth: '280px',
          }}
        >
          <div style={{ fontSize: '0.95rem', opacity: 0.85, marginBottom: '0.5rem' }}>
            Your MTX balance
          </div>
          <div
            style={{
              fontSize: '2rem',
              fontWeight: 'bold',
              color: 'var(--theme-primary)',
              fontFamily: "'Courier New', monospace",
            }}
          >
            {balance} MTX
          </div>
          <div style={{ fontSize: '0.85rem', opacity: 0.75, marginTop: '0.5rem' }}>
            Wallet {shortAccount} · Polygon
          </div>
        </div>
      ) : (
        <div className="note" style={{ textAlign: 'center', maxWidth: '480px', lineHeight: 1.6 }}>
          {note || 'Connect your wallet using the button at the top of the page, and your MTX balance will show here.'}
        </div>
      )}
    </div>
  );
};

export default SellMTX;
