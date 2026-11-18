// MTX Live Terminal — live on-chain reads for the homepage terminal panel.
//
// Every figure comes from a fresh eth_call against Polygon mainnet at
// render/refresh time. Nothing is cached, hard-coded, or carried over from
// a previous load: if a read fails, the corresponding field is null and the
// panel renders an explicit "read failed" state for that tile instead of a
// number. Addresses are the verified contracts from the public proof pack
// (bot-core/security/public-proof-pack-2026-11-12.md) — the same set the
// /security page publishes.
import { Contract, JsonRpcProvider, formatUnits } from 'ethers';

export const TERMINAL_RPC = 'https://polygon-bor-rpc.publicnode.com';

export const TERMINAL_CONTRACTS = {
  mtx: '0x53307e1db6c5cb6773c9495ca140372016dfe266',
  pair: '0x489a6592Cb2965c3512e6CeFA4EE160765674c44',
  casinoReserve: '0xA7A3F9D629B1a6942EF8434639Cb1c33010F55d5',
  vrfCoordinator: '0xec0Ed46f36576541C75739E915ADbCb3DE24bD77',
  vrfSubscriptionId:
    '0xc3e2763c20013bc078418406c72a51aa6218554206fcb38e20c24f3dc7e097d3',
} as const;

const MTX_ABI = [
  'function totalSupply() view returns (uint256)',
  'function maticToMtxRate() view returns (uint256)',
  'function mintingPaused() view returns (bool)',
  'function balanceOf(address account) view returns (uint256)',
];

const PAIR_ABI = [
  'function getReserves() view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)',
];

// Chainlink VRF v2.5 coordinator — getSubscription returns 5 values:
// (balance, nativeBalance, reqCount, owner, consumers).
const VRF_ABI = [
  'function getSubscription(bytes32 subId) view returns (uint96 balance, uint96 nativeBalance, uint64 reqCount, address owner, address[] consumers)',
];

export interface TerminalSnapshot {
  /** Polygon block height at read time, or null if that read failed. */
  blockNumber: number | null;
  /** Total MTX supply, formatted (e.g. "105,100"), or null on failure. */
  totalSupply: string | null;
  /** Mint rate as MTX per 1 POL (e.g. "1,000"), or null on failure. */
  maticToMtxRate: string | null;
  /** Minting paused state, or null on failure. */
  mintingPaused: boolean | null;
  /** QuickSwap spot price: POL per 1 MTX (e.g. "0.001000"), or null. */
  spotPolPerMtx: string | null;
  /** Pool reserves, formatted, or null on failure. */
  poolPol: string | null;
  poolMtx: string | null;
  /** MTX held by CasinoReserve, formatted, or null on failure. */
  reserveMtx: string | null;
  /** VRF subscription LINK balance (4dp), or null on failure. */
  vrfLink: string | null;
  /** VRF subscription fulfilled-request count, or null on failure. */
  vrfRequests: string | null;
  /** When this snapshot finished loading (client clock). */
  fetchedAt: Date;
}

function fmtWhole(units: bigint, decimals = 18): string {
  const n = Number(formatUnits(units, decimals));
  return n.toLocaleString('en-US', { maximumFractionDigits: 0 });
}

function fmtAmount(units: bigint, decimals = 18, maxDp = 4): string {
  const n = Number(formatUnits(units, decimals));
  return n.toLocaleString('en-US', { maximumFractionDigits: maxDp });
}

async function attempt<T>(fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn();
  } catch {
    return null;
  }
}

/**
 * Read every terminal figure fresh from Polygon. Each read is independent:
 * one failing call nulls only its own tile, never the whole panel.
 */
export async function fetchTerminalSnapshot(): Promise<TerminalSnapshot> {
  const provider = new JsonRpcProvider(TERMINAL_RPC);
  const mtx = new Contract(TERMINAL_CONTRACTS.mtx, MTX_ABI, provider);
  const pair = new Contract(TERMINAL_CONTRACTS.pair, PAIR_ABI, provider);
  const vrf = new Contract(TERMINAL_CONTRACTS.vrfCoordinator, VRF_ABI, provider);

  const [blockNumber, supply, rate, paused, reserves, reserveBal, sub] =
    await Promise.all([
      attempt(() => provider.getBlockNumber()),
      attempt(() => mtx.totalSupply() as Promise<bigint>),
      attempt(() => mtx.maticToMtxRate() as Promise<bigint>),
      attempt(() => mtx.mintingPaused() as Promise<boolean>),
      attempt(
        () =>
          pair.getReserves() as Promise<[bigint, bigint, number]>,
      ),
      attempt(
        () =>
          mtx.balanceOf(TERMINAL_CONTRACTS.casinoReserve) as Promise<bigint>,
      ),
      attempt(
        () =>
          vrf.getSubscription(TERMINAL_CONTRACTS.vrfSubscriptionId) as Promise<
            [bigint, bigint, bigint, string, string[]]
          >,
      ),
    ]);

  let spotPolPerMtx: string | null = null;
  let poolPol: string | null = null;
  let poolMtx: string | null = null;
  if (reserves) {
    // Pair token0 = WPOL, token1 = MTX (verified in the proof pack).
    const [reserve0, reserve1] = reserves;
    poolPol = fmtAmount(reserve0);
    poolMtx = fmtWhole(reserve1);
    if (reserve1 > 0n) {
      const spot = Number(formatUnits(reserve0, 18)) / Number(formatUnits(reserve1, 18));
      spotPolPerMtx = spot.toFixed(6);
    }
  }

  return {
    blockNumber,
    totalSupply: supply !== null ? fmtWhole(supply) : null,
    maticToMtxRate:
      rate !== null ? Number(rate).toLocaleString('en-US') : null,
    mintingPaused: paused,
    spotPolPerMtx,
    poolPol,
    poolMtx,
    reserveMtx: reserveBal !== null ? fmtWhole(reserveBal) : null,
    vrfLink: sub ? fmtAmount(sub[0], 18, 4) : null,
    vrfRequests: sub ? sub[2].toString() : null,
    fetchedAt: new Date(),
  };
}

export function scanUrl(address: string): string {
  return `https://polygonscan.com/address/${address}`;
}
