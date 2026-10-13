import React, { type ReactNode, useEffect } from 'react';
import { createAppKit } from '@reown/appkit/react'
import { EthersAdapter } from '@reown/appkit-adapter-ethers'
import { mainnet, polygon } from '@reown/appkit/networks'
import { projectId, metadata } from '../config/appkit'

// Track if AppKit has been initialized to prevent duplicate initialization
let isInitialized = false;

interface AppKitProviderProps {
  children: ReactNode;
}

// This component initializes AppKit modal once on the client side
export default function AppKitProvider({ children }: AppKitProviderProps) {
  useEffect(() => {
    // Only initialize on client side and only once
    if (typeof window !== 'undefined' && !isInitialized) {
      isInitialized = true;
      
      createAppKit({
        adapters: [new EthersAdapter()],
        networks: [polygon, mainnet],
        defaultNetwork: polygon,
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
