import React, { useState, useEffect } from 'react';
import { MTX } from '../config/mtx';
import mtxAbi from '../abi/mtx.json';

/**
 * BuyMTX Component - Direct POL→MTX mint interface
 */
const BuyMTX: React.FC = () => {
  const [polAmount, setPolAmount] = useState('1.0');
  const [mtxAmount, setMtxAmount] = useState('0');
  const [rate, setRate] = useState(MTX.maticToMtxRate);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [txHash, setTxHash] = useState('');
  const [mintingPaused, setMintingPaused] = useState(false);
  const [contractReadError, setContractReadError] = useState('');

  useEffect(() => {
    const pol = parseFloat(polAmount) || 0;
    const mtx = pol * rate;
    setMtxAmount(mtx.toFixed(4));
  }, [polAmount, rate]);

  useEffect(() => {
    const fetchContractInfo = async () => {
      if (!MTX.isDeployed) {
        setContractReadError('MTX contract address is not configured yet.');
        return;
      }
      if (!window.ethereum) {
        setContractReadError('No wallet detected. Install MetaMask or a compatible wallet to verify the live mint rate and status before buying.');
        return;
      }
      try {
        const { BrowserProvider, Contract } = await import('ethers');
        const provider = new BrowserProvider(window.ethereum as any);
        const mtxContract = new Contract(MTX.address, mtxAbi, provider);

        const contractRate = await mtxContract.maticToMtxRate();
        setRate(Number(contractRate));

        const paused = await mtxContract.mintingPaused();
        setMintingPaused(paused);
        setContractReadError('');
      } catch (err) {
        console.error('Error fetching contract info:', err);
        setContractReadError('Could not read the MTX contract from the blockchain. The buy button is disabled until the live rate and mint status can be confirmed — please refresh and try again.');
      }
    };

    fetchContractInfo();
  }, []);

  const handleBuyMTX = async () => {
    setError('');
    setSuccess('');
    setTxHash('');

    if (!MTX.isDeployed) {
      setError('MTX contract address is not configured yet.');
      return;
    }

    if (!window.ethereum) {
      setError('Polygon wallet not found. Please install MetaMask or a compatible wallet.');
      return;
    }

    const pol = parseFloat(polAmount);
    if (!pol || pol <= 0) {
      setError('Please enter a valid POL amount greater than 0');
      return;
    }

    if (mintingPaused) {
      setError('Direct minting is currently paused. Minting is unavailable right now — please check back later. There is no QuickSwap pool for MTX, so there is no alternative way to buy at the moment.');
      return;
    }

    setLoading(true);

    try {
      const { BrowserProvider, Contract, parseEther } = await import('ethers');
      const provider = new BrowserProvider(window.ethereum as any);
      const network = await provider.getNetwork();
      if (Number(network.chainId) !== MTX.chainId) {
        throw new Error(`Switch your wallet to ${MTX.chainName} (Chain ID: ${MTX.chainId}) to buy MTX.`);
      }
      const signer = await provider.getSigner();
      const mtxContract = new Contract(MTX.address, mtxAbi, signer);

      const tx = await mtxContract.buyMTX({ value: parseEther(polAmount) });

      setSuccess(`Transaction sent! Waiting for confirmation...`);
      setTxHash(tx.hash);

      const receipt = await tx.wait();

      if (receipt.status === 1) {
        setSuccess(`Success! You received ${mtxAmount} MTX. Transaction confirmed.`);
      } else {
        setError('Transaction failed. Please try again.');
      }
    } catch (err: any) {
      console.error('BuyMTX error:', err);
      setError(err?.message || 'Transaction error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="buy-mtx">
      <div className="input-row">
        <input value={polAmount} onChange={(e) => setPolAmount(e.target.value)} />
        <button onClick={handleBuyMTX} disabled={loading || !MTX.isDeployed || contractReadError !== '' || mintingPaused}>Buy MTX</button>
      </div>
      {contractReadError && <div className="error">{contractReadError}</div>}
      {mintingPaused && !contractReadError && <div className="error">Direct minting is currently paused. Minting is unavailable right now — please check back later.</div>}
      {error && <div className="error">{error}</div>}
      {success && <div className="success">{success} {txHash && (<a href={`https://polygonscan.com/tx/${txHash}`} target="_blank" rel="noreferrer">View TX</a>)}</div>}
    </div>
  );
};

export default BuyMTX;
