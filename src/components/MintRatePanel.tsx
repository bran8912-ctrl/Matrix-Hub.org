import { useCallback, useEffect, useState } from 'react';
import { useAppKit, useAppKitAccount, useAppKitProvider } from '@reown/appkit/react';
import { BrowserProvider, Contract, formatUnits } from 'ethers';
import type { Eip1193Provider } from 'ethers';
import mtxAbi from '../abi/mtx.json';
// Shared one-tap connect path (HUB task 136) — the same connect behaviour
// as the header bar and the casino pages. The import also guarantees
// AppKit is initialized before this island renders (lib/initAppKit).
import { connectWallet, hasInjectedWallet, WALLET_DIRECT_HINT } from '../lib/connectWallet';

// ============================================================================
// MTX Mint Price panel — owners portal (added Nov 12, owner request).
// ----------------------------------------------------------------------------
// A standalone extraction of ONLY the mint-rate panel from
// src/components/DeployConsole.tsx (the /owners/deploy-console page):
// same contract calls (maticToMtxRate read, setMaticToMtxRate write),
// same QuickSwap pair source, same >10% divergence warning, same guards.
// The deploy console itself is unchanged.
//
// Safety rules (identical to the console — do not weaken):
//  - Never requests, stores, logs, or transmits a private key or seed phrase.
//  - Never auto-sends: the rate changes only when the operator taps the
//    update button, and the wallet shows the transaction first. Rate
//    changes stay MANUAL (owner decision, Nov 10).
//  - Only the deployer wallet can send (checked against the address below
//    and again inside submitRate).
//  - Mainnet only: this portal is the live owner control. The Amoy
//    testnet rehearsal toggle stays in the deploy console.
// ============================================================================

// Polygon mainnet — mirrors NETWORKS.polygon in DeployConsole.tsx.
const NET = {
  chainId: 137,
  label: 'Polygon mainnet',
  deployer: '0x9fb4bb44d8d962d695fc93b3dc15f1b287391077',
  mtx: '0x53307e1db6c5cb6773c9495ca140372016dfe266',
  explorer: 'https://polygonscan.com',
  // QuickSwap V2 pair (token0 = WPOL, token1 = MTX on mainnet).
  pair: '0x489a6592Cb2965c3512e6CeFA4EE160765674c44' as string | null,
};

const PAIR_ABI = [
  'function getReserves() view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)',
];

function short(addr: string): string {
  return addr.length > 13 ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : addr;
}

type RateTxStatus = 'idle' | 'sending' | 'pending' | 'confirmed' | 'failed';

