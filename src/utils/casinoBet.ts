import type { Eip1193Provider } from 'ethers';
import { BrowserProvider, Contract, Interface, formatUnits, parseUnits } from 'ethers';
import { MTX } from '../config/mtx';
import { Casino } from '../config/casino';

const TOKEN_ABI = [
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function balanceOf(address owner) view returns (uint256)',
  'function decimals() view returns (uint8)',
];

const CASINO_CORE_ABI = [
  'function placeDiceBet(uint256 amount, uint8 target) returns (uint256 betId)',
  'function placeSlotsBet(uint256 amount) returns (uint256 betId)',
  'function getBet(uint256 betId) view returns (address player, uint256 amount, uint8 target, uint8 roll, uint8 status, bool win, uint256 payout)',
  'function getSlotsBet(uint256 betId) view returns (address player, uint256 amount, uint8 status, bool win, uint256 payout, uint8 reel0, uint8 reel1, uint8 reel2, uint8 symbol0, uint8 symbol1, uint8 symbol2, uint256 multiplier)',
  'function claimPayout(uint256 betId)',
  'event BetRequested(uint256 indexed betId, uint256 indexed requestId, address indexed player, uint256 reservedPayout)',
];

export interface BetResult {
  txHash: string;
  betId: string;
  betAmount: number;
  mode?: 'on-chain' | 'transfer';
  win?: boolean;
  payout?: number;
}

export interface BetStatus {
  status: 'pending' | 'settled' | 'claimed';
  roll: number;
  target: number;
  win: boolean;
  payout: number;
}

export interface SlotsBetStatus {
  status: 'pending' | 'settled' | 'claimed' | 'refunded';
  /** Reel stop positions 0-19; null while the bet is pending. */
  reels: [number, number, number] | null;
  /** Symbol ids 0=SEVEN 1=BAR 2=BELL 3=PLUM 4=LEMON 5=CHERRY; null while pending. */
  symbols: [number, number, number] | null;
  win: boolean;
  payout: number;
  multiplier: number;
}

export function generateClientHash(): never {
  throw new Error('Client-generated outcomes are disabled; only VRF-backed Dice is supported.');
}

function getCasinoCoreAddress(): string {
  if (!Casino.isFullyDeployed || !Casino.contracts.casinoCore.isDeployed) {
    throw new Error('The VRF-backed casino is not deployed and enabled on this network.');
  }
  return Casino.contracts.casinoCore.address;
}

async function createWalletProvider(walletProvider: Eip1193Provider): Promise<BrowserProvider> {
  if (!walletProvider) throw new Error('Wallet not connected. Connect your wallet to play.');

  const provider = new BrowserProvider(walletProvider);
  const network = await provider.getNetwork();
  if (network.chainId !== BigInt(Casino.chainId)) {
    throw new Error(`Connected wallet must be on ${Casino.chainName} (chain ID ${Casino.chainId}).`);
  }
  return provider;
}

export async function placeCasinoBet(
  walletProvider: Eip1193Provider,
  betAmount: number,
  target: number,
): Promise<BetResult> {
  if (!Number.isFinite(betAmount) || betAmount <= 0) {
    throw new Error('Bet amount must be a positive number.');
  }
  if (!Number.isInteger(target) || target < 2 || target > 98) {
    throw new Error('Dice target must be an integer from 2 through 98.');
  }
  if (!MTX.isDeployed) throw new Error('MTX token is not configured on this network.');

  const provider = await createWalletProvider(walletProvider);
  const coreAddress = getCasinoCoreAddress();
  const signer = await provider.getSigner();
  const playerAddress = await signer.getAddress();
  const token = new Contract(MTX.address, TOKEN_ABI, signer);
  const core = new Contract(coreAddress, CASINO_CORE_ABI, signer);
  const decimals = Number(await token.getFunction('decimals').staticCall());
  const amount = parseUnits(betAmount.toString(), decimals);
  const allowance = await token.getFunction('allowance').staticCall(playerAddress, coreAddress) as bigint;

  if (allowance < amount) {
    const approval = await token.getFunction('approve')(coreAddress, amount);
    const approvalReceipt = await approval.wait();
    if (!approvalReceipt || approvalReceipt.status !== 1) {
      throw new Error('MTX approval transaction did not confirm successfully.');
    }
  }

  const transaction = await core.getFunction('placeDiceBet')(amount, target);
  const receipt = await transaction.wait();
  if (!receipt || receipt.status !== 1) {
    throw new Error('Dice bet transaction did not confirm successfully.');
  }

  const casinoInterface = new Interface(CASINO_CORE_ABI);
  let betId: string | undefined;
  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== coreAddress.toLowerCase()) continue;
    const parsed = casinoInterface.parseLog(log);
    if (parsed?.name === 'BetRequested') {
      betId = (parsed.args[0] as bigint).toString();
      break;
    }
  }
  if (!betId) throw new Error('Confirmed transaction did not include a VRF bet request event.');

  return {
    txHash: receipt.hash,
    betId,
    betAmount,
  };
}

