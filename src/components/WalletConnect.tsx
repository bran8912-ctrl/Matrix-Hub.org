import React, { useState, useEffect, useRef } from 'react';
import { BrowserProvider, formatUnits, parseUnits, Contract } from 'ethers';
import type { Eip1193Provider } from 'ethers';
import { useAppKitProvider, useAppKitAccount, useAppKit } from '@reown/appkit/react'
import { MTX } from '../config/mtx';
import { walletConnectEnabled } from '../config/appkit';
// Shared connect path (task 136): one-tap direct connect through an
// injected browser wallet when present, AppKit modal as fallback. The
// import also guarantees AppKit is initialized before this island
// renders (see lib/initAppKit).
import { connectWallet, hasInjectedWallet, WALLET_DIRECT_HINT } from '../lib/connectWallet';

// Deployed MTX token contract address and ABI
const MTX_TOKEN_ADDRESS = MTX.address;
// MTX: Define ABI for MTX token contract interactions (standard ERC-20 methods)
const MTX_TOKEN_ABI = [
  "function balanceOf(address account) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "function symbol() view returns (string)",
  "function name() view returns (string)"
];

const TIERS = [
  { name: 'Bronze', threshold: 0 },
  { name: 'Silver', threshold: 100 },
  { name: 'Gold', threshold: 1000 },
  { name: 'Platinum', threshold: 10000 },
];

interface WalletConnectProps {
  onWalletChange?: (wallet: { address: string; balance: number }) => void;
}

