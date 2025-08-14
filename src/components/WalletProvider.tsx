'use client';

import { 
  AptosWalletAdapterProvider,
  useWallet as useAptosWallet,
  Wallet,
  WalletName,
} from '@aptos-labs/wallet-adapter-react';
import { ReactNode, createContext, useContext, useEffect, useMemo, useState } from 'react';

type WalletContextType = {
  account: any | null;
  accountAddress: string | null;
  connect: (walletName: WalletName) => Promise<void>;
  disconnect: () => Promise<void>;
  isConnected: boolean;
  isConnecting: boolean;
  network: any | null;
  wallet: Wallet | null;
  wallets: Wallet[];
};

const WalletContext = createContext<WalletContextType | null>(null);

export const useWallet = () => {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
};

interface WalletProviderInnerProps {
  children: ReactNode;
}

const WalletProviderInner = ({ children }: WalletProviderInnerProps) => {
  const { 
    connect: connectWallet, 
    disconnect: disconnectWallet, 
    account, 
    network, 
    wallet, 
    wallets, 
    connected,
  } = useAptosWallet();
  
  const [accountObj, setAccountObj] = useState<any | null>(null);
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  
  // Initialize account object when wallet is connected
  useEffect(() => {
    const initAccount = async () => {
      if (!connected || !account?.address) {
        setAccountObj(null);
        return;
      }

      try {
        setIsConnecting(true);
        
        // Create a simple account object with the address
        const accountObj = {
          address: account.address,
          publicKey: account.publicKey || new Uint8Array(),
          // Add any other required account methods with stubs
          signTransaction: async () => { 
            throw new Error('Cannot sign transactions directly in WalletProvider'); 
          },
          signMessage: async () => ({
            fullMessage: '',
            message: '',
            signature: new Uint8Array(),
            prefix: 'APTOS',
            bitmap: new Uint8Array()
          })
        };
        
        setAccountObj(accountObj);
      } catch (error) {
        console.error('Error initializing account:', error);
        setAccountObj(null);
      } finally {
        setIsConnecting(false);
      }
    };

    const timeoutId = setTimeout(initAccount, 0);
    return () => clearTimeout(timeoutId);
  }, [connected, account]);
  
  const connect = async (walletName: WalletName): Promise<void> => {
    if (isConnecting) {
      console.warn('Wallet connection already in progress');
      return;
    }
    
    try {
      setIsConnecting(true);
      await connectWallet(walletName);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to connect wallet';
      console.error('Error connecting wallet:', errorMessage);
      setIsConnecting(false);
      throw new Error(errorMessage);
    }
  };

  const disconnect = async (): Promise<void> => {
    if (isConnecting) {
      console.warn('Wallet disconnection already in progress');
      return;
    }

    try {
      setIsConnecting(true);
      await disconnectWallet();
      setAccountObj(null);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to disconnect wallet';
      console.error('Error disconnecting wallet:', errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsConnecting(false);
    }
  };

  const value = useMemo(
    () => ({
      account: accountObj,
      accountAddress: account?.address?.toString() || null,
      connect,
      disconnect,
      isConnected: connected,
      isConnecting,
      network: network || null,
      wallet: wallet || null,
      wallets: wallets || [],
    }),
    [account, accountObj, connected, isConnecting, network, wallet, wallets]
  ) as WalletContextType;

  return (
    <WalletContext.Provider value={value}>
      {children}
    </WalletContext.Provider>
  );
};

interface WalletProviderProps {
  children: ReactNode;
}

const WalletProvider = ({ children }: WalletProviderProps) => {
  // Clear any potentially corrupted wallet data from localStorage
  useEffect(() => {
    try {
      const walletState = localStorage.getItem('aptos-wallet-state');
      if (walletState) {
        JSON.parse(walletState);
      }
    } catch (e) {
      console.log('Clearing corrupted wallet state');
      localStorage.removeItem('aptos-wallet-state');
    }
  }, []);

  return (
    <AptosWalletAdapterProvider autoConnect={false} plugins={[]}>
      <WalletProviderInner>
        {children}
      </WalletProviderInner>
    </AptosWalletAdapterProvider>
  );
};

export default WalletProvider;
