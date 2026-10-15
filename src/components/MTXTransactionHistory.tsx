import React, { useState, useEffect } from 'react';
import { MTX } from '../config/mtx';
import mtxAbi from '../abi/mtx.json';
import { getEthereumProvider } from '../utils/ethereumProvider';

interface Transaction {
  hash: string;
  from: string;
  to: string;
  value: string;
  timestamp: number;
  blockNumber: number;
  type: 'send' | 'receive' | 'mint' | 'burn';
}

interface MTXTransactionHistoryProps {
  address?: string;
  maxItems?: number;
}

const MTXTransactionHistory: React.FC<MTXTransactionHistoryProps> = ({ address, maxItems = 10 }) => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchTransactions = async () => {
    const ethereum = getEthereumProvider();
    if (!address || !ethereum) return;
    if (!MTX.isDeployed) {
      setError('MTX contract address is not configured yet.');
      return;
    }
    setLoading(true);
    setError('');

    try {
      const { BrowserProvider, Contract, formatUnits } = await import('ethers');
      const provider = new BrowserProvider(ethereum);
      const mtxContract = new Contract(MTX.address, mtxAbi, provider);
      const decimals = await mtxContract.decimals();

      const currentBlock = await provider.getBlockNumber();
      const fromBlock = Math.max(0, currentBlock - 10000);

      const sentFilter = mtxContract.filters.Transfer(address, null);
      const receivedFilter = mtxContract.filters.Transfer(null, address);

      const [sentEvents, receivedEvents] = await Promise.all([
        mtxContract.queryFilter(sentFilter, fromBlock, currentBlock),
        mtxContract.queryFilter(receivedFilter, fromBlock, currentBlock),
      ]);

      const allEvents = [...sentEvents, ...receivedEvents];
      const uniqueEvents = Array.from(new Map(allEvents.map(event => [event.transactionHash, event])).values());
      uniqueEvents.sort((a, b) => b.blockNumber - a.blockNumber);

      const txs = await Promise.all(uniqueEvents.slice(0, maxItems).map(async (event: any) => {
        const args = event.args as { from: string; to: string; value: bigint };
        const block = await provider.getBlock(event.blockNumber);
        if (!block) return null;
        const value = formatUnits(args.value, decimals);
        let type: Transaction['type'] = 'send';
        if (args.from === address) type = args.to === '0x000000000000000000000000000000000000dEaD' ? 'burn' : 'send';
        else if (args.to === address) type = args.from === '0x0000000000000000000000000000000000000000' ? 'mint' : 'receive';

        return {
          hash: event.transactionHash,
          from: args.from,
          to: args.to,
          value,
          timestamp: block.timestamp,
          blockNumber: event.blockNumber,
          type,
        } as Transaction;
      }));

      setTransactions(txs.filter((transaction): transaction is Transaction => transaction !== null));
    } catch (err) {
      console.error('Error fetching transactions:', err);
      setError('Failed to load transactions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchTransactions(); }, [address]);

  if (!address) return null;

  return (
    <div className="mtx-transactions">
      {loading && <div>Loading...</div>}
      {error && <div className="error">{error}</div>}
      <ul>
        {transactions.map(tx => (
          <li key={tx.hash}>{tx.type} {tx.value} — <a href={`https://polygonscan.com/tx/${tx.hash}`} target="_blank" rel="noreferrer">View</a></li>
        ))}
      </ul>
    </div>
  );
};

export default MTXTransactionHistory;
