import React, { useState, useEffect } from 'react';
import { MTX } from '../config/mtx';
import mtxAbi from '../abi/mtx.json';

/**
 * BuyMTX Component - Direct MATIC→MTX mint interface
 */
const BuyMTX: React.FC = () => {
  const [maticAmount, setMaticAmount] = useState('1.0');
  const [mtxAmount, setMtxAmount] = useState('0');
  const [rate, setRate] = useState(MTX.maticToMtxRate);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [txHash, setTxHash] = useState('');
  const [mintingPaused, setMintingPaused] = useState(false);

  useEffect(() => {
    const matic = parseFloat(maticAmount) || 0;
    const mtx = matic * rate;
    setMtxAmount(mtx.toFixed(4));
  }, [maticAmount, rate]);

  useEffect(() => {
    const fetchContractInfo = async () => {
      try {
        if (!MTX.isDeployed || !window.ethereum) return;
        const { BrowserProvider, Contract } = await import('ethers');
        const provider = new BrowserProvider(window.ethereum as any);
        const mtxContract = new Contract(MTX.address, mtxAbi, provider);

        const contractRate = await mtxContract.maticToMtxRate();
        setRate(Number(contractRate));

        const paused = await mtxContract.mintingPaused();
        setMintingPaused(paused);
      } catch (err) {
        console.error('Error fetching contract info:', err);
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

    const matic = parseFloat(maticAmount);
    if (!matic || matic <= 0) {
      setError('Please enter a valid MATIC amount greater than 0');
      return;
    }

    if (mintingPaused) {
      setError('Direct minting is currently paused. Please use QuickSwap instead.');
      return;
    }

    setLoading(true);

    try {
      const { BrowserProvider, Contract, parseEther } = await import('ethers');
      const provider = new BrowserProvider(window.ethereum as any);
      const signer = await provider.getSigner();
      const mtxContract = new Contract(MTX.address, mtxAbi, signer);

      const tx = await mtxContract.buyMTX({ value: parseEther(maticAmount) });

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
        <input value={maticAmount} onChange={(e) => setMaticAmount(e.target.value)} />
        <button onClick={handleBuyMTX} disabled={loading || !MTX.isDeployed}>Buy MTX</button>
      </div>
      {error && <div className="error">{error}</div>}
      {success && <div className="success">{success} {txHash && (<a href={`https://polygonscan.com/tx/${txHash}`} target="_blank" rel="noreferrer">View TX</a>)}</div>}
    </div>
  );
};

export default BuyMTX;
