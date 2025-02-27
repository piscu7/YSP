'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddress } from '@solana/spl-token';
import { PSCU_MINT, USDC_MINT, PROGRAM_ID } from '@/utils/program';
import LoadingSpinner from './LoadingSpinner';

const StakeInfo: React.FC = () => {
  const { connection } = useConnection();
  const { publicKey } = useWallet();
  const [pscuStaked, setPscuStaked] = useState<number | null>(null);
  const [usdcStaked, setUsdcStaked] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // İlk yükleme için bir ref tutuyoruz
  const isFirstLoad = useRef(true);

  useEffect(() => {
    const fetchStakedBalances = async () => {
      if (!publicKey) {
        setLoading(false);
        return;
      }

      try {
        // Sadece ilk yüklemede loading state'ini true yapıyoruz
        if (isFirstLoad.current) {
          setLoading(true);
          isFirstLoad.current = false;
        }
        
        setError(null);

        // Vault PDA'sını bul
        const [vaultPDA] = await PublicKey.findProgramAddress(
          [Buffer.from("vault")],
          PROGRAM_ID
        );

        // Vault token hesaplarını bul
        const vaultPscuAccount = await getAssociatedTokenAddress(
          PSCU_MINT,
          vaultPDA,
          true
        );

        const vaultUsdcAccount = await getAssociatedTokenAddress(
          USDC_MINT,
          vaultPDA,
          true
        );

        // Vault token hesaplarının bakiyelerini al
        const pscuAccountInfo = await connection.getAccountInfo(vaultPscuAccount);
        const usdcAccountInfo = await connection.getAccountInfo(vaultUsdcAccount);

        // Eğer hesaplar varsa bakiyelerini al
        if (pscuAccountInfo) {
          const pscuBalance = await connection.getTokenAccountBalance(vaultPscuAccount);
          setPscuStaked(Number(pscuBalance.value.uiAmount));
        } else {
          setPscuStaked(0);
        }

        if (usdcAccountInfo) {
          const usdcBalance = await connection.getTokenAccountBalance(vaultUsdcAccount);
          setUsdcStaked(Number(usdcBalance.value.uiAmount));
        } else {
          setUsdcStaked(0);
        }

        setLoading(false);
      } catch (err) {
        console.error('Error fetching staked balances:', err);
        setError('Failed to fetch staked balances');
        setLoading(false);
      }
    };

    fetchStakedBalances();
    
    // 10 saniyede bir bakiyeleri güncelle
    const interval = setInterval(fetchStakedBalances, 10000);
    
    return () => clearInterval(interval);
  }, [publicKey, connection]);

  if (!publicKey) {
    return (
      <div className="text-center p-6 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
        <div className="text-lg font-medium text-gray-500 dark:text-gray-400 mb-2">
          Wallet Not Connected
        </div>
        <p className="text-sm text-gray-400 dark:text-gray-500">
          Connect your wallet to view your liquidity information
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col justify-center items-center p-8 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
        <LoadingSpinner />
        <p className="mt-4 text-gray-500 dark:text-gray-400">Loading liquidity information...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
        <div className="text-lg font-medium text-red-600 dark:text-red-400 mb-2">
          Error Loading Liquidity Info
        </div>
        <p className="text-sm text-red-500 dark:text-red-300">
          {error}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* PSCU Kartı - Eclipse Yeşil renk */}
        <div className="p-6 bg-[#00A651] rounded-lg border border-[#00A651] shadow-sm hover:shadow-md transition-shadow duration-300">
          <div className="flex items-center mb-4">
            <div className="w-10 h-10 rounded-full flex items-center justify-center mr-3 overflow-hidden bg-black">
              <img 
                src="https://docs.eclipse.xyz/~gitbook/image?url=https%3A%2F%2F1195435467-files.gitbook.io%2F%7E%2Ffiles%2Fv0%2Fb%2Fgitbook-x-prod.appspot.com%2Fo%2Forganizations%252FWm7k38cXuZMoYB4oIMfh%252Fsites%252Fsite_DKpv5%252Ficon%252F7NmJOf75mi786DwFAu51%252FEclipse_logo_logo_green.png%3Falt%3Dmedia%26token%3Db35d8201-37c8-40c1-96bd-1168956c100a&width=32&dpr=2&quality=100&sign=1563d4c&sv=2" 
                alt="Eclipse Logo" 
                width={24} 
                height={24} 
                className="w-6 h-6"
              />
            </div>
            <div className="text-lg font-medium text-white">PSCU Liquidity</div>
          </div>
          <div className="text-3xl font-bold text-white">
            {pscuStaked !== null ? pscuStaked.toLocaleString() : '0'}
          </div>
          <div className="mt-2 text-sm text-white/80">
            Total PSCU tokens in pool
          </div>
        </div>
        
        {/* USDC Kartı - Mavi renk */}
        <div className="p-6 bg-gradient-to-br from-blue-900 to-indigo-900 rounded-lg border border-blue-800 shadow-sm hover:shadow-md transition-shadow duration-300">
          <div className="flex items-center mb-4">
            <div className="w-10 h-10 rounded-full bg-blue-800 flex items-center justify-center mr-3">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-300" viewBox="0 0 20 20" fill="currentColor">
                <path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z" />
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="text-lg font-medium text-blue-300">USDC Liquidity</div>
          </div>
          <div className="text-3xl font-bold text-white">
            {usdcStaked !== null ? usdcStaked.toLocaleString() : '0'}
          </div>
          <div className="mt-2 text-sm text-blue-400">
            Total USDC tokens in pool
          </div>
        </div>
      </div>
      
      <div className="text-center text-sm text-gray-500 dark:text-gray-400 mt-4">
        <p>Liquidity information updates automatically every 10 seconds</p>
      </div>
    </div>
  );
};

export default StakeInfo; 