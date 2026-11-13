// Shared wallet connect path for Matrix Hub (HUB task 136).
//
// ONE connect behaviour for every surface — the header WalletConnect bar
// and the CasinoGameWrapper connect strip both call connectWallet() so
// the two can never drift apart again:
//
//   1. Injected wallet present (window.ethereum — MetaMask or any other
//      browser wallet): connect DIRECTLY through the injected provider
//      via AppKit's own headless connect (ConnectionController.
//      connectExternal — the same call AppKit's modal UI makes for
//      browser wallets) and SKIP the modal/chooser entirely. One tap.
//   2. No injected wallet, or the direct attempt fails / is declined:
//      fall back to the AppKit modal (open()), which offers
//      WalletConnect QR / wallet list as before.
//
// The result is a plain outcome object: callers own their loading and
// error state and render `message` inline in the strip/bar. connectWallet
// itself never throws, so no caller can be left stuck on "Connecting…"
// or staring at a blank area after a declined/failed attempt.
//
// Switch / disconnect live here too (same rule: ONE behaviour for every
// surface). switchWallet() forces a fresh account choice instead of
// silently returning the already-authorized account; disconnectWallet()
// tears the session down completely.
//
// Account changes made INSIDE the wallet (the user switches accounts in
// MetaMask while the site is open) need no wiring in this lib — that
// propagation is built into the installed stack and was verified in the
// @reown 1.8.16 sources: ChainAdapterBlueprint registers
// provider.on('accountsChanged') for the active connector and emits
// 'accountChanged'; appkit-base-client subscribes to that event and
// calls syncAccount(), which writes the new address into the same
// reactive state useAppKitAccount() reads. WalletConnect and
// CasinoGameWrapper both render from useAppKitAccount and refetch
// balances in effects keyed on `address`, so their headers follow the
// wallet with no reload. Non-React surfaces cannot use that hook — the
// owners portal gate listens to the provider event itself (owners.astro).
import { ConnectionController, ConnectorController } from '@reown/appkit-controllers';
import type { Connector } from '@reown/appkit-controllers';
import './initAppKit';

// Inline copy (also used as bundle markers for the direct-connect path).
export const WALLET_DIRECT_HINT = 'Browser wallet detected — one tap to connect, no wallet list.';
export const WALLET_DECLINED_MESSAGE =
  'Connection declined in your wallet. Tap Connect and approve the request in your wallet to continue.';
export const WALLET_DIRECT_FAILED_MESSAGE =
  'Direct wallet connection failed — opening the wallet chooser instead.';
export const WALLET_MODAL_FAILED_MESSAGE =
  'Could not open the wallet chooser. Reload the page and try again.';
export const WALLET_SWITCH_CANCELLED_MESSAGE =
  'Switch cancelled in your wallet — you are still connected as before.';
export const WALLET_SWITCH_FAILED_MESSAGE =
  'Could not switch in your wallet — opening the wallet chooser instead.';
export const WALLET_DISCONNECT_FAILED_MESSAGE =
  'Disconnect did not finish cleanly. Reload the page and try again.';

export type ConnectWalletOutcome =
  | { status: 'connected'; via: 'injected' | 'modal' }
  | { status: 'error'; message: string };

/** True when a browser wallet injected a provider (MetaMask & friends). */
export function hasInjectedWallet(): boolean {
  if (typeof window === 'undefined') return false;
  return Boolean((window as unknown as { ethereum?: unknown }).ethereum);
}

function isUserRejection(err: unknown): boolean {
  const e = err as { code?: number | string; name?: string; message?: string } | null;
  if (!e) return false;
  if (e.code === 4001 || e.code === '4001') return true;
  if (e.name === 'UserRejectedRequestError') return true;
  const msg = (e.message || '').toLowerCase();
  return msg.includes('rejected') || msg.includes('denied') || msg.includes('declined');
}

type ConnectorLike = Pick<Connector, 'id' | 'type' | 'name' | 'info' | 'provider'>;

/**
 * Decide injected-vs-modal: pick the connector that represents the
 * browser's injected wallet from AppKit's registered connectors.
 * Preference order:
 *   1. The EIP-6963 announced MetaMask connector (rdns io.metamask, or
 *      a MetaMask name) — the exact provider window.ethereum points at.
 *   2. Any other EIP-6963 announced connector (another browser wallet).
 *   3. The generic 'injected' connector (type INJECTED).
 * Returns undefined when AppKit has not registered an injected connector
 * yet (sync race right after page load).
 */
