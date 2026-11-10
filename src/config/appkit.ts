// Reown AppKit Configuration
// Reown AppKit (formerly Web3Modal v3) configuration for wallet connections
// Documentation: https://docs.reown.com/appkit

// WalletConnect Project ID
// Get your project ID from: https://cloud.reown.com
// 2026-11-10: no Reown project exists yet, so wallet connect is explicitly
// DISABLED until a real project ID is configured. There is no placeholder
// fallback — shipping one would present a broken connect button.
// To re-enable: create a free project at https://cloud.reown.com and set
// PUBLIC_WALLETCONNECT_PROJECT_ID (GitHub secret, wired in astro.yml).
export const projectId = import.meta.env.PUBLIC_WALLETCONNECT_PROJECT_ID || ''

// True only when a real WalletConnect project ID is configured.
export const walletConnectEnabled = projectId !== ''

if (!walletConnectEnabled) {
  console.warn('⚠️  WalletConnect is disabled: no PUBLIC_WALLETCONNECT_PROJECT_ID is configured.')
}

// Metadata for your dApp
export const metadata = {
  name: 'Matrix Hub',
  description: 'Matrix Hub - Tools, Modules, and MTX Token Ecosystem',
  url: typeof window !== 'undefined' ? window.location.origin : 'https://matrix-hub.org',
  icons: [typeof window !== 'undefined' ? `${window.location.origin}/favicon.ico` : 'https://matrix-hub.org/favicon.ico']
}