export default function MintRatePanel() {
  const { address, isConnected } = useAppKitAccount();
  const { walletProvider } = useAppKitProvider('eip155');
  const { open } = useAppKit();

  // Connect state for the panel's own connect button (shared path).
  const [connecting, setConnecting] = useState(false);
  const [connectMsg, setConnectMsg] = useState('');
  const [injectedAvailable] = useState<boolean>(() => hasInjectedWallet());

  // Mint-rate state — same names and flow as DeployConsole.tsx.
  const [rateCurrent, setRateCurrent] = useState<string | null>(null);
  const [poolPrice, setPoolPrice] = useState<string | null>(null);
  const [rateInput, setRateInput] = useState('');
  const [rateMsg, setRateMsg] = useState('');
  const [rateBusy, setRateBusy] = useState(false);
  const [rateTx, setRateTx] = useState<string | null>(null);
  const [txStatus, setTxStatus] = useState<RateTxStatus>('idle');

  const isDeployer = isConnected && !!address && address.toLowerCase() === NET.deployer.toLowerCase();

  const getSigner = useCallback(async () => {
    if (!walletProvider) throw new Error('No wallet provider. Connect a wallet first.');
    const provider = new BrowserProvider(walletProvider as Eip1193Provider);
    return { provider, signer: await provider.getSigner() };
  }, [walletProvider]);

  const handleConnect = useCallback(async () => {
    setConnectMsg('');
    setConnecting(true);
    try {
      const outcome = await connectWallet({ open });
      if (outcome.status === 'error') setConnectMsg(outcome.message);
    } finally {
      setConnecting(false);
    }
  }, [open ]);

  const refreshRate = useCallback(async () => {
    setRateMsg('');
    try {
      const { provider } = await getSigner();
      const mtx = new Contract(NET.mtx, mtxAbi, provider);
      const rate: bigint = await mtx.maticToMtxRate();
      setRateCurrent(rate.toString());
      if (NET.pair) {
        const pair = new Contract(NET.pair, PAIR_ABI, provider);
        const res = await pair.getReserves();
        // Mainnet pair: token0 = WPOL, token1 = MTX (verified on-chain Nov 10).
        const price = Number(formatUnits(res[1], 18)) / Number(formatUnits(res[0], 18));
        setPoolPrice(price.toFixed(2));
        // Prefill the input with the pool price; the operator can type over it
        // when the rate team's proposal differs from the spot price.
        setRateInput((prev) => (prev === '' ? String(Math.round(price)) : prev));
      } else {
        setPoolPrice(null);
      }
    } catch (err) {
      setRateMsg(err instanceof Error ? `Could not read the rate: ${err.message}` : 'Could not read the rate.');
    }
  }, [getSigner]);

  const submitRate = useCallback(async () => {
    setRateMsg('');
    setRateTx(null);
    setTxStatus('idle');
    setRateBusy(true);
    try {
      if (!isConnected || !address) throw new Error('Connect the deployer wallet first.');
      if (!isDeployer) throw new Error(`Connected wallet is not the deployer ${NET.deployer}.`);
      const n = Number(rateInput);
      if (!Number.isInteger(n) || n <= 0) throw new Error('Enter a whole number of MTX per POL (e.g. 1000).');
      const { provider, signer } = await getSigner();
      const network = await provider.getNetwork();
      if (Number(network.chainId) !== NET.chainId) throw new Error(`Wallet is on chain ${network.chainId}, not ${NET.label} (${NET.chainId}). Switch networks first.`);
      const mtx = new Contract(NET.mtx, mtxAbi, signer);
      setTxStatus('sending');
      const tx = await mtx.setMaticToMtxRate(BigInt(n));
      // Hash exists as soon as the wallet sends — surface it while the
      // confirmation is pending.
      setRateTx(tx.hash);
      setTxStatus('pending');
      await tx.wait(1);
      // Re-read to confirm the new rate actually landed on-chain.
      const after: bigint = await mtx.maticToMtxRate();
      setRateCurrent(after.toString());
      if (after.toString() !== String(n)) throw new Error(`Transaction confirmed but the rate still reads ${after}. Check the transaction before trying again.`);
      setTxStatus('confirmed');
      setRateMsg(`Mint rate updated: 1 POL = ${n} MTX. The buy page and the rate team have the new number.`);
    } catch (err) {
      setTxStatus('failed');
      setRateMsg(err instanceof Error ? err.message : 'Rate update failed.');
    } finally {
      setRateBusy(false);
    }
  }, [isConnected, address, isDeployer, rateInput, getSigner]);

  // Load the live rate + pool price when the wallet connects.
  useEffect(() => {
    if (isConnected) refreshRate().catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected]);

  return (
    <div className="bg-black/30 border border-green-500/20 rounded-lg p-6 text-left">
      <p className="text-gray-200 mb-4">
        The Exchange Rate team watches the pool price and flags when the mint rate
        should move. When they do, check the numbers here and tap once —
        your wallet shows the transaction first. Only the deployer wallet can send it.
        Gas is tiny (one small contract call).
      </p>
      {!isConnected ? (
        <div>
          <p className="text-gray-400 mb-3">Connect the deployer wallet to see the live rate.</p>
          <button
            type="button"
            onClick={() => { handleConnect().catch(() => undefined); }}
            disabled={connecting}
            className="bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white font-bold py-2 px-4 rounded-lg transition-colors"
          >
            {connecting ? 'Connecting…' : 'Connect wallet'}
          </button>
          {injectedAvailable && <p className="text-gray-400 text-xs mt-2">{WALLET_DIRECT_HINT}</p>}
          {connectMsg && <p className="text-red-400 mt-2">{connectMsg}</p>}
        </div>
      ) : (
        <div>
          <p className="text-gray-200">Current mint rate: <strong className="text-green-400">{rateCurrent === null ? '—' : `1 POL = ${rateCurrent} MTX`}</strong></p>
          <p className="text-gray-200">QuickSwap pool price: <strong className="text-green-400">{poolPrice === null ? (NET.pair ? '—' : 'No pool on this network') : `1 POL = ${poolPrice} MTX`}</strong></p>
          {rateCurrent !== null && poolPrice !== null && Number(rateCurrent) !== 0 && (
            <p className="text-gray-200">
              Difference: <strong className="text-green-400">{(((Number(poolPrice) - Number(rateCurrent)) / Number(rateCurrent)) * 100).toFixed(1)}%</strong>{' '}
              {Number(poolPrice) > Number(rateCurrent) ? '(pool pays more per POL than minting)' : Number(poolPrice) < Number(rateCurrent) ? '(minting pays more per POL than the pool)' : '(in line)'}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-3 mt-4">
            <label className="text-gray-200">
              New rate (MTX per POL){' '}
              <input
                type="number"
                min={1}
                step={1}
                value={rateInput}
                onChange={(e) => setRateInput(e.target.value)}
                style={{ width: '8rem' }}
                className="bg-gray-900 border border-green-500/30 rounded px-2 py-1 text-green-300"
              />
            </label>
            <button
              type="button"
              onClick={() => { refreshRate().catch(() => undefined); }}
              className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-lg transition-colors"
            >
              Refresh rates
            </button>
          </div>
          {rateInput && rateCurrent && poolPrice && Number(rateInput) !== Number(rateCurrent) && Math.abs(Number(rateInput) - Number(poolPrice)) / Number(poolPrice) > 0.1 && (
            <p className="text-red-400 mt-3">Heads up: {rateInput} is more than 10% away from the pool price ({poolPrice}). Double-check the team&apos;s proposal before sending.</p>
          )}
          <button
            type="button"
            disabled={!isConnected || !isDeployer || rateBusy || !rateInput || Number(rateInput) <= 0 || !Number.isInteger(Number(rateInput)) || rateInput === rateCurrent}
            onClick={() => { submitRate().catch(() => undefined); }}
            className="block mt-4 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white font-bold py-3 px-6 rounded-lg transition-colors"
          >
            {rateBusy ? 'Waiting for wallet…' : `Update mint rate to ${rateInput || '…'} MTX per POL`}
          </button>
          {isConnected && !isDeployer && <p className="text-red-400 mt-2">Connected wallet is not the deployer. Switch wallets.</p>}
          {txStatus === 'sending' && <p className="text-gray-300 mt-2">Sending — approve the transaction in your wallet.</p>}
          {txStatus === 'pending' && <p className="text-gray-300 mt-2">Transaction sent — waiting for confirmation…</p>}
          {txStatus === 'confirmed' && <p className="text-green-400 mt-2">Confirmed on-chain.</p>}
          {txStatus === 'failed' && <p className="text-red-400 mt-2">Transaction failed — see the message below.</p>}
          {rateTx && (
            <p className="text-gray-300 mt-2">
              Tx: <a href={`${NET.explorer}/tx/${rateTx}`} target="_blank" rel="noreferrer" className="text-green-400 underline">{short(rateTx)}</a>
            </p>
          )}
          {rateMsg && <p className={rateMsg.startsWith('Mint rate updated') ? 'text-green-400 mt-2' : 'text-red-400 mt-2'}>{rateMsg}</p>}
        </div>
      )}
    </div>
  );
}
