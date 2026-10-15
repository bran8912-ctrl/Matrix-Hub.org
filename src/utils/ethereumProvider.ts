import type { Eip1193Provider } from 'ethers';

export type InjectedEthereumProvider = Eip1193Provider & {
  on?: (eventName: string, listener: (...args: unknown[]) => void) => void;
};

export function getEthereumProvider(): InjectedEthereumProvider | null {
  if (typeof window === 'undefined' || !window.ethereum) return null;
  return window.ethereum as unknown as InjectedEthereumProvider;
}