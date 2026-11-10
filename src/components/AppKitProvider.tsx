import React, { type ReactNode, useEffect } from 'react';
import { createAppKit } from '@reown/appkit/react'
import { EthersAdapter } from '@reown/appkit-adapter-ethers'
import { mainnet, polygon, polygonAmoy } from '@reown/appkit/networks'
import { projectId, metadata, walletConnectEnabled } from '../config/appkit'
import { MTX } from '../config/mtx'

// Track if AppKit has been initialized to prevent duplicate initialization
let isInitialized = false;

interface AppKitProviderProps {
  children: ReactNode;
}

// This component initializes AppKit modal once on the client side
export default function AppKitProvider({ children }: AppKitProviderProps) {
  useEffect(() => {
    // Only initialize on client side and only once, and only when a real
    // WalletConnect project ID is configured (2026-11-10: project "Matrix Hub"
    // exists; the ID comes from PUBLIC_WALLETCONNECT_PROJECT_ID).
    if (typeof window !== 'undefined' && !isInitialized && walletConnectEnabled) {
      isInitialized = true;
      
      createAppKit({
        adapters: [new EthersAdapter()],
        networks: [polygon, polygonAmoy, mainnet],
        defaultNetwork: MTX.chainId === 80002 ? polygonAmoy : polygon,
        metadata,
        projectId,
        features: {
          analytics: false,
          email: false,
          socials: [],
        },
        themeMode: 'dark',
        themeVariables: {
          '--w3m-accent': '#00ff99',
          '--w3m-border-radius-master': '4px',
        }
      })
    }
  }, [])

  return <>{children}</>
}
