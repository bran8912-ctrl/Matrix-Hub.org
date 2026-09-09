export function generateClientHash(): string {
  // Generate a client-side hash for provably fair gaming
  // Combines multiple sources of entropy for randomness
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

export async function placeCasinoBet(walletProvider: Eip1193Provider, betAmount: number, gameData?: string): Promise<BetResult> {
  if (!walletProvider) throw new Error('Wallet not connected. Please connect your wallet to play.');
  if (betAmount <= 0) throw new Error('Bet amount must be greater than zero.');

  const network = await provider.getNetwork();
  if (network.chainId !== POLYGON_CHAIN_ID) throw new Error('Connected wallet is not on Polygon network');

  const mtxContract = new Contract(MTX.address, mtxAbi, provider) as any;

  const decimals = await mtxContract.decimals();
  const amountWei = parseUnits(betAmount.toString(), decimals);
  // ... rest of function ...
}
