import { MTX } from '../config/mtx';
import mtxAbi from '../abi/mtx.json';
import { getEthereumProvider } from './ethereumProvider';

/**
 * Utility function to spend/transfer MTX tokens from the connected wallet
 * to a specified address (e.g., casino vault for placing bets).
 */
export async function spendMTX(to: string, amount: string): Promise<string> {
  const normalizedAmount = amount.trim();

  if (!normalizedAmount) throw new Error('Amount is required and cannot be empty.');
  if (!MTX.isDeployed) throw new Error('MTX token contract is not deployed yet. Cannot transfer tokens.');
  if (!/^0x[a-fA-F0-9]{40}$/.test(to) || /^0x0{40}$/i.test(to)) {
    throw new Error('Recipient must be a valid, non-zero EVM address.');
  }

  const numericAmount = parseFloat(normalizedAmount);
  if (!Number.isFinite(numericAmount) || numericAmount <= 0) throw new Error('Amount must be a valid number greater than zero.');

  const ethereum = getEthereumProvider();
  if (!ethereum) {
    throw new Error('Polygon wallet not found. Please install MetaMask or compatible wallet.');
  }

  try {
    const { BrowserProvider, Contract, parseUnits } = await import('ethers');
    const provider = new BrowserProvider(ethereum);
    const signer = await provider.getSigner();

    const mtxContract = new Contract(MTX.address, mtxAbi, signer);

    const decimals = await mtxContract.decimals();

    let amountInWei;
    try {
      amountInWei = parseUnits(normalizedAmount, decimals);
    } catch (_err) {
      throw new Error('Amount format is invalid. Please enter a plain decimal number (e.g., "10.5").');
    }

    const userAddress = await signer.getAddress();

    const balance = await mtxContract.balanceOf(userAddress);
    if (balance < amountInWei) throw new Error(`Insufficient MTX balance. Required: ${amount} MTX`);

    const tx = await mtxContract.transfer(to, amountInWei);
    const receipt = await tx.wait(1);

    return receipt.transactionHash || (tx as any).hash;
  } catch (error: any) {
    if (error?.code === 'ACTION_REJECTED') throw new Error('Transaction rejected by user.');
    throw new Error(`MTX transfer failed: ${error.message || 'Unknown error'}`);
  }
}

export async function ensureEthereum(): Promise<void> {
  const ethereum = getEthereumProvider();
  if (!ethereum) throw new Error('Polygon wallet not found. Please install MetaMask or compatible wallet.');

  try {
    const { BrowserProvider } = await import('ethers');
    const provider = new BrowserProvider(ethereum);
    const network = await provider.getNetwork();

    if (network.chainId !== BigInt(MTX.chainId)) {
      try {
        await ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: `0x${MTX.chainId.toString(16)}` }],
        });
      } catch (switchError: any) {
        if (switchError.code === 4902) {
          try {
            await ethereum.request({
              method: 'wallet_addEthereumChain',
              params: [{
                chainId: `0x${MTX.chainId.toString(16)}`,
                chainName: MTX.chainName,
                nativeCurrency: MTX.nativeCurrency,
                rpcUrls: MTX.rpcUrls,
                blockExplorerUrls: MTX.blockExplorerUrls,
              }],
            });
          } catch (_addError) {
            throw new Error(`Failed to add ${MTX.chainName} network to wallet. Please add it manually.`);
          }
        } else {
          throw switchError;
        }
      }
    }
  } catch (error: any) {
    throw new Error(`Network check failed: ${error.message || 'Unknown error'}`);
  }
}
