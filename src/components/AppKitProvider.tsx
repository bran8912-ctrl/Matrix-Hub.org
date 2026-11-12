import React, { type ReactNode, useEffect } from 'react';
// AppKit creation lives in lib/initAppKit (HUB task 136): it runs at
// module load — before any wallet island renders — with session
// persistence (enableReconnect) pinned on, instead of depending on this
// provider's effect firing before sibling islands hydrate. Importing it
// here keeps the initialization attached to this provider as before;
// the effect call below is an idempotent safety net.
import { initAppKit } from '../lib/initAppKit';

interface AppKitProviderProps {
  children: ReactNode;
}

// This component ensures AppKit is initialized once on the client side
// (only when a real WalletConnect project ID is configured — the ID
// comes from PUBLIC_WALLETCONNECT_PROJECT_ID) and renders its children.
export default function AppKitProvider({ children }: AppKitProviderProps) {
  useEffect(() => {
    initAppKit();
  }, []);

  return <>{children}</>;
}
