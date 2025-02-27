'use client';

import React, { useState, useEffect } from 'react';
import { useConnection } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddress } from '@solana/spl-token';
import LoadingSpinner from './LoadingSpinner';

interface TokenBalanceProps {
  mint: PublicKey;
  owner: PublicKey;
  symbol: string;
}

const TokenBalance: React.FC<TokenBalanceProps> = ({ mint, owner, symbol }) => {
  const { connection } = useConnection();
  const [balance, setBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchBalance = async () => {
      try {
        setLoading(true);
        setError(null);
        
        console.log(`Checking balance for token ${symbol}:`);
        console.log(`- Token mint: ${mint.toString()}`);
        console.log(`- Owner: ${owner.toString()}`);
        
        // Get the associated token account
        const ata = await getAssociatedTokenAddress(mint, owner);
        console.log(`- ATA: ${ata.toString()}`);
        
        // Check if the account exists
        const accountInfo = await connection.getAccountInfo(ata);
        console.log(`- Account exists: ${accountInfo !== null}`);
        
        if (accountInfo) {
          // Get the token balance
          const tokenBalance = await connection.getTokenAccountBalance(ata);
          console.log(`- Balance: ${tokenBalance.value.uiAmount} ${symbol}`);
          setBalance(Number(tokenBalance.value.uiAmount));
        } else {
          setBalance(0);
        }
        
        setLoading(false);
      } catch (err) {
        console.error(`Error fetching ${symbol} balance:`, err);
        setError(`Failed to fetch ${symbol} balance`);
        setLoading(false);
      }
    };

    if (owner) {
      fetchBalance();
    }
  }, [connection, mint, owner, symbol]);

  if (loading) {
    return (
      <div className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg border border-blue-700">
        <div className="text-blue-300">{symbol}</div>
        <div className="flex items-center">
          <LoadingSpinner size="sm" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-between p-3 bg-red-800/30 rounded-lg border border-red-700">
        <div className="text-blue-300">{symbol}</div>
        <div className="text-red-400">Error</div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg border border-blue-700">
      <div className="text-blue-300">{symbol}</div>
      <div className="text-white font-medium">
        {balance !== null ? balance.toLocaleString() : '0'}
      </div>
    </div>
  );
};

export default TokenBalance; 