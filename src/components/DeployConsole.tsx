import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAppKit, useAppKitAccount, useAppKitProvider } from '@reown/appkit/react';
import {
  AbiCoder,
  BrowserProvider,
  Contract,
  ContractFactory,
  Interface,
  ZeroAddress,
  formatUnits,
  isAddress,
  parseUnits,
} from 'ethers';
import type { Eip1193Provider } from 'ethers';
import mtxAbi from '../abi/mtx.json';
import rngArtifact from '../../artifacts/contracts/RNGEngine.sol/RNGEngine.json';
import reserveArtifact from '../../artifacts/contracts/CasinoReserve.sol/CasinoReserve.json';
import routerArtifact from '../../artifacts/contracts/LiquidityRouter.sol/LiquidityRouter.json';
import coreArtifact from '../../artifacts/contracts/CasinoCore.sol/CasinoCore.json';

// ============================================================================
// Owner Deploy Console — Matrix Hub casino go-live, one tap per transaction.
// ----------------------------------------------------------------------------
// Safety rules (do not weaken):
//  - Never requests, stores, logs, or transmits a private key or seed phrase.
//  - Never auto-sends a transaction: every step sends exactly one tx, only
//    when the operator taps its button, and the wallet shows it first.
//  - Stops on the first failed step and says which step failed.
//  - Only the deployer wallet can run it (checked on-chain address).
//  - Mainnet requires the acknowledgement checkbox (amounts + no audit).
// Constructor args and call sequence mirror scripts/deploy_casino.js and
// scripts/create_quickswap_pool.js exactly. Do not change the numbers here
// without changing those scripts and the go-live runbook together.
// ============================================================================

type NetKey = 'polygon' | 'amoy';

interface NetConfig {
  chainId: number;
  label: string;
  deployer: string;
  mtx: string;
  quickswapRouter: string;
  link: string;
  vrfCoordinator: string;
  vrfKeyHash: string;
  explorer: string;
  rpcUrl: string;
  polFloor: string;
}

const NETWORKS: Record<NetKey, NetConfig> = {
  polygon: {
    chainId: 137,
    label: 'Polygon mainnet',
    deployer: '0x9fb4bb44d8d962d695fc93b3dc15f1b287391077',
    mtx: '0x53307e1db6c5cb6773c9495ca140372016dfe266',
    quickswapRouter: '0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff',
    link: '0xb0897686c545045aFc77CF20eC7A532E3120E0F1',
    vrfCoordinator: '0xec0Ed46f36576541C75739E915ADbCb3DE24bD77',
    vrfKeyHash: '0x0ffbbd0c1c18c0263dd778dadd1d64240d7bc338d95fec1cf0473928ca7eaf9e',
    explorer: 'https://polygonscan.com',
    rpcUrl: 'https://polygon.drpc.org',
    polFloor: '2', // was 15 — lowered Nov 10 when the pool shrank to 1 POL; covers the pool + gas now that steps 1–16 are done
  },
  amoy: {
    chainId: 80002,
    label: 'Polygon Amoy — testnet rehearsal',
    // Throwaway deployer from the Amoy bootstrap (testnet-only key, never mainnet).
    deployer: '0x19dB6AD52b9F701DD436294F250A71B12cd33caB',
    mtx: '0x1c05F0283E44b5c13C420d24e05495dC5719548b', // Amoy test MTX
    // Mock QuickSwap V2 router deployed by the Amoy bootstrap — rehearsal only.
    quickswapRouter: '0x2bbf8fD7B9d447542c4458D578257059Fd0Be189',
    link: '0x0fd9e8d3af1aaee056eb9e802c3a762a667b1904', // Amoy LINK
    vrfCoordinator: '0x343300b5d84D444B2ADc9116FEF1bED02BE49Cf2',
    vrfKeyHash: '0x816bedba8a50b294e5cbd47842baf240c2385f2eaf719edbd4f250a137a8c899',
    explorer: 'https://amoy.polygonscan.com',
    rpcUrl: 'https://rpc-amoy.polygon.technology/',
    polFloor: '0.1',
  },
};

// Agreed numbers (runbook §4) — mirror of deploy_casino.js DEPLOYMENT_CONFIG.
const VRF_FUND_LINK = '15';
const MAX_PAYOUT_MTX = '100';
const RESERVE_CAP_MTX = '1000000';
const MIN_BET_MTX = '1';
const MAX_BET_MTX = '1000';
const RESERVE_FUND_MTX = '5000';
const QS_MTX = '100000';
const QS_POL = '100';
const QS_PROVIDE_MTX = '1000'; // shrunk Nov 10 — deployer holds 1.86 POL; the pool is 1 POL + 1,000 MTX at the same 0.001 parity. The other 99,000 MTX stays queued in the router.
const QS_PROVIDE_POL = '1';
const QS_SLIPPAGE_BPS = 100; // 1% — same default as create_quickswap_pool.js
const QS_DEADLINE_MINUTES = 20;
const VRF_CALLBACK_GAS = 250000;
const VRF_CONFIRMATIONS = 3;