function pickInjectedConnector(): ConnectorLike | undefined {
  let connectors: ConnectorLike[] = [];
  try {
    connectors = ConnectorController.getConnectors('eip155') as ConnectorLike[];
  } catch {
    return undefined;
  }
  const announced = connectors.filter((c) => c.type === 'ANNOUNCED');
  const metamask = announced.find(
    (c) => c.info?.rdns === 'io.metamask' || /metamask/i.test(c.name || ''),
  );
  if (metamask) return metamask;
  if (announced.length > 0) return announced[0];
  return connectors.find((c) => c.type === 'INJECTED' || c.id === 'injected');
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Try the one-tap direct connect through the injected provider.
 * Returns true on success; throws the underlying error on failure so the
 * caller can classify it. Retries the connector lookup briefly because
 * EIP-6963 announcement / connector sync can land just after first paint.
 */
async function connectDirectInjected(): Promise<boolean> {
  let connector = pickInjectedConnector();
  for (let attempt = 0; !connector && attempt < 3; attempt++) {
    await sleep(200);
    connector = pickInjectedConnector();
  }

  if (connector) {
    await ConnectionController.connectExternal(
      {
        id: connector.id,
        type: connector.type,
        provider: connector.provider as Connector['provider'],
        info: connector.info,
      },
      'eip155',
    );
    return true;
  }

  // window.ethereum exists but AppKit's connector registry has not
  // caught up: address the built-in injected connector directly.
  const ethereum = (window as unknown as { ethereum?: unknown }).ethereum;
  await ConnectionController.connectExternal(
    {
      id: 'injected',
      type: 'INJECTED',
      provider: ethereum as Connector['provider'],
    },
    'eip155',
  );
  return true;
}

/**
 * The shared connect action. `open` is the caller's useAppKit().open,
 * used only as the modal fallback.
 */
export async function connectWallet(options: {
  open: () => Promise<unknown>;
}): Promise<ConnectWalletOutcome> {
  const { open } = options;

  if (hasInjectedWallet()) {
    try {
      await connectDirectInjected();
      return { status: 'connected', via: 'injected' };
    } catch (err) {
      // Direct connect failed or was declined: the modal is the
      // fallback (task 136), and the reason is surfaced inline by the
      // caller if the modal path does not end in a connection either.
      const directMessage = isUserRejection(err)
        ? WALLET_DECLINED_MESSAGE
        : WALLET_DIRECT_FAILED_MESSAGE;
      try {
        await open();
        return { status: 'error', message: directMessage };
      } catch {
        return { status: 'error', message: WALLET_MODAL_FAILED_MESSAGE };
      }
    }
  }

  // No injected wallet: the modal/chooser is the connect path.
  try {
    await open();
    return { status: 'connected', via: 'modal' };
  } catch {
    return { status: 'error', message: WALLET_MODAL_FAILED_MESSAGE };
  }
}

// ---------------------------------------------------------------------------
// Switch wallet / disconnect
// ---------------------------------------------------------------------------

export type SwitchWalletOutcome =
  | { status: 'switched'; address?: string }
  | { status: 'error'; message: string };

export type DisconnectWalletOutcome =
  | { status: 'disconnected' }
  | { status: 'error'; message: string };

type InjectedProviderLike = {
  request: (args: { method: string; params?: unknown }) => Promise<unknown>;
};

function getInjectedProvider(): InjectedProviderLike | undefined {
  if (typeof window === 'undefined') return undefined;
  const eth = (window as unknown as { ethereum?: unknown }).ethereum;
  if (eth && typeof (eth as InjectedProviderLike).request === 'function') {
    return eth as InjectedProviderLike;
  }
  return undefined;
}

/**
 * Force a fresh account choice.
 *
 * A plain reconnect silently returns the account the wallet already
 * authorized — that is what made the site feel "stuck" on one address.
 * With an injected wallet this asks the wallet itself to re-open its
 * account picker (EIP-2255 wallet_requestPermissions for eth_accounts),
 * then re-syncs the AppKit session to whatever account is authorized
 * afterwards. Picking the same account again is the user's choice, not
 * an error. Cancelling the picker changes nothing: the current session
 * is left exactly as it was and the outcome says so.
 *
 * Without an injected wallet — or when the wallet does not implement
 * the permissions request — the AppKit modal is the switch path, the
 * same fallback rule as connectWallet(). Never throws.
 */
export async function switchWallet(options: {
  open: () => Promise<unknown>;
}): Promise<SwitchWalletOutcome> {
  const { open } = options;
  const provider = getInjectedProvider();

  if (!provider) {
    try {
      await open();
      return { status: 'switched' };
    } catch {
      return { status: 'error', message: WALLET_MODAL_FAILED_MESSAGE };
    }
  }

  try {
    await provider.request({
      method: 'wallet_requestPermissions',
      params: [{ eth_accounts: {} }],
    });
  } catch (err) {
    if (isUserRejection(err)) {
      return { status: 'error', message: WALLET_SWITCH_CANCELLED_MESSAGE };
    }
    // The wallet cannot re-prompt for accounts (method unsupported) or
    // the prompt failed some other way (e.g. another request already
    // pending): the AppKit modal is the switch path. Never pretend a
    // switch happened when it didn't.
    try {
      await open();
      return { status: 'error', message: WALLET_SWITCH_FAILED_MESSAGE };
    } catch {
      return { status: 'error', message: WALLET_MODAL_FAILED_MESSAGE };
    }
  }

  // Re-sync AppKit to the provider's now-current authorized account
  // through the same direct connect used at sign-in.
  try {
    await connectDirectInjected();
  } catch (err) {
    if (isUserRejection(err)) {
      return { status: 'error', message: WALLET_SWITCH_CANCELLED_MESSAGE };
    }
    try {
      await open();
      return { status: 'error', message: WALLET_SWITCH_FAILED_MESSAGE };
    } catch {
      return { status: 'error', message: WALLET_MODAL_FAILED_MESSAGE };
    }
  }

  // Report the account the session now sits on (informational — the
  // surfaces render reactively from AppKit state regardless).
  try {
    const accounts = (await provider.request({ method: 'eth_accounts' })) as
      | string[]
      | null;
    if (Array.isArray(accounts) && accounts.length > 0) {
      return { status: 'switched', address: accounts[0] };
    }
  } catch {
    // eth_accounts is a silent read; if it fails the switch itself has
    // already succeeded, so don't turn that into an error.
  }
  return { status: 'switched' };
}

// Portal unlock flags this site sets itself (src/pages/owners.astro):
// `owners_wallet_auth` for the wallet unlock, `owners_auth` for the
// access-code unlock. A disconnect must re-lock the portal — without
// this the tab would stay "unlocked" for whoever uses the browser
// next even though the wallet is gone. ONLY these site-owned keys are
// touched: AppKit clears its own persisted session inside
// ConnectionController.disconnect(), the wallet-bar minimize preference
// (matrixhub:wallet:minimized) is a display setting rather than session
// state, and the casino games' per-address bet pointers
// (matrixhub:<game>:activeBet:<address>) belong to in-flight bets, not
// to the session, so they are deliberately left alone.
const SITE_PORTAL_UNLOCK_KEYS = ['owners_wallet_auth', 'owners_auth'] as const;

function clearSitePortalUnlock(): void {
  if (typeof window === 'undefined') return;
  try {
    for (const key of SITE_PORTAL_UNLOCK_KEYS) {
      window.sessionStorage.removeItem(key);
    }
  } catch {
    // Storage can throw in locked-down browsers; the AppKit disconnect
    // is the substantive part and has already happened by this point.
  }
}

/**
 * Full clean disconnect: AppKit tears down its session (connector,
 * WalletConnect session and its persisted state), and the site's own
 * portal unlock flags are cleared so nothing is left connected or
 * unlocked. The portal flags are cleared even if the AppKit disconnect
 * itself reports a failure. Never throws.
 */
export async function disconnectWallet(): Promise<DisconnectWalletOutcome> {
  let failed = false;
  try {
    await ConnectionController.disconnect();
  } catch {
    failed = true;
  }
  clearSitePortalUnlock();
  if (failed) {
    return { status: 'error', message: WALLET_DISCONNECT_FAILED_MESSAGE };
  }
  return { status: 'disconnected' };
}
