export const prerender = true;

import type { APIRoute } from 'astro';

/**
 * API endpoint to fetch MTX balance for an address
 * GET /api/mtx-balance?address=0x...
 * 
 * Returns:
 * - balance: MTX balance in human-readable format
 * - decimals: Token decimals (18)
 * - symbol: Token symbol (MTX)
 * - timestamp: Unix timestamp of the query
 */
export const GET: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  const address = url.searchParams.get('address');

  // Validate address parameter
  if (!address) {
    return new Response(
      JSON.stringify({
        error: 'Missing address parameter',
        message: 'Please provide a Polygon address via ?address=0x...'
      }),
      {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  }

  // Validate address format
  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return new Response(
      JSON.stringify({
        error: 'Invalid address format',
        message: 'Address must be a valid Polygon address (0x... with 40 hex characters)'
      }),
      {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  }

  try {
    // Import MTX config and ABI dynamically to avoid build issues
    const { MTX } = await import('../../config/mtx');
    const mtxAbi = await import('../../abi/mtx.json');

    // Check if contract is deployed
    if (!MTX.isDeployed) {
      return new Response(
        JSON.stringify({
          error: 'Contract not deployed',
          message: 'MTX token contract has not been deployed yet',
          balance: '0',
          symbol: 'MTX',
          decimals: 18
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
    const { Contract, formatUnits, JsonRpcProvider } = await import('ethers');
    const provider = new JsonRpcProvider(MTX.rpcUrls[0]);
    
    // Create contract instance
    const mtxContract = new Contract(MTX.address, mtxAbi.default || mtxAbi, provider);

    // Fetch balance and decimals
    const [rawBalance, decimals, symbol, totalSupply] = await Promise.all([
      mtxContract.balanceOf(address),
      mtxContract.decimals(),
      mtxContract.symbol(),
      mtxContract.totalSupply()
    ]);

    // Format balance
    const balance = formatUnits(rawBalance, decimals);
    const totalSupplyFormatted = formatUnits(totalSupply, decimals);
    
    // Calculate percentage of total supply
    const percentage = ((parseFloat(balance) / parseFloat(totalSupplyFormatted)) * 100).toFixed(6);

    return new Response(
      JSON.stringify({
        address,
        balance,
        symbol,
        decimals: Number(decimals),
        totalSupply: totalSupplyFormatted,
        percentageOfSupply: percentage,
        timestamp: Math.floor(Date.now() / 1000),
        contractAddress: MTX.address,
        network: MTX.chainName,
        chainId: MTX.chainId
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, s-maxage=10, stale-while-revalidate=30'
        },
      }
    );
  } catch (error) {
    console.error('Error fetching MTX balance:', error);
    
    return new Response(
      JSON.stringify({
        error: 'Failed to fetch balance',
        message: error instanceof Error ? error.message : 'Unknown error occurred',
        address
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