const COORDINATOR_ABI = [
  'function createSubscription() returns (uint256 subId)',
  'function addConsumer(uint256 subId, address consumer)',
  'function getSubscription(uint256 subId) view returns (uint96 balance, uint96 nativeBalance, uint64 reqCount, address owner, address[] consumers)',
  'event SubscriptionCreated(uint256 indexed subId, address owner)',
];

const LINK_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function transferAndCall(address to, uint256 value, bytes data) returns (bool)',
];

interface StepResult {
  hash: string | null;
  note?: string;
}

interface StepDef {
  id: string;
  group: string;
  title: string;
  detail: string;
  valueText: string;
}

const STEPS: StepDef[] = [
  { id: 'vrf-create', group: 'VRF', title: 'Create VRF subscription', detail: 'Creates a Chainlink VRF v2.5 subscription owned by the deployer wallet.', valueText: '0 POL (+ gas)' },
  { id: 'vrf-fund', group: 'VRF', title: 'Fund VRF subscription — up to 15 LINK', detail: 'Sends up to 15 official LINK to the coordinator via transferAndCall. Funds with your full LINK balance if you hold less than 15 — the subscription works with any amount, but bets stop when it runs dry. Top up later at vrf.chain.link. If the subscription already holds LINK, this step completes without sending anything.', valueText: 'up to 15 LINK (+ gas)' },
  { id: 'deploy-rng', group: 'Deploy', title: 'Deploy RNGEngine', detail: 'Constructor: coordinator, subscription id, keyHash, 250,000 callback gas, 3 confirmations.', valueText: '0 POL (+ gas)' },
  { id: 'deploy-reserve', group: 'Deploy', title: 'Deploy CasinoReserve', detail: 'Constructor: MTX, reserve cap 1,000,000 MTX, CasinoCore 0x0 (wired in step 7).', valueText: '0 POL (+ gas)' },
  { id: 'deploy-router', group: 'Deploy', title: 'Deploy LiquidityRouter', detail: 'Constructor: MTX, QuickSwap V2 router.', valueText: '0 POL (+ gas)' },
  { id: 'deploy-core', group: 'Deploy', title: 'Deploy CasinoCore', detail: 'Constructor: MTX, router, reserve, RNG, bets 1–1,000 MTX, max payout 100 MTX, dev + governance = deployer (single key — transfer to the multisig later, see summary).', valueText: '0 POL (+ gas)' },
  { id: 'wire-reserve', group: 'Wiring', title: 'Wire reserve → CasinoCore', detail: 'CasinoReserve.setCasinoCore(core).', valueText: '0 POL (+ gas)' },
  { id: 'wire-rng', group: 'Wiring', title: 'Wire RNG → CasinoCore', detail: 'RNGEngine.setCasinoCore(core).', valueText: '0 POL (+ gas)' },
  { id: 'wire-router', group: 'Wiring', title: 'Wire router → CasinoCore', detail: 'LiquidityRouter.setCasinoCore(core).', valueText: '0 POL (+ gas)' },
  { id: 'wire-consumer', group: 'Wiring', title: 'Register RNG as VRF consumer', detail: 'Coordinator.addConsumer(subscription id, RNGEngine). Skipped with a note if it is already registered.', valueText: '0 POL (+ gas)' },
  { id: 'reserve-mint', group: 'Reserve', title: 'Mint 5,000 MTX to deployer', detail: 'MTX.mintToEcosystem(deployer, 5,000). Owner-only.', valueText: '5,000 MTX minted (+ gas)' },
  { id: 'reserve-approve', group: 'Reserve', title: 'Approve reserve for 5,000 MTX', detail: 'MTX.approve(CasinoReserve, 5,000).', valueText: '0 MTX (+ gas)' },
  { id: 'reserve-fund', group: 'Reserve', title: 'Fund CasinoReserve — 5,000 MTX', detail: 'CasinoReserve.fund(5,000). After this, reserveHealth() must read 5,000.', valueText: '5,000 MTX (+ gas)' },
  { id: 'qs-mint', group: 'QuickSwap', title: 'Mint 100,000 MTX to deployer', detail: 'MTX.mintToEcosystem(deployer, 100,000) — liquidity capital, separate from the reserve.', valueText: '100,000 MTX minted (+ gas)' },
  { id: 'qs-approve', group: 'QuickSwap', title: 'Approve router for 100,000 MTX', detail: 'MTX.approve(LiquidityRouter, 100,000).', valueText: '0 MTX (+ gas)' },
  { id: 'qs-queue', group: 'QuickSwap', title: 'Queue initial liquidity — 100,000 MTX', detail: 'LiquidityRouter.queueInitialLiquidity(100,000).', valueText: '0 MTX (+ gas)' },
  { id: 'qs-provide', group: 'QuickSwap', title: 'Provide liquidity — 1,000 MTX + 1 POL', detail: 'LiquidityRouter.provideLiquidity(1,000 MTX, min 990 MTX, min 0.99 POL, deadline now + 20 min) with 1 POL attached. Sets the pool price at parity: 0.001 POL per MTX. LP tokens go to the deployer wallet. The other 99,000 MTX stays queued in the router and can be withdrawn later by the owner.', valueText: '1,000 MTX + 1 POL (+ gas)' },
];

