'use client';

import React, { useState } from 'react';
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { getProgram } from '@/utils/program';
import { getStakeAccounts } from '@/utils/programHelper';
import * as anchor from "@coral-xyz/anchor";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import toast from 'react-hot-toast';
import { getErrorMessage } from '@/utils/errors';
import LoadingSpinner from './LoadingSpinner';

interface StakeActionsProps {
  onSuccess?: () => void;
}

export default function StakeActions({ onSuccess }: StakeActionsProps) {
  const { connection } = useConnection();
  const { publicKey, wallet } = useWallet();
  const [isUnstaking, setIsUnstaking] = useState(false);
  const [isClaiming, setIsClaiming] = useState(false);
  const [unstakeAmount, setUnstakeAmount] = useState("");
  const [selectedToken, setSelectedToken] = useState<"PSCU" | "USDC">("PSCU");

  const handleUnstake = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!publicKey || !wallet || !unstakeAmount) return;

    const toastId = toast.loading('Processing unstake transaction...');
    setIsUnstaking(true);
    
    try {
      const accounts = await getStakeAccounts(publicKey);
      const program = getProgram(connection, wallet);
      const isPSCU = selectedToken === "PSCU";
      
      await program.methods
        .removeLiquidity(new anchor.BN(unstakeAmount), isPSCU)
        .accounts({
          user: publicKey,
          vault: accounts.vault,
          userStakeInfo: accounts.userStakeInfo,
          userTokenAccount: isPSCU ? accounts.userPscuAccount : accounts.userUsdcAccount,
          vaultTokenAccount: isPSCU ? accounts.vaultPscuAccount : accounts.vaultUsdcAccount,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc();

      toast.success('Successfully unstaked tokens!', { id: toastId });
      setUnstakeAmount("");
      onSuccess?.();
    } catch (error) {
      console.error("Unstaking error:", error);
      toast.error(getErrorMessage(error), { id: toastId });
    } finally {
      setIsUnstaking(false);
    }
  };

  const handleClaim = async () => {
    if (!publicKey || !wallet) return;

    const toastId = toast.loading('Processing claim transaction...');
    setIsClaiming(true);
    
    try {
      const accounts = await getStakeAccounts(publicKey);
      const program = getProgram(connection, wallet);
      
      await program.methods
        .claimRewards()
        .accounts({
          user: publicKey,
          vault: accounts.vault,
          userStakeInfo: accounts.userStakeInfo,
          userPscuAccount: accounts.userPscuAccount,
          vaultPscuAccount: accounts.vaultPscuAccount,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc();

      toast.success('Successfully claimed rewards!', { id: toastId });
      onSuccess?.();
    } catch (error) {
      console.error("Claim error:", error);
      toast.error(getErrorMessage(error), { id: toastId });
    } finally {
      setIsClaiming(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium mb-4 text-gray-900 dark:text-white">Unstake Tokens</h3>
        <form onSubmit={handleUnstake} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
              Select Token
            </label>
            <select
              value={selectedToken}
              onChange={(e) => setSelectedToken(e.target.value as "PSCU" | "USDC")}
              className="w-full p-2 border rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600"
            >
              <option value="PSCU">PSCU</option>
              <option value="USDC">USDC</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
              Amount to Unstake
            </label>
            <div className="relative">
              <input
                type="number"
                value={unstakeAmount}
                onChange={(e) => setUnstakeAmount(e.target.value)}
                className="w-full p-2 border rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600"
                placeholder="Enter amount"
                required
                min="0"
                step="any"
              />
              <span className="absolute right-3 top-2 text-gray-500 dark:text-gray-400">
                {selectedToken}
              </span>
            </div>
          </div>
          <button
            type="submit"
            disabled={isUnstaking}
            className="w-full bg-red-500 text-white p-2 rounded hover:bg-red-600 disabled:opacity-50 flex items-center justify-center"
          >
            {isUnstaking ? (
              <>
                <LoadingSpinner size="sm" />
                <span className="ml-2">Processing...</span>
              </>
            ) : (
              "Unstake"
            )}
          </button>
        </form>
      </div>

      <div>
        <button
          onClick={handleClaim}
          disabled={isClaiming}
          className="w-full bg-green-500 text-white p-2 rounded hover:bg-green-600 disabled:opacity-50 flex items-center justify-center"
        >
          {isClaiming ? (
            <>
              <LoadingSpinner size="sm" />
              <span className="ml-2">Processing...</span>
            </>
          ) : (
            "Claim Rewards"
          )}
        </button>
      </div>
    </div>
  );
} 