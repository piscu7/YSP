'use client';

import React from 'react';
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useEffect, useState } from 'react';
import { ConfirmedSignatureInfo } from '@solana/web3.js';
import { PROGRAM_ID } from '@/utils/program';
import LoadingSpinner from './LoadingSpinner';

interface ParsedTx {
  signature: string;
  type: 'stake' | 'unstake' | 'claim' | 'unknown';
  timestamp: number;
  status: 'success' | 'error';
}

export default function TransactionHistory() {
  const { connection } = useConnection();
  const { publicKey } = useWallet();
  const [transactions, setTransactions] = useState<ParsedTx[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!publicKey) return;

    const fetchTransactions = async () => {
      setIsLoading(true);
      try {
        const signatures = await connection.getSignaturesForAddress(PROGRAM_ID, { limit: 10 });
        const parsedTxs = await Promise.all(
          signatures.map(async (sig): Promise<ParsedTx> => {
            const tx = await connection.getTransaction(sig.signature);
            let type: ParsedTx['type'] = 'unknown';
            
            if (tx?.meta?.logMessages) {
              if (tx.meta.logMessages.some(log => log.includes('addLiquidity'))) {
                type = 'stake';
              } else if (tx.meta.logMessages.some(log => log.includes('removeLiquidity'))) {
                type = 'unstake';
              } else if (tx.meta.logMessages.some(log => log.includes('claimRewards'))) {
                type = 'claim';
              }
            }

            return {
              signature: sig.signature,
              type,
              timestamp: sig.blockTime || 0,
              status: tx?.meta?.err ? 'error' : 'success'
            };
          })
        );

        setTransactions(parsedTxs);
      } catch (error) {
        console.error('Error fetching transactions:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchTransactions();
    const interval = setInterval(fetchTransactions, 30000);
    return () => clearInterval(interval);
  }, [connection, publicKey]);

  if (!publicKey) return null;

  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
      <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">Transaction History</h2>
      {isLoading ? (
        <div className="flex justify-center py-4">
          <LoadingSpinner />
        </div>
      ) : transactions.length === 0 ? (
        <p className="text-center text-gray-700 dark:text-gray-300">No transactions found</p>
      ) : (
        <div className="space-y-3">
          {transactions.map((tx) => (
            <div
              key={tx.signature}
              className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded"
            >
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    {tx.type.charAt(0).toUpperCase() + tx.type.slice(1)}
                  </span>
                  <span
                    className={`px-2 py-1 text-xs rounded ${
                      tx.status === 'success'
                        ? 'bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100'
                        : 'bg-red-100 text-red-800 dark:bg-red-800 dark:text-red-100'
                    }`}
                  >
                    {tx.status}
                  </span>
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {new Date(tx.timestamp * 1000).toLocaleString()}
                </div>
              </div>
              <a
                href={`https://explorer.dev2.eclipsenetwork.xyz/tx/${tx.signature}?cluster=devnet`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 text-sm"
              >
                View
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  );
} 