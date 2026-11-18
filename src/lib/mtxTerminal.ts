// MTX Live Terminal — live on-chain reads for the homepage terminal panel.
//
// Every figure comes from a fresh eth_call against Polygon mainnet at
// render/refresh time. Nothing is cached, hard-coded, or carried over from
// a previous load: if a read fails on every endpoint, the corresponding
// field is null and the panel renders an explicit "read failed" state for
// that tile instead of a number. Addresses are the verified contracts from
// the public proof pack (bot-core/security/public-proof-pack-2026-11-12.md)
// — the same set the /security page publishes.
//
// ENDPOINT FAILOVER (added Nov 17, after the owner's phone report):
// the panel originally read through a single public RPC endpoint
// (polygon-bor-rpc.publicnode.com). On the owner's Android phone every
// read failed — the panel reached its total-failure state — while the
// same panel worked in desktop browsers and the endpoint answered HQ's
// server-side checks: from that device/network the one endpoint was
// unreachable or blocked, and there was no fallback. Reads now fail over
// across a list of keyless public endpoints (see TERMINAL_RPCS): each
// read tries the endpoints in order and only reports failure when every
// endpoint has failed it. No API keys anywhere — keyless endpoints only.
//
// Endpoint list verified Nov 17 by direct probe (eth_blockNumber AND the
// VRF getSubscription eth_call this file performs, both answered
// correctly): publicnode, dRPC, Tenderly's public gateway, 1RPC.
// Probed and REJECTED the same day: polygon-rpc.com (403 "tenant
// disabled"), polygon.llamarpc.com (no response), rpc.ankr.com/polygon
// (API key now required), Blast API public (service shut down), BlockPI
// public (API key required), OnFinality public (rate-limited without a
// key), Omnia (HTTP 521), Nodies (paid plan), MeowRPC + Stackup (no
// response). If an endpoint dies, replace it with another keyless
// endpoint that passes the same two-call probe.
import { Contract, JsonRpcProvider, formatUnits } from 'ethers';

/** Primary RPC endpoint (first entry of TERMINAL_RPCS). */
export const TERMINAL_RPC = 'https://polygon-bor-rpc.publicnode.com';

/**
 * Keyless public Polygon mainnet RPC endpoints, in failover order.
 * Every entry passed the two-call probe described in the header comment.
 */
export const TERMINAL_RPCS = [
  'https://polygon-bor-rpc.publicnode.com',
  'https://polygon.drpc.org',
  'https://gateway.tenderly.co/public/polygon',
  'https://1rpc.io/matic',
] as const;

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
// (balance, nativeBalance, reqCount, owner, consumers), and in v2.5 the
// subscription id argument is a uint256, NOT a bytes32.
//
// ROOT CAUSE of the dead VRF tile (found Nov 17, HQ click-through):
// this ABI originally declared `getSubscription(bytes32 subId)`. That
// one word changed the function selector (0x1f32768e instead of
// 0xdc311dd3), so every call hit a function the coordinator does not
// have and reverted with no data — the tile could never load, in any
// browser, while HQ's server-side watch (which encodes uint256)
// read the same subscription fine. Verified live after the fix:
// balance 320060622871779456 wei (0.3201 LINK), reqCount 0, one
// consumer (the RNGEngine). The parser below reads balance at index 0
// and reqCount at index 2 — correct for this tuple.
const VRF_ABI = [
  'function getSubscription(uint256 subId) view returns (uint96 balance, uint96 nativeBalance, uint64 reqCount, address owner, address[] consumers)',
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

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Per-attempt ceiling for one read against one endpoint. A free public
 * RPC can accept a connection and then hang; without a ceiling, one
 * hung endpoint would stall the whole panel instead of failing over.
 */
const READ_TIMEOUT_MS = 10_000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`RPC read timed out after ${ms} ms`)),
      ms,
    );
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

/**
 * Run one read with endpoint failover: try each endpoint in
 * TERMINAL_RPCS order, pausing 700 ms between attempts, and return the
 * first successful result. Exactly one pass over the endpoint list per
 * read per refresh cycle — no retry storms. The read reports failure
 * (null) only when EVERY endpoint has failed it, so a tile shows its
 * explicit "read failed" state only when the figure genuinely could
 * not be read anywhere: no cached, stale, or invented numbers, ever.
 *
 * This supersedes the previous single-endpoint behaviour (try the one
 * endpoint, wait 700 ms, retry it once) — the pause between attempts
 * is kept, but a retry now goes to a DIFFERENT endpoint, which is what
 * recovers the panel when one endpoint is blocked from the visitor's
 * network (the Nov 17 phone failure).
 */
async function attempt<T>(
  providers: JsonRpcProvider[],
  read: (provider: JsonRpcProvider) => Promise<T>,
): Promise<T | null> {
  for (let i = 0; i < providers.length; i += 1) {
    if (i > 0) await delay(700);
    try {
      return await withTimeout(read(providers[i]), READ_TIMEOUT_MS);
    } catch {
      // This endpoint failed or timed out — fall over to the next one.
    }
  }
  return null;
}

/**
 * Read every terminal figure fresh from Polygon. Each read is independent
 * and fails over across endpoints on its own: one failing call nulls only
 * its own tile (and only after every endpoint failed it), never the
 * whole panel.
 */
export async function fetchTerminalSnapshot(): Promise<TerminalSnapshot> {
  // staticNetwork is load-bearing, not an optimisation: ethers v6
  // providers otherwise detect the network on first use, and a provider
  // whose endpoint is unreachable retries that detection FOREVER in the
  // background (logging "failed to detect network… retry in 1s") — an
  // unbounded retry loop against exactly the blocked endpoints this
  // failover exists for, stalling reads and stacking up across refresh
  // cycles. The chain is known (Polygon mainnet, 137), so pin it: a
  // dead endpoint then fails its reads fast and failover moves on.
  const providers = TERMINAL_RPCS.map(
    (url) => new JsonRpcProvider(url, 137, { staticNetwork: true }),
  );
  const read = <T>(fn: (provider: JsonRpcProvider) => Promise<T>) =>
    attempt(providers, fn);

  const [blockNumber, supply, rate, paused, reserves, reserveBal, sub] =
    await Promise.all([
      read((p) => p.getBlockNumber()),
      read(
        (p) =>
          new Contract(TERMINAL_CONTRACTS.mtx, MTX_ABI, p).totalSupply() as Promise<bigint>,
      ),
      read(
        (p) =>
          new Contract(TERMINAL_CONTRACTS.mtx, MTX_ABI, p).maticToMtxRate() as Promise<bigint>,
      ),
      read(
        (p) =>
          new Contract(TERMINAL_CONTRACTS.mtx, MTX_ABI, p).mintingPaused() as Promise<boolean>,
      ),
      read(
        (p) =>
          new Contract(TERMINAL_CONTRACTS.pair, PAIR_ABI, p).getReserves() as Promise<
            [bigint, bigint, number]
          >,
      ),
      read(
        (p) =>
          new Contract(TERMINAL_CONTRACTS.mtx, MTX_ABI, p).balanceOf(
            TERMINAL_CONTRACTS.casinoReserve,
          ) as Promise<bigint>,
      ),
      read(
        (p) =>
          new Contract(TERMINAL_CONTRACTS.vrfCoordinator, VRF_ABI, p).getSubscription(
            TERMINAL_CONTRACTS.vrfSubscriptionId,
          ) as Promise<[bigint, bigint, bigint, string, string[]]>,
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