/**
 * Place a Slots bet through CasinoCore.placeSlotsBet. Slots v1 spins are
 * exactly 1 MTX: the on-chain worst case is amount x 100, and the
 * maxPayoutPerBet cap (100 MTX) rejects anything larger. Settlement is
 * asynchronous — the VRF callback lands the reels; poll with
 * getSlotsBetStatus, then claim with claimCasinoPayout (shared with Dice).
 */
export async function placeSlotsCasinoBet(
  walletProvider: Eip1193Provider,
  betAmount: number,
): Promise<BetResult> {
  if (!Number.isFinite(betAmount) || betAmount <= 0) {
    throw new Error('Bet amount must be a positive number.');
  }
  if (!MTX.isDeployed) throw new Error('MTX token is not configured on this network.');

  const provider = await createWalletProvider(walletProvider);
  const coreAddress = getCasinoCoreAddress();
  const signer = await provider.getSigner();
  const playerAddress = await signer.getAddress();
  const token = new Contract(MTX.address, TOKEN_ABI, signer);
  const core = new Contract(coreAddress, CASINO_CORE_ABI, signer);
  const decimals = Number(await token.getFunction('decimals').staticCall());
  const amount = parseUnits(betAmount.toString(), decimals);
  const allowance = await token.getFunction('allowance').staticCall(playerAddress, coreAddress) as bigint;

  if (allowance < amount) {
    const approval = await token.getFunction('approve')(coreAddress, amount);
    const approvalReceipt = await approval.wait();
    if (!approvalReceipt || approvalReceipt.status !== 1) {
      throw new Error('MTX approval transaction did not confirm successfully.');
    }
  }

  const transaction = await core.getFunction('placeSlotsBet')(amount);
  const receipt = await transaction.wait();
  if (!receipt || receipt.status !== 1) {
    throw new Error('Slots bet transaction did not confirm successfully.');
  }

  const casinoInterface = new Interface(CASINO_CORE_ABI);
  let betId: string | undefined;
  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== coreAddress.toLowerCase()) continue;
    const parsed = casinoInterface.parseLog(log);
    if (parsed?.name === 'BetRequested') {
      betId = (parsed.args[0] as bigint).toString();
      break;
    }
  }
  if (!betId) throw new Error('Confirmed transaction did not include a VRF bet request event.');

  return {
    txHash: receipt.hash,
    betId,
    betAmount,
  };
}

export async function getSlotsBetStatus(
  walletProvider: Eip1193Provider,
  betId: string,
): Promise<SlotsBetStatus> {
  const provider = await createWalletProvider(walletProvider);
  const core = new Contract(getCasinoCoreAddress(), CASINO_CORE_ABI, provider);
  const bet = await core.getFunction('getSlotsBet').staticCall(BigInt(betId));
  const statusNumber = Number(bet[2]);
  const status = statusNumber === 1 ? 'pending'
    : statusNumber === 2 ? 'settled'
    : statusNumber === 3 ? 'claimed'
    : statusNumber === 4 ? 'refunded'
    : undefined;
  if (!status) throw new Error(`Casino returned an invalid status for bet ${betId}.`);

  const decimals = Number(await new Contract(MTX.address, TOKEN_ABI, provider).getFunction('decimals').staticCall());
  const pending = status === 'pending';
  // The contract reports symbol sentinel 255 while the reels are undrawn.
  const symbol = (value: unknown): number => Number(value);
  return {
    status,
    reels: pending ? null : [Number(bet[5]), Number(bet[6]), Number(bet[7])],
    symbols: pending || symbol(bet[8]) === 255 ? null : [symbol(bet[8]), symbol(bet[9]), symbol(bet[10])],
    win: Boolean(bet[3]),
    payout: Number(formatUnits(bet[4], decimals)),
    multiplier: Number(bet[11]),
  };
}

export async function getCasinoBetStatus(
  walletProvider: Eip1193Provider,
  betId: string,
): Promise<BetStatus> {
  const provider = await createWalletProvider(walletProvider);
  const core = new Contract(getCasinoCoreAddress(), CASINO_CORE_ABI, provider);
  const bet = await core.getFunction('getBet').staticCall(BigInt(betId));
  const statusNumber = Number(bet[4]);
  const status = statusNumber === 1 ? 'pending' : statusNumber === 2 ? 'settled' : statusNumber === 3 ? 'claimed' : undefined;
  if (!status) throw new Error(`Casino returned an invalid status for bet ${betId}.`);

  const decimals = Number(await new Contract(MTX.address, TOKEN_ABI, provider).getFunction('decimals').staticCall());
  return {
    status,
    roll: Number(bet[3]),
    target: Number(bet[2]),
    win: Boolean(bet[5]),
    payout: Number(formatUnits(bet[6], decimals)),
  };
}

export async function claimCasinoPayout(
  walletProvider: Eip1193Provider,
  betId: string,
): Promise<string> {
  const provider = await createWalletProvider(walletProvider);
  const core = new Contract(getCasinoCoreAddress(), CASINO_CORE_ABI, await provider.getSigner());
  const transaction = await core.getFunction('claimPayout')(BigInt(betId));
  const receipt = await transaction.wait();
  if (!receipt || receipt.status !== 1) {
    throw new Error('Payout claim transaction did not confirm successfully.');
  }
  return receipt.hash;
}
