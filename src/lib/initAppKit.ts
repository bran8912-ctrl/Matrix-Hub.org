// Shared Reown AppKit initialization for Matrix Hub (HUB task 136).
//
// Why this module exists: AppKit used to be created only inside
// AppKitProvider's useEffect. The wallet consumers (header WalletConnect,
// CasinoGameWrapper on the game pages) are SEPARATE Astro islands that do
// not live inside AppKitProvider's React tree, and their hooks
// (useAppKit) throw when the AppKit modal singleton does not exist yet.
// Whether a page worked — and whether a persisted session was restored —
// therefore depended on sibling-island effect timing.
//
// initAppKit() is idempotent and is called:
//   1. at module scope below (as soon as any island chunk that imports
//      this module loads — strictly before that island's first render),
//   2. by AppKitProvider (module import + effect, belt and braces),
//   3. implicitly by the shared connect path (lib/connectWallet imports
//      this module), so the connect button can never race an
//      uninitialized modal.
//
// Session persistence: this stays entirely inside the Reown/wagmi-style
// stack — no hand-rolled token storage. AppKit persists the connector id,
// connection status and WalletConnect session in localStorage itself
// (StorageUtil) and, on createAppKit, re-syncs the previous connection
// (syncExistingConnection -> adapter syncConnection/syncConnections,
// which reads eth_accounts from the injected provider without a popup).
// That auto-reconnect only runs when enableReconnect is on; it defaults
// to true upstream, and is now set EXPLICITLY below so the behaviour is
// pinned in our config (and greppable in the built bundle) instead of
// depending on an upstream default. enableInjected / enableEIP6963 are
// likewise explicit: they register the browser-wallet connectors that
// both the reconnect sync and the one-tap direct connect rely on.
import { createAppKit } from '@reown/appkit/react';
import { EthersAdapter } from '@reown/appkit-adapter-ethers';
import { mainnet, polygon, polygonAmoy } from '@reown/appkit/networks';
import { projectId, metadata, walletConnectEnabled } from '../config/appkit';
import { MTX } from '../config/mtx';

let appKitInitialized = false;

export function initAppKit(): void {
  if (appKitInitialized) return;
  if (typeof window === 'undefined') return;
  if (!walletConnectEnabled) return;
  appKitInitialized = true;

  createAppKit({
    adapters: [new EthersAdapter()],
    networks: [polygon, polygonAmoy, mainnet],
    defaultNetwork: MTX.chainId === 80002 ? polygonAmoy : polygon,
    metadata,
    projectId,
    // Session persistence (task 136): restore the previous wallet
    // session automatically on page load instead of dropping to
    // disconnected. See the module header for how the stack does this.
    enableReconnect: true,
    // Browser-wallet connectors: required for the persisted injected
    // session to re-sync and for one-tap direct connect.
    enableInjected: true,
    enableEIP6963: true,
    features: {
      analytics: false,
      email: false,
      socials: [],
    },
    themeMode: 'dark',
    themeVariables: {
      '--w3m-accent': '#00ff99',
      '--w3m-border-radius-master': '4px',
    },
  });
}

// Start initialization the moment this module is loaded on the client,
// before the importing island renders.
initAppKit();
