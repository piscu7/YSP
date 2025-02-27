'use client';

import dynamic from 'next/dynamic';
import { FC, ReactNode, useMemo } from 'react';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { BackpackWalletAdapter } from '@solana/wallet-adapter-backpack';

const WalletModalProvider = dynamic(
  () => import('@solana/wallet-adapter-react-ui').then(mod => mod.WalletModalProvider),
  { ssr: false }
);

require('@solana/wallet-adapter-react-ui/styles.css');

const WalletContextProvider: FC<{ children: ReactNode }> = ({ children }) => {
  // Eclipse RPC'sini kullan
  const url = useMemo(() => "https://mainnetbeta-rpc.eclipse.xyz", []);
  const wallets = useMemo(() => [new BackpackWalletAdapter()], []);

  return (
    <ConnectionProvider endpoint={url}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          {children}
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
};

export { WalletContextProvider };