function short(addr: string): string {
  return addr.length > 13 ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : addr;
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="copy-btn"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          setCopied(false);
        }
      }}
    >
      {copied ? 'Copied ✓' : `Copy ${label}`}
    </button>
  );
}

export default function DeployConsole() {
  const { address, isConnected } = useAppKitAccount();
  const { walletProvider } = useAppKitProvider('eip155');
  const { open } = useAppKit();

  const [netKey, setNetKey] = useState<NetKey>('polygon');
  const net = NETWORKS[netKey];
  const [acknowledged, setAcknowledged] = useState(false);
  const [started, setStarted] = useState(false);

  const [polBalance, setPolBalance] = useState<string | null>(null);
  const [chainOk, setChainOk] = useState<boolean | null>(null);
  const [preflightMsg, setPreflightMsg] = useState('');
  const [subId, setSubId] = useState<string | null>(null);
  const [addrs, setAddrs] = useState<Record<string, string>>({});
  const [done, setDone] = useState<Record<string, StepResult>>({});
  const [failed, setFailed] = useState<{ stepId: string; message: string } | null>(null);
  const [runningId, setRunningId] = useState<string | null>(null);

  const subIdRef = useRef<string | null>(null);
  const addrsRef = useRef<Record<string, string>>({});
  subIdRef.current = subId;
  addrsRef.current = addrs;

  const storageKey = `matrixhub-deploy-console-${netKey}`;

  // Restore a previous session (same network) — addresses, subscription id,
  // and completed steps only. No keys are ever stored.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return;
      const saved = JSON.parse(raw) as { subId?: string; addrs?: Record<string, string>; done?: Record<string, StepResult> };
      if (saved.subId) setSubId(saved.subId);
      if (saved.addrs) setAddrs(saved.addrs);
      if (saved.done) {
        setDone(saved.done);
        setStarted(true);
      }
    } catch {
      // Corrupt saved state: start clean rather than guessing.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [netKey]);

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify({ subId, addrs, done }));
    } catch {
      // Storage unavailable (private mode etc.) — session still works in memory.
    }
  }, [subId, addrs, done, storageKey]);

  const isDeployer = isConnected && !!address && address.toLowerCase() === net.deployer.toLowerCase();
  const nextStep = useMemo(() => STEPS.find((s) => !done[s.id]) ?? null, [done]);
  const allDone = STEPS.every((s) => done[s.id]);

  const getSigner = useCallback(async () => {
    if (!walletProvider) throw new Error('No wallet provider. Connect a wallet first.');
    const provider = new BrowserProvider(walletProvider as Eip1193Provider);
    return { provider, signer: await provider.getSigner() };
  }, [walletProvider]);

  const ensureChain = useCallback(async () => {
    if (!walletProvider) throw new Error('No wallet provider. Connect a wallet first.');
    const provider = new BrowserProvider(walletProvider as Eip1193Provider);
    const network = await provider.getNetwork();
    if (Number(network.chainId) === net.chainId) {
      setChainOk(true);
      return;
    }
    try {
      await (walletProvider as Eip1193Provider).request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: `0x${net.chainId.toString(16)}` }],
      });
    } catch (err: unknown) {
      const code = (err as { code?: number })?.code;
      if (code === 4902) {
        await (walletProvider as Eip1193Provider).request({
          method: 'wallet_addEthereumChain',
          params: [{
            chainId: `0x${net.chainId.toString(16)}`,
            chainName: net.label,
            nativeCurrency: { name: 'POL', symbol: 'POL', decimals: 18 },
            rpcUrls: [net.rpcUrl],
            blockExplorerUrls: [net.explorer],
          }],
        });
      } else {
        throw new Error(`Wallet is on the wrong network. Switch to ${net.label} (chain ${net.chainId}) and try again.`);
      }
    }
    const after = await provider.getNetwork();
    if (Number(after.chainId) !== net.chainId) {
      throw new Error(`Still not on ${net.label}. Switch networks in your wallet and try again.`);
    }
    setChainOk(true);
  }, [walletProvider, net]);

  const runPreflight = useCallback(async () => {
    setPreflightMsg('');
    try {
      if (!isConnected || !address) throw new Error('Connect a wallet first.');
      if (!isDeployer) throw new Error(`This console only works for the deployer wallet ${net.deployer}. Connected: ${address}.`);
      await ensureChain();
      const { provider } = await getSigner();
      const bal = await provider.getBalance(address);
      const balStr = formatUnits(bal, 18);
      setPolBalance(balStr);
      if (bal < parseUnits(net.polFloor, 18)) {
        throw new Error(`POL balance ${balStr} is below the ${net.polFloor} POL floor for ${net.label}. Fund the deployer wallet first.`);
      }
      setPreflightMsg(`Pre-flight passed: deployer confirmed, on ${net.label}, POL balance ${balStr} (floor ${net.polFloor}).`);
    } catch (err) {
      setPreflightMsg(err instanceof Error ? err.message : 'Pre-flight check failed.');
    }
  }, [isConnected, address, isDeployer, net, ensureChain, getSigner]);

  const targetFor = useCallback((step: StepDef): string => {
    switch (step.id) {
      case 'vrf-create':
      case 'wire-consumer':
        return net.vrfCoordinator;
      case 'vrf-fund':
        return net.link;
      case 'deploy-rng':
      case 'deploy-reserve':
      case 'deploy-router':
      case 'deploy-core':
        return 'new contract (address assigned on deploy)';
      case 'wire-reserve':
        return addrs.reserve || 'CasinoReserve (deploys in step 4)';
      case 'wire-rng':
        return addrs.rng || 'RNGEngine (deploys in step 3)';
      case 'wire-router':
        return addrs.router || 'LiquidityRouter (deploys in step 5)';
      case 'reserve-mint':
      case 'reserve-approve':
      case 'qs-mint':
      case 'qs-approve':
        return net.mtx;
      case 'reserve-fund':
        return addrs.reserve || 'CasinoReserve (deploys in step 4)';
      case 'qs-queue':
      case 'qs-provide':
        return addrs.router || 'LiquidityRouter (deploys in step 5)';
      default:
        return '—';
    }
  }, [net, addrs]);

  async function executeStep(step: StepDef): Promise<StepResult> {
    const { provider, signer } = await getSigner();
    const me = await signer.getAddress();
    if (me.toLowerCase() !== net.deployer.toLowerCase()) {
      throw new Error(`Connected wallet ${me} is not the deployer ${net.deployer}.`);
    }
    const network = await provider.getNetwork();
    if (Number(network.chainId) !== net.chainId) {
      throw new Error(`Wallet is on chain ${network.chainId}, not ${net.label} (${net.chainId}). Switch networks first.`);
    }
    const mtx = new Contract(net.mtx, mtxAbi, signer);
    const coordinator = new Contract(net.vrfCoordinator, COORDINATOR_ABI, signer);

    switch (step.id) {
      case 'vrf-create': {
        const tx = await coordinator.createSubscription();
        const receipt = await tx.wait(1);
        const iface = new Interface(COORDINATOR_ABI);
        let found: string | null = null;
        for (const log of receipt?.logs ?? []) {
          try {
            const parsed = iface.parseLog(log);
            if (parsed?.name === 'SubscriptionCreated') found = parsed.args.subId.toString();
          } catch { /* log is not ours */ }
        }
        if (!found) throw new Error('Subscription created but the SubscriptionCreated event was not found in the receipt. Check the transaction on the explorer before continuing.');
        const sub = await coordinator.getSubscription(found);
        if (sub.owner.toLowerCase() !== net.deployer.toLowerCase()) {
          throw new Error(`Subscription ${found} is not owned by the deployer. Do not continue.`);
        }
        setSubId(found);
        return { hash: tx.hash, note: `Subscription id ${found}` };
      }
      case 'vrf-fund': {
        const id = subIdRef.current;
        if (!id) throw new Error('No subscription id recorded. Run step 1 first.');
        const link = new Contract(net.link, LINK_ABI, signer);
        const decimals: number = await link.decimals();
        // The subscription may already be funded (e.g. a previous tap sent the
        // LINK but the balance read came back stale). Never double-fund: if the
        // on-chain balance is already above zero, this step is done.
        const existing = await coordinator.getSubscription(id);
        if (existing.balance > 0n) {
          return { hash: null, note: `Subscription ${id} already holds ${formatUnits(existing.balance, decimals)} LINK on-chain — no transaction sent` };
        }
        const bal: bigint = await link.balanceOf(me);
        const target = parseUnits(VRF_FUND_LINK, decimals);
        if (bal === 0n) {
          throw new Error(`LINK balance is 0 — buy official LINK on ${net.label} (token ${net.link} — NOT bridged LINK) and try again.`);
        }
        // Fund with the full balance when it is below the 15 LINK target:
        // the subscription works with any amount and can be topped up later
        // at vrf.chain.link. Only the next undone step can run in this
        // console, so a later top-up cannot be done by re-running this step.
        const amount = bal < target ? bal : target;
        const data = AbiCoder.defaultAbiCoder().encode(['uint256'], [BigInt(id)]);
        const tx = await link.transferAndCall(net.vrfCoordinator, amount, data);
        await tx.wait(1);
        // The wallet's RPC can serve a stale block right after the transaction
        // confirms; re-read a few times before declaring the funding missing.
        let funded = 0n;
        for (let attempt = 0; attempt < 4; attempt++) {
          const sub = await coordinator.getSubscription(id);
          funded = sub.balance;
          if (funded >= amount) break;
          await new Promise((r) => setTimeout(r, 4000));
        }
        if (funded < amount) throw new Error(`Funding sent but the subscription balance reads ${formatUnits(funded, decimals)} LINK. Check the transaction before continuing.`);
        const short = amount < target ? ` — below the ${VRF_FUND_LINK} LINK target; top up at vrf.chain.link or bets will stop when it runs dry` : '';
        return { hash: tx.hash, note: `Subscription ${id} funded with ${formatUnits(amount, decimals)} LINK${short}` };
      }
      case 'deploy-rng': {
        const id = subIdRef.current;
        if (!id) throw new Error('No subscription id recorded. Run step 1 first.');
        const factory = new ContractFactory(rngArtifact.abi, rngArtifact.bytecode, signer);
        const c = await factory.deploy(net.vrfCoordinator, BigInt(id), net.vrfKeyHash, VRF_CALLBACK_GAS, VRF_CONFIRMATIONS);
        await c.waitForDeployment();
        const addr = await c.getAddress();
        if ((await provider.getCode(addr)) === '0x') throw new Error(`RNGEngine deployed to ${addr} but no code is there. Do not continue.`);
        setAddrs((p) => ({ ...p, rng: addr }));
        return { hash: c.deploymentTransaction()?.hash ?? null, note: `RNGEngine at ${addr}` };
      }
      case 'deploy-reserve': {
        const factory = new ContractFactory(reserveArtifact.abi, reserveArtifact.bytecode, signer);
        const c = await factory.deploy(net.mtx, parseUnits(RESERVE_CAP_MTX, 18), ZeroAddress);
        await c.waitForDeployment();
        const addr = await c.getAddress();
        if ((await provider.getCode(addr)) === '0x') throw new Error(`CasinoReserve deployed to ${addr} but no code is there. Do not continue.`);
        setAddrs((p) => ({ ...p, reserve: addr }));
        return { hash: c.deploymentTransaction()?.hash ?? null, note: `CasinoReserve at ${addr}` };
      }
      case 'deploy-router': {
        const factory = new ContractFactory(routerArtifact.abi, routerArtifact.bytecode, signer);
        const c = await factory.deploy(net.mtx, net.quickswapRouter);
        await c.waitForDeployment();
        const addr = await c.getAddress();
        if ((await provider.getCode(addr)) === '0x') throw new Error(`LiquidityRouter deployed to ${addr} but no code is there. Do not continue.`);
        setAddrs((p) => ({ ...p, router: addr }));
        return { hash: c.deploymentTransaction()?.hash ?? null, note: `LiquidityRouter at ${addr}` };
      }
      case 'deploy-core': {
        const { rng, reserve, router } = addrsRef.current;
        if (!rng || !reserve || !router) throw new Error('Deploy RNG, reserve, and router first (steps 3–5).');
        const factory = new ContractFactory(coreArtifact.abi, coreArtifact.bytecode, signer);
        const c = await factory.deploy(
          net.mtx, router, reserve, rng,
          parseUnits(MIN_BET_MTX, 18), parseUnits(MAX_BET_MTX, 18), parseUnits(MAX_PAYOUT_MTX, 18),
          net.deployer, net.deployer,
        );
        await c.waitForDeployment();
        const addr = await c.getAddress();
        if ((await provider.getCode(addr)) === '0x') throw new Error(`CasinoCore deployed to ${addr} but no code is there. Do not continue.`);
        setAddrs((p) => ({ ...p, core: addr }));
        return { hash: c.deploymentTransaction()?.hash ?? null, note: `CasinoCore at ${addr} — dev + governance are the deployer (single key)` };
      }
      case 'wire-reserve': {
        const { reserve, core } = addrsRef.current;
        if (!reserve || !core) throw new Error('Deploy the reserve and CasinoCore first.');
        const tx = await new Contract(reserve, reserveArtifact.abi, signer).setCasinoCore(core);
        await tx.wait(1);
        return { hash: tx.hash };
      }
      case 'wire-rng': {
        const { rng, core } = addrsRef.current;
        if (!rng || !core) throw new Error('Deploy RNGEngine and CasinoCore first.');
        const tx = await new Contract(rng, rngArtifact.abi, signer).setCasinoCore(core);
        await tx.wait(1);
        return { hash: tx.hash };
      }
      case 'wire-router': {
        const { router, core } = addrsRef.current;
        if (!router || !core) throw new Error('Deploy the router and CasinoCore first.');
        const tx = await new Contract(router, routerArtifact.abi, signer).setCasinoCore(core);
        await tx.wait(1);
        return { hash: tx.hash };
      }
      case 'wire-consumer': {
        const id = subIdRef.current;
        const { rng } = addrsRef.current;
        if (!id || !rng) throw new Error('Create the subscription and deploy RNGEngine first.');
        const sub = await coordinator.getSubscription(id);
        if (sub.consumers.some((c: string) => c.toLowerCase() === rng.toLowerCase())) {
          return { hash: null, note: 'RNGEngine was already a consumer — no transaction sent.' };
        }
        const tx = await coordinator.addConsumer(BigInt(id), rng);
        await tx.wait(1);
        return { hash: tx.hash };
      }
      case 'reserve-mint': {
        const tx = await mtx.mintToEcosystem(net.deployer, parseUnits(RESERVE_FUND_MTX, 18));
        await tx.wait(1);
        return { hash: tx.hash, note: `${RESERVE_FUND_MTX} MTX minted to deployer` };
      }
      case 'reserve-approve': {
        const { reserve } = addrsRef.current;
        if (!reserve) throw new Error('Deploy CasinoReserve first.');
        const tx = await mtx.approve(reserve, parseUnits(RESERVE_FUND_MTX, 18));
        await tx.wait(1);
        return { hash: tx.hash };
      }
      case 'reserve-fund': {
        const { reserve } = addrsRef.current;
        if (!reserve) throw new Error('Deploy CasinoReserve first.');
        const tx = await new Contract(reserve, reserveArtifact.abi, signer).fund(parseUnits(RESERVE_FUND_MTX, 18));
        await tx.wait(1);
        return { hash: tx.hash, note: `Reserve funded with ${RESERVE_FUND_MTX} MTX` };
      }
      case 'qs-mint': {
        const tx = await mtx.mintToEcosystem(net.deployer, parseUnits(QS_MTX, 18));
        await tx.wait(1);
        return { hash: tx.hash, note: `${QS_MTX} MTX minted to deployer` };
      }
      case 'qs-approve': {
        const { router } = addrsRef.current;
        if (!router) throw new Error('Deploy LiquidityRouter first.');
        const tx = await mtx.approve(router, parseUnits(QS_MTX, 18));
        await tx.wait(1);
        return { hash: tx.hash };
      }
      case 'qs-queue': {
        const { router } = addrsRef.current;
        if (!router) throw new Error('Deploy LiquidityRouter first.');
        const tx = await new Contract(router, routerArtifact.abi, signer).queueInitialLiquidity(parseUnits(QS_MTX, 18));
        await tx.wait(1);
        return { hash: tx.hash };
      }
      case 'qs-provide': {
        const { router } = addrsRef.current;
        if (!router) throw new Error('Deploy LiquidityRouter first.');
        const desired = parseUnits(QS_PROVIDE_MTX, 18);
        const minMtx = (desired * BigInt(10_000 - QS_SLIPPAGE_BPS)) / 10_000n;
        const pol = parseUnits(QS_PROVIDE_POL, 18);
        const minPol = (pol * BigInt(10_000 - QS_SLIPPAGE_BPS)) / 10_000n;
        const deadline = Math.floor(Date.now() / 1000) + QS_DEADLINE_MINUTES * 60;
        const tx = await new Contract(router, routerArtifact.abi, signer)
          .provideLiquidity(desired, minMtx, minPol, deadline, { value: pol });
        await tx.wait(1);
        return { hash: tx.hash, note: `Pool seeded at parity (0.001 POL per MTX). LP tokens are in the deployer wallet.` };
      }
      default:
        throw new Error(`Unknown step ${step.id}.`);
    }
  }

  const runNextStep = async () => {
    if (!nextStep || runningId) return;
    if (netKey === 'polygon' && !acknowledged) {
      setFailed({ stepId: nextStep.id, message: 'Tick the mainnet acknowledgement checkbox first.' });
      return;
    }
    setFailed(null);
    setRunningId(nextStep.id);
    try {
      const result = await executeStep(nextStep);
      setDone((p) => ({ ...p, [nextStep.id]: result }));
      setStarted(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Step failed with an unknown error.';
      setFailed({ stepId: nextStep.id, message });
    } finally {
      setRunningId(null);
    }
  };

  const resetSession = () => {
    try { localStorage.removeItem(storageKey); } catch { /* ignore */ }
    setSubId(null);
    setAddrs({});
    setDone({});
    setFailed(null);
    setStarted(false);
    setAcknowledged(false);
  };

  const canRun = isDeployer && chainOk !== false && (netKey === 'amoy' || acknowledged) && !runningId && !!nextStep;

  return (
    <div className="deploy-console">
      <h1>Owner Deploy Console</h1>
      <p className="lede">
        Deploys the casino contracts and seeds the QuickSwap pool, one wallet tap per
        transaction. This page only works for the deployer wallet — every other wallet
        is refused.
      </p>

      <div className="safety-box">
        <strong>Read first.</strong>
        <ul>
          <li>This console never asks for a private key or seed phrase. Never enter one anywhere — not here, not in any popup this page opens.</li>
          <li>Nothing is sent automatically. Each step sends exactly one transaction, only when you tap its button, and your wallet shows it first.</li>
          <li>If any step fails, the console stops and names the failed step. Do not tap through a failure — read the error.</li>
          <li>Your progress (deployed addresses, subscription id, completed steps) is saved in this browser only, so a reload does not lose it.</li>
          <li>This console does <strong>not</strong> flip the live site. After the contracts are live, the flip is a separate repo change + site deploy.</li>
        </ul>
      </div>

      <div className="net-switch">
        <span>Network:</span>
        {(['polygon', 'amoy'] as NetKey[]).map((k) => (
          <button
            key={k}
            type="button"
            disabled={started}
            className={netKey === k ? 'net-btn active' : 'net-btn'}
            onClick={() => { setNetKey(k); setPreflightMsg(''); setPolBalance(null); setChainOk(null); }}
          >
            {NETWORKS[k].label}
          </button>
        ))}
        {started && <span className="hint">Network is locked once a session has started. Reset the session to switch.</span>}
      </div>

      {netKey === 'amoy' && (
        <div className="rehearsal-box">
          <strong>REHEARSAL MODE — Polygon Amoy testnet.</strong> No real funds move.
          Uses the Amoy test MTX, the mock QuickSwap router from the Amoy bootstrap, and
          real Amoy VRF. The Amoy deployer is the throwaway wallet
          <code> {short(net.deployer)}</code> — connect that wallet to rehearse.
          Step 2 needs Amoy LINK; the deployer currently holds 0, so it will stop there
          until Amoy LINK is funded.
        </div>
      )}

      {netKey === 'polygon' && (
        <label className="ack-box">
          <input
            type="checkbox"
            checked={acknowledged}
            onChange={(e) => setAcknowledged(e.target.checked)}
          />
          <span>
            I understand this deploys real contracts on Polygon mainnet and moves real
            funds — about 1–3 POL gas, up to 15 LINK for the VRF subscription (funds
            with your LINK balance if lower; top up later at vrf.chain.link), 5,000 MTX
            reserve funding, and 1,000 MTX + 1 POL initial QuickSwap liquidity
            (99,000 MTX stays queued in the router).
            <strong> No external audit has been performed on these contracts.</strong>
          </span>
        </label>
      )}

      <section className="panel">
        <h2>0 · Connect wallet + pre-flight</h2>
        {!isConnected ? (
          <button type="button" className="primary-btn" onClick={() => open()}>
            Connect wallet
          </button>
        ) : (
          <div>
            <p>Connected: <code>{address}</code></p>
            <p>
              Required deployer: <code>{net.deployer}</code>{' '}
              {isDeployer ? <span className="ok">✓ matches</span> : <span className="bad">✗ does not match — this console will refuse to run</span>}
            </p>
            {chainOk === false && <p className="bad">Wrong network — switch to {net.label}.</p>}
            <div className="row">
              <button type="button" className="primary-btn" onClick={runPreflight} disabled={!isDeployer}>
                Run pre-flight checks
              </button>
              <button type="button" onClick={() => ensureChain().catch((e) => setPreflightMsg(e instanceof Error ? e.message : 'Network switch failed.'))}>
                Switch to {net.label}
              </button>
            </div>
            {polBalance !== null && (
              <p>POL balance: <strong>{polBalance}</strong> (floor: {net.polFloor} POL)</p>
            )}
            {preflightMsg && <p className={preflightMsg.startsWith('Pre-flight passed') ? 'ok' : 'bad'}>{preflightMsg}</p>}
          </div>
        )}
      </section>

      <section className="panel">
        <h2>Steps — one tap per transaction</h2>
        <ol className="steps">
          {STEPS.map((step, i) => {
            const result = done[step.id];
            const isNext = nextStep?.id === step.id;
            const isFailed = failed?.stepId === step.id;
            const isRunning = runningId === step.id;
            return (
              <li key={step.id} className={result ? 'done' : isFailed ? 'failed' : isNext ? 'next' : 'pending'}>
                <div className="step-head">
                  <span className="step-num">{result ? '✓' : isFailed ? '✗' : i + 1}</span>
                  <strong>{step.title}</strong>
                  <span className="step-group">{step.group}</span>
                </div>
                <p className="step-detail">{step.detail}</p>
                <p className="step-target">Target: <code>{targetFor(step)}</code></p>
                <p className="step-value">Value: <strong>{step.valueText}</strong></p>
                {result?.note && <p className="step-note">{result.note}</p>}
                {result?.hash && (
                  <p className="step-hash">
                    Tx: <a href={`${net.explorer}/tx/${result.hash}`} target="_blank" rel="noreferrer">{short(result.hash)}</a>
                  </p>
                )}
                {isFailed && <p className="bad">Failed: {failed.message}</p>}
                {isRunning && <p>Waiting for your wallet… confirm in the wallet, then wait for confirmation.</p>}
              </li>
            );
          })}
        </ol>

        {!allDone && (
          <div className="next-action">
            {nextStep && (
              <>
                <p>
                  Next: <strong>{nextStep.title}</strong> — target <code>{targetFor(nextStep)}</code>, value <strong>{nextStep.valueText}</strong>
                </p>
                <button
                  type="button"
                  className="primary-btn big"
                  disabled={!canRun}
                  onClick={runNextStep}
                >
                  {runningId ? 'Waiting for wallet…' : `Send transaction — ${nextStep.title}`}
                </button>
                {!isConnected && <p className="hint">Connect the deployer wallet first.</p>}
                {isConnected && !isDeployer && <p className="bad">Connected wallet is not the deployer. Switch wallets.</p>}
                {netKey === 'polygon' && !acknowledged && <p className="hint">Tick the mainnet acknowledgement checkbox above first.</p>}
                {failed && <p className="bad">Stopped at “{STEPS.find((s) => s.id === failed.stepId)?.title}”: {failed.message}</p>}
              </>
            )}
          </div>
        )}
      </section>

      {allDone && (
        <section className="panel summary">
          <h2>✓ Go-live transactions complete</h2>
          <p>
            All 17 transactions are done. The contracts are deployed and the pool is seeded.
            <strong> The live site has NOT been flipped</strong> — Dice still shows “Coming Soon”
            until the site config is updated with these addresses and the site is redeployed.
          </p>
          <dl>
            <dt>RNGEngine</dt>
            <dd><code>{addrs.rng}</code> <CopyButton text={addrs.rng ?? ''} label="address" /></dd>
            <dt>CasinoReserve</dt>
            <dd><code>{addrs.reserve}</code> <CopyButton text={addrs.reserve ?? ''} label="address" /></dd>
            <dt>LiquidityRouter</dt>
            <dd><code>{addrs.router}</code> <CopyButton text={addrs.router ?? ''} label="address" /></dd>
            <dt>CasinoCore</dt>
            <dd><code>{addrs.core}</code> <CopyButton text={addrs.core ?? ''} label="address" /></dd>
            <dt>VRF subscription id</dt>
            <dd><code>{subId}</code> <CopyButton text={subId ?? ''} label="subscription id" /></dd>
          </dl>
          <p>
            Still to do after this: verify the four contracts on PolygonScan, confirm
            reserveHealth() reads 5,000 MTX, confirm the QuickSwap pair exists and the LP
            tokens are in the deployer wallet — then transfer governance to the multisig
            once its signers/threshold are confirmed, and approve the frontend flip.
          </p>
        </section>
      )}

      <button type="button" className="reset-btn" onClick={resetSession}>
        Reset session (clears saved addresses + progress in this browser)
      </button>

      <style>{`
        .deploy-console { max-width: 760px; margin: 0 auto; color: #e8f5e9; }
        .deploy-console h1 { font-size: 1.8rem; margin: 0 0 0.5rem; }
        .deploy-console h2 { font-size: 1.2rem; margin: 0 0 0.75rem; }
        .deploy-console .lede { color: #b9d6c0; }
        .deploy-console code { background: #0d2b16; padding: 0.1em 0.35em; border-radius: 4px; word-break: break-all; }
        .deploy-console a { color: #4ade80; }
        .safety-box, .rehearsal-box { border: 1px solid #f59e0b; background: #2b1d05; padding: 1rem; border-radius: 8px; margin: 1rem 0; }
        .rehearsal-box { border-color: #38bdf8; background: #08222f; }
        .safety-box ul { margin: 0.5rem 0 0 1.2rem; }
        .net-switch { display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap; margin: 1rem 0; }
        .net-btn, .deploy-console button { background: #12351f; color: #e8f5e9; border: 1px solid #2f7a44; padding: 0.5rem 0.9rem; border-radius: 6px; cursor: pointer; }
        .net-btn.active { background: #00ff99; color: #04150a; border-color: #00ff99; font-weight: 700; }
        .deploy-console button:disabled { opacity: 0.45; cursor: not-allowed; }
        .primary-btn { background: #00ff99; color: #04150a; font-weight: 700; border-color: #00ff99; }
        .primary-btn.big { font-size: 1.05rem; padding: 0.8rem 1.2rem; }
        .ack-box { display: flex; gap: 0.6rem; align-items: flex-start; border: 1px solid #ef4444; background: #2b0d0d; padding: 1rem; border-radius: 8px; margin: 1rem 0; cursor: pointer; }
        .ack-box input { margin-top: 0.2rem; transform: scale(1.3); }
        .panel { border: 1px solid #2f7a44; border-radius: 8px; padding: 1rem; margin: 1rem 0; background: #07130b; }
        .row { display: flex; gap: 0.5rem; flex-wrap: wrap; margin: 0.5rem 0; }
        .ok { color: #4ade80; font-weight: 700; }
        .bad { color: #f87171; }
        .hint { color: #9db8a4; font-size: 0.9rem; }
        .steps { list-style: none; padding: 0; margin: 0; display: grid; gap: 0.6rem; }
        .steps li { border: 1px solid #234; border-radius: 8px; padding: 0.75rem 1rem; background: #0a1f11; }
        .steps li.done { border-color: #00ff99; }
        .steps li.next { border-color: #f59e0b; background: #171206; }
        .steps li.failed { border-color: #ef4444; background: #220d0d; }
        .step-head { display: flex; gap: 0.6rem; align-items: baseline; flex-wrap: wrap; }
        .step-num { display: inline-block; min-width: 1.6rem; text-align: center; background: #12351f; border-radius: 4px; padding: 0.1rem 0.4rem; font-weight: 700; }
        .step-group { margin-left: auto; font-size: 0.8rem; color: #9db8a4; text-transform: uppercase; letter-spacing: 0.05em; }
        .step-detail, .step-target, .step-value, .step-note, .step-hash { margin: 0.3rem 0; font-size: 0.95rem; }
        .next-action { margin-top: 1rem; border-top: 1px solid #2f7a44; padding-top: 1rem; }
        .summary dl { display: grid; grid-template-columns: 11rem 1fr; gap: 0.4rem 0.8rem; align-items: center; }
        .summary dt { font-weight: 700; }
        .summary dd { margin: 0; display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap; }
        .copy-btn { font-size: 0.85rem; padding: 0.25rem 0.6rem; }
        .reset-btn { margin: 1rem 0 2rem; background: transparent; }
      `}</style>
    </div>
  );
}
