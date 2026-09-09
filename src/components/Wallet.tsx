const Wallet = () => {
  // ... existing code ...

  const setupWallet = async (walletProvider: EIP1193Provider, address: string) => {
    if (!walletProvider) return;

    try {
      const { BrowserProvider } = await import('ethers');
      const ethersProvider = new BrowserProvider(walletProvider)
      setProvider(ethersProvider)

      // Ensure we're on the correct network
      await ensureEthereum()

      await fetchBalance(ethersProvider, address)
    } catch (err) {
      console.error('Error setting up wallet:', err)
      setError(err && err.message ? err.message : 'Failed to set up wallet connection.')
    }
  }

  // ... rest of component ...
}
