import React, { useState, useEffect } from 'react';
import { MTX } from '../config/mtx';
import mtxAbi from '../abi/mtx.json';

interface DashboardStats {
  mtxBalance: string;
  maticBalance: string;
  totalSupply: string;
  userPercentage: string;
  tier: string;
  lockedMTX: string;
  availableMTX: string;
}

interface MTXDashboardProps {
  address?: string;
}

const MTXDashboard: React.FC<MTXDashboardProps> = ({ address }) => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchStats = async () => {
    if (!address || !window.ethereum) return;
    if (!MTX.isDeployed) {
      setError('MTX contract address is not configured yet.');
      return;
    }
    setLoading(true);
    setError('');

    try {
      const { BrowserProvider, Contract, formatUnits } = await import('ethers');
      const provider = new BrowserProvider(window.ethereum as any);
      const mtxContract = new Contract(MTX.address, mtxAbi, provider);

      const [rawBalance, decimals, totalSupply] = await Promise.all([
        mtxContract.balanceOf(address),
        mtxContract.decimals(),
        mtxContract.totalSupply(),
      ]);

      const balance = formatUnits(rawBalance, decimals);
      const total = formatUnits(totalSupply, decimals);

      setStats({
        mtxBalance: balance,
        maticBalance: '0',
        totalSupply: total,
        userPercentage: '0',
        tier: 'Bronze',
        lockedMTX: '0',
        availableMTX: balance,
      });
    } catch (err) {
      console.error('Error fetching dashboard stats:', err);
      setError('Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 120000);
    return () => clearInterval(interval);
  }, [address]);

  if (!address) return null;

  return (
    <div className="mtx-dashboard">
      {loading && <div>Loading...</div>}
      {error && <div className="error">{error}</div>}
      {stats && (
        <div>
          <div>MTX Balance: {stats.mtxBalance}</div>
          <div>Total Supply: {stats.totalSupply}</div>
        </div>
      )}
    </div>
  );
};

export default MTXDashboard;
