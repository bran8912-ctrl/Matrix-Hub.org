export const prerender = true;

import type { APIRoute } from 'astro';

/**
 * API endpoint to fetch MTX token statistics
 * GET /api/mtx-stats
 * 
 * Returns:
 * - totalSupply: Total MTX supply
 * - circulatingSupply: Circulating supply (minus burned tokens)
 * - holders: Number of token holders (if available)
 * - price: Current price data (if available)
 * - marketCap: Calculated market cap
 * - volume24h: 24h trading volume (if available)
 */
export const GET: APIRoute = async () => {
  try {
    // Import MTX config and ABI dynamically
    const { MTX } = await import('../../config/mtx');
    const mtxAbi = await import('../../abi/mtx.json');

    // Check if contract is deployed
    if (!MTX.isDeployed) {
      return new Response(
        JSON.stringify({
          error: 'Contract not deployed',
          message: 'MTX token contract has not been deployed yet',
          stats: {
            totalSupply: '0',
            symbol: 'MTX',
            decimals: 18,
            deployed: false
          }
        }),
        {
          status: 503,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
    }

    // Create provider using public RPC
    const { BrowserProvider, Contract, formatUnits } = await import('ethers');
    const ethers = await import('ethers');
    const provider = new ethers.JsonRpcProvider(MTX.rpcUrls[0]);
    
    // Create contract instance
    const mtxContract = new Contract(MTX.address, mtxAbi.default || mtxAbi, provider);

    // Fetch contract data
    const [totalSupply, decimals, name, symbol, mintingPaused, maticToMtxRate] = await Promise.all([
      mtxContract.totalSupply(),
      mtxContract.decimals(),
      mtxContract.name(),
      mtxContract.symbol(),
      mtxContract.mintingPaused().catch(() => false),
      mtxContract.maticToMtxRate().catch(() => 1000)
    ]);

    // Format values
    const totalSupplyFormatted = formatUnits(totalSupply, decimals);

    // Calculate burned supply (tokens sent to dead address)
    const deadAddress = '0x000000000000000000000000000000000000dEaD';
    const burnedBalance = await mtxContract.balanceOf(deadAddress);
    const burnedSupply = formatUnits(burnedBalance, decimals);

    // Calculate circulating supply
    const circulatingSupply = (parseFloat(totalSupplyFormatted) - parseFloat(burnedSupply)).toString();

    // Get current block for timestamp
    const currentBlock = await provider.getBlock('latest');

    const stats = {
      name,
      symbol,
      decimals: Number(decimals),
      totalSupply: totalSupplyFormatted,
      circulatingSupply,
      burnedSupply,
      mintingPaused,
      maticToMtxRate: Number(maticToMtxRate),
      contractAddress: MTX.address,
      network: MTX.chainName,
      chainId: MTX.chainId,
      blockExplorer: MTX.blockExplorerUrl,
      uniswapUrl: MTX.uniswapUrl,
      deployed: true,
      timestamp: currentBlock?.timestamp || Math.floor(Date.now() / 1000),
      lastBlockNumber: currentBlock?.number || 0
    };

    return new Response(
      JSON.stringify(stats),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120'
        },
      }
    );
  } catch (error) {
    console.error('Error fetching MTX stats:', error);
    
    return new Response(
      JSON.stringify({
        error: 'Failed to fetch stats',
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  }
};
