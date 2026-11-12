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
