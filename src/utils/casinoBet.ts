import type { Eip1193Provider } from 'ethers';
import { MTX } from '../config/mtx';
import mtxAbi from '../abi/mtx.json';
import { Casino } from '../config/casino';

const POLYGON_CHAIN_ID = 137n;
const isAddress20 = (addr: string | null | undefined): boolean =>
  typeof addr === 'string' && /^0x[a-fA-F0-9]{40}$/.test(addr);

const CASINO_VAULT_ADDRESS = (Casino.contracts.casinoReserve.isDeployed && isAddress20(Casino.contracts.casinoReserve.address))
  ? Casino.contracts.casinoReserve.address
  : undefined;

export interface BetResult {
  txHash: string;
  betAmount: number;
  mode: 'on-chain' | 'transfer';
  win?: boolean;
  payout?: number;
}

export function generateClientHash(): string {
  const randomBytes = new Uint8Array(32);
  crypto.getRandomValues(randomBytes);
  return Array.from(randomBytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

export async function placeCasinoBet(walletProvider: Eip1193Provider, betAmount: number, gameData?: string): Promise<BetResult> {
  if (!walletProvider) throw new Error('Wallet not connected. Please connect your wallet to play.');
  if (betAmount <= 0) throw new Error('Bet amount must be greater than zero.');
  if (!MTX.isDeployed) throw new Error('MTX token contract is not deployed yet. Cannot place bet.');
  if (!CASINO_VAULT_ADDRESS) throw new Error('Casino reserve contract is not deployed yet. Cannot place bet.');

  const { BrowserProvider, Contract, parseUnits } = await import('ethers');
  const provider = new BrowserProvider(walletProvider as any);

  const network = await provider.getNetwork();
  if (network.chainId !== POLYGON_CHAIN_ID) throw new Error('Connected wallet is not on Polygon network');

  const mtxContract = new Contract(MTX.address, mtxAbi, provider) as any;

  const decimals = await mtxContract.decimals();
  const amountWei = parseUnits(betAmount.toString(), decimals);

  const signer = await provider.getSigner();

  const tx = await mtxContract.connect(signer).transfer(CASINO_VAULT_ADDRESS, amountWei);
  const receipt = await tx.wait();

  return { txHash: receipt.transactionHash || (tx as any).hash, betAmount, mode: 'transfer' };
}