const WalletConnect: React.FC<WalletConnectProps> = ({ onWalletChange }) => {
  const { address, isConnected } = useAppKitAccount()
  const { walletProvider } = useAppKitProvider('eip155')
  const { open } = useAppKit()
  
  const [balance, setBalance] = useState<number | null>(null);
  const [tier, setTier] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [provider, setProvider] = useState<BrowserProvider | null>(null);
  // Connect-flow state (task 136): `connecting` drives the button label
  // and is always reset via finally; failures land in `error` and render
  // inline in the bar — the bar itself never disappears.
  const [connecting, setConnecting] = useState<boolean>(false);
  const [injectedAvailable] = useState<boolean>(() => hasInjectedWallet());
  const [locked, setLocked] = useState<number>(0);
  const [lockUntil, setLockUntil] = useState<number>(0);

  // Minimizable: the header wallet box was too big on phones and crowded
  // the nav. Keep a slim bar always visible; the full panel opens behind
  // a toggle. Preference persists across pages; small screens start minimized.
  const [minimized, setMinimized] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try {
      const saved = window.localStorage.getItem('matrixhub:wallet:minimized');
      if (saved !== null) return saved === '1';
    } catch {}
    return window.innerWidth < 768;
  });
  const toggleMinimized = (): void => {
    const next = !minimized;
    try { window.localStorage.setItem('matrixhub:wallet:minimized', next ? '1' : '0'); } catch {}
    setMinimized(next);
  };

  const getTier = (bal: number): string => {
    for (let i = TIERS.length - 1; i >= 0; i--) {
      if (bal >= TIERS[i].threshold) return TIERS[i].name;
    }
    return 'Bronze'; 
  };

  // Tracks the previous connected state so wallet_connect success fires once per connect.
  const prevConnectedRef = useRef(false);

  // Fetch MTX balance when wallet is connected
  useEffect(() => {
    const fetchBalance = async () => {
      // Track a successful wallet connection once per connect (transition false → true).
      if (isConnected && !prevConnectedRef.current) {
        (window as any).trackMatrixEvent?.('wallet_connect', { result: 'success' });
        // A successful (re)connect clears any stale connect error copy.
        setError('');
      }
      prevConnectedRef.current = isConnected;

      if (!isConnected || !address || !walletProvider) {
        setBalance(null)
        setTier('')
        setProvider(null)
        return
      }

      try {
        const ethersProvider = new BrowserProvider(walletProvider as any)
        setProvider(ethersProvider)
        
        if (!MTX.isDeployed) {
          setBalance(0)
          setTier(getTier(0))
          if (onWalletChange) {
            onWalletChange({ address, balance: 0 })
          }
          return
        }

        const token = new Contract(MTX.address, MTX_TOKEN_ABI, ethersProvider)
        const rawBalance = await token.balanceOf(address)
        const decimals = await token.decimals()
        const formatted = parseFloat(formatUnits(rawBalance, decimals))
        
        setBalance(formatted)
        setTier(getTier(formatted))
        
        if (onWalletChange) {
          onWalletChange({ address, balance: formatted })
        }
      } catch (err) {
        console.error('Error fetching balance:', err)
        setError('Failed to fetch MTX balance')
      }
    }

    fetchBalance()
  }, [isConnected, address, walletProvider, onWalletChange])

  // MTX: Add MTX token to wallet using wallet_watchAsset (EIP-747)
  const addTokenToWallet = async (): Promise<void> => {
    setError('');
    if (!MTX.isDeployed) {
      setError('MTX contract address is not configured yet.');
      return;
    }
    if (!provider) {
      setError('Connect wallet first.');
      return;
    }
    try {
      if (!walletProvider) {
        setError('Connect wallet first.');
        return;
      }
      
      // Request to add MTX token to user's wallet using EIP-747
      const wasAdded = await (walletProvider as Eip1193Provider).request({
        method: 'wallet_watchAsset',
        params: {
          type: 'ERC20',
          options: {
            address: MTX_TOKEN_ADDRESS,
            symbol: MTX.symbol,
            decimals: MTX.decimals,
            // Image omitted - can be added later when token logo is available
          },
        },
      });

      if (wasAdded) {
        // Token successfully added - wallet provides user feedback
        console.log('MTX token added to wallet successfully');
      }
    } catch (err) {
      console.error('Failed to add token:', err);
      setError('Failed to add MTX token to wallet.');
    }
  };

  // Deduct MTX for premium features with burn
  const deductMTX = async (amount: number): Promise<void> => {
    setError('');
    if (!MTX.isDeployed) {
      setError('MTX contract address is not configured yet.');
      return;
    }
    if (!provider || !address) {
      setError('Connect wallet first.');
      return;
    }
    if (balance !== null && balance < amount) {
      setError('Insufficient MTX balance.');
      return;
    }
    const burnPercent = 0.1; // 10% burn
    const burnAmount = amount * burnPercent;
    const spendAmount = amount - burnAmount;
    if (!window.confirm(`Deduct ${amount} MTX for this feature? (${spendAmount} spent, ${burnAmount} burned)`)) return;
    setLoading(true);
    try {
      const signer = await provider.getSigner();
      const token = new Contract(MTX_TOKEN_ADDRESS, MTX_TOKEN_ABI, signer);
      const decimals = await token.decimals();
      // Burn MTX
      if (burnAmount > 0) {
        const burnTx = await token.transfer('0x000000000000000000000000000000000000dead', parseUnits(burnAmount.toString(), decimals));
        await burnTx.wait();
      }
      // Spend MTX (simulate: send to platform address)
      if (spendAmount > 0) {
        const platformAddress = '0x000000000000000000000000000000000000beef'; // Replace with your platform address
        const spendTx = await token.transfer(platformAddress, parseUnits(spendAmount.toString(), decimals));
        await spendTx.wait();
      }
      // Refresh balance
      const rawBalance = await token.balanceOf(address);
      const formatted = parseFloat(formatUnits(rawBalance, decimals));
      setBalance(formatted);
      setTier(getTier(formatted));
      if (onWalletChange) {
        onWalletChange({ address, balance: formatted });
      }
    } catch (_err) {
      setError('MTX deduction failed.');
    }
    setLoading(false);
  };

  // Lock/Unlock MTX for tier access (simulated client-side)
  const lockMTX = async (amount: number, days: number = 30): Promise<void> => {
    setError('');
    if (!MTX.isDeployed) {
      setError('MTX contract address is not configured yet.');
      return;
    }
    if (!provider || !address) {
      setError('Connect wallet first.');
      return;
    }
    if (balance !== null && balance < amount) {
      setError('Insufficient MTX balance.');
      return;
    }
    if (!window.confirm(`Lock ${amount} MTX for ${days} days to access higher tier?`)) return;
    setLocked(amount);
    setLockUntil(Date.now() + days * 24 * 60 * 60 * 1000);
    if (balance !== null) {
      setBalance(balance - amount);
      setTier(getTier(balance - amount));
    }
  };
  const unlockMTX = (): void => {
    if (!MTX.isDeployed) {
      setError('MTX contract address is not configured yet.');
      return;
    }
    if (!lockUntil || Date.now() < lockUntil) {
      setError('Lock period not finished.');
      return;
    }
    if (balance !== null) {
      setBalance(balance + locked);
      setTier(getTier(balance + locked));
    }
    setLocked(0);
    setLockUntil(0);
  };

  // Shared connect action (task 136): direct one-tap connect through the
  // injected provider when a browser wallet is present (modal skipped);
  // the AppKit modal is the fallback otherwise / on failure. The outcome
  // never throws — a declined or failed attempt surfaces as inline error
  // copy in this bar and the bar stays rendered.
  const handleConnect = async (): Promise<void> => {
    (window as any).trackMatrixEvent?.('wallet_connect', { result: 'attempt' });
    setError('');
    setConnecting(true);
    try {
      const outcome = await connectWallet({ open });
      if (outcome.status === 'error') {
        setError(outcome.message);
      }
    } finally {
      setConnecting(false);
    }
  };

  // Wallet connect is live on the production build (Reown project ID wired
  // via astro.yml). A local build without the env var shows it disabled,
  // which is expected — not a bug.
  if (!walletConnectEnabled) {
    return (
      <div style={{ padding: '1rem', border: '1px solid #333', borderRadius: '8px', background: '#181818', color: '#fff', maxWidth: 320 }}>
        <h3>Wallet Connect</h3>
        <p>Wallet connection is currently unavailable. WalletConnect is not configured yet, so no wallet can be connected right now.</p>
      </div>
    );
  }

  return (
    <div style={{ padding: '0.5rem 0.75rem', border: '1px solid #333', borderRadius: '8px', background: '#181818', color: '#fff', maxWidth: 320 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'space-between' }}>
        {isConnected && address ? (
          <span style={{ fontSize: '0.875rem' }}>{address.slice(0, 6)}...{address.slice(-4)} · {balance !== null ? balance : '…'} MTX</span>
        ) : (
          <button onClick={handleConnect} disabled={connecting} style={{ padding: '0.4rem 0.8rem', fontSize: '0.9rem', background: '#00ff99', color: '#181818', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
            {connecting ? 'Connecting...' : 'Connect Wallet'}
          </button>
        )}
        {isConnected && address && (
          <button onClick={toggleMinimized} aria-label={minimized ? 'Expand wallet panel' : 'Minimize wallet panel'} style={{ padding: '0.2rem 0.5rem', fontSize: '0.9rem', background: 'transparent', color: '#00ff99', border: '1px solid #333', borderRadius: '4px', cursor: 'pointer' }}>
            {minimized ? '▸' : '▾'}
          </button>
        )}
      </div>
      {!isConnected && injectedAvailable && (
        <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '0.35rem' }}>{WALLET_DIRECT_HINT}</div>
      )}
      {isConnected && address && !minimized && (
        <div style={{ marginTop: '0.5rem', borderTop: '1px solid #333', paddingTop: '0.5rem' }}>
          <div><strong>Tier:</strong> {tier}</div>
          {/* MTX: Add MTX to Wallet button */}
          <div style={{ marginTop: '0.5rem' }}>
            <button 
              onClick={addTokenToWallet} 
              disabled={!MTX.isDeployed}
              style={{ 
                padding: '0.25rem 0.75rem', 
                fontSize: '0.875rem', 
                background: '#4CAF50', 
                color: '#fff', 
                border: 'none', 
                borderRadius: '4px', 
                cursor: 'pointer',
                marginRight: '0.5rem'
              }}
            >
              Add MTX to Wallet
            </button>
            {/* MTX: Direct Mint link */}
            {MTX.isDeployed && (
              <a
                href="/buy-mtx"
                style={{
                  padding: '0.25rem 0.75rem',
                  fontSize: '0.875rem',
                  background: '#00ff99',
                  color: '#181818',
                  textDecoration: 'none',
                  border: 'none',
                  borderRadius: '4px',
                  display: 'inline-block'
                }}
              >
                Buy MTX (Direct Mint)
              </a>
            )}
          </div>
          {locked > 0 && (
            <div style={{ color: '#ffd700', marginTop: '0.5rem' }}>
              <strong>Locked MTX:</strong> {locked} (Unlocks: {lockUntil ? new Date(lockUntil).toLocaleString() : ''})
              <button onClick={unlockMTX} disabled={!MTX.isDeployed || !lockUntil || Date.now() < lockUntil} style={{ marginLeft: '1rem', padding: '0.25rem 0.75rem', background: '#444', color: '#fff', border: 'none', borderRadius: '4px', cursor: !MTX.isDeployed || !lockUntil || Date.now() < lockUntil ? 'not-allowed' : 'pointer' }}>
                Unlock MTX
              </button>
            </div>
          )}
          <div style={{ marginTop: '1rem' }}>
            <button onClick={() => deductMTX(10)} disabled={loading || !MTX.isDeployed} style={{ padding: '0.5rem 1rem', fontSize: '1rem', background: '#ff0066', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', marginRight: '0.5rem' }}>
              Use Heavy Tool (-10 MTX)
            </button>
            <button onClick={() => deductMTX(5)} disabled={loading || !MTX.isDeployed} style={{ padding: '0.5rem 1rem', fontSize: '1rem', background: '#00aaff', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', marginRight: '0.5rem' }}>
              Priority Execution (-5 MTX)
            </button>
            <button onClick={() => deductMTX(1)} disabled={loading || !MTX.isDeployed} style={{ padding: '0.5rem 1rem', fontSize: '1rem', background: '#ffaa00', color: '#181818', border: 'none', borderRadius: '4px', cursor: 'pointer', marginRight: '0.5rem' }}>
              Experimental Module (-1 MTX)
            </button>
            <button onClick={() => lockMTX(50, 30)} disabled={loading || locked > 0 || !MTX.isDeployed} style={{ padding: '0.5rem 1rem', fontSize: '1rem', background: '#00ff99', color: '#181818', border: 'none', borderRadius: '4px', cursor: locked > 0 || !MTX.isDeployed ? 'not-allowed' : 'pointer', marginLeft: '0.5rem' }}>
              Lock 50 MTX (30 days)
            </button>
          </div>
        </div>
      )}
      {error && <div style={{ color: 'red', marginTop: '0.5rem' }}>{error}</div>}
    </div>
  );
};

export default WalletConnect;
