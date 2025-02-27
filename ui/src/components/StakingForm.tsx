'use client';

import React, { useState, FC, useEffect } from 'react';
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PSCU_MINT, USDC_MINT, PROGRAM_ID } from "@/utils/program";
import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, getAssociatedTokenAddress, createTransferInstruction, createAssociatedTokenAccountInstruction } from "@solana/spl-token";
import TokenBalance from './TokenBalance';
import { getStakeAccounts } from '@/utils/programHelper';
import { getProgram, getProvider, stake, unstake, initialize } from '../utils/program';
import * as anchor from "@coral-xyz/anchor";
import StakeInfo from './StakeInfo';
import StakeActions from './StakeActions';
import toast from 'react-hot-toast';
import { getErrorMessage } from '@/utils/errors';
import LoadingSpinner from './LoadingSpinner';
import TransactionHistory from './TransactionHistory';
import { Transaction, PublicKey, TransactionInstruction, SystemProgram } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import { AnchorProvider } from '@project-serum/anchor';
import { IDL } from '@/utils/program';

const StakingForm: FC = () => {
  const { connection } = useConnection();
  const { publicKey, signTransaction } = useWallet();
  const [amount, setAmount] = useState<string>('');
  const [unstakeAmount, setUnstakeAmount] = useState<string>('');
  const [isPscu, setIsPscu] = useState<boolean>(true);
  const [isUnstakePscu, setIsUnstakePscu] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isUnstakeLoading, setIsUnstakeLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'stake' | 'unstake'>('stake');

  const handleInitialize = async () => {
    if (!publicKey || !signTransaction) {
      toast.error("Please connect your wallet");
      return;
    }

    try {
      // Anchor provider oluştur
      const provider = new anchor.AnchorProvider(
        connection,
        {
          publicKey,
          signTransaction,
          signAllTransactions: async (txs) => {
            return await Promise.all(txs.map(tx => signTransaction(tx)));
          }
        },
        { commitment: 'confirmed' }
      );

      // Anchor program oluştur
      const program = new anchor.Program(IDL as anchor.Idl, PROGRAM_ID, provider);

      // Vault PDA'sını bul
      const [vaultPDA] = await PublicKey.findProgramAddress(
        [Buffer.from("vault")],
        PROGRAM_ID
      );

      // Initialize işlemini çağır
      const tx = await program.methods
        .initialize()
        .accounts({
          admin: publicKey,
          vault: vaultPDA,
          vaultTokenAccount: await getAssociatedTokenAddress(PSCU_MINT, vaultPDA, true),
          tokenMint: PSCU_MINT,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        })
        .rpc();

      toast.success('Initialize successful!');
    } catch (error) {
      console.error("Initialize error:", error);
      // Vault hesabı zaten oluşturulmuşsa, başarılı olarak kabul et
      if (error.toString().includes("already in use")) {
        toast.success('Program already initialized!');
      } else {
        toast.error("Failed to initialize: " + error.toString());
      }
    }
  };

  const handleStake = async () => {
    if (!publicKey || !signTransaction || !amount) {
      toast.error("Please connect your wallet and enter an amount");
      return;
    }

    try {
      setIsLoading(true);

      // Anchor provider oluştur
      const provider = new anchor.AnchorProvider(
        connection,
        {
          publicKey,
          signTransaction,
          signAllTransactions: async (txs) => {
            return await Promise.all(txs.map(tx => signTransaction(tx)));
          }
        },
        { commitment: 'confirmed' }
      );

      // Anchor program oluştur
      const program = new anchor.Program(IDL as anchor.Idl, PROGRAM_ID, provider);

      // Vault PDA'sını bul
      const [vaultPDA] = await PublicKey.findProgramAddress(
        [Buffer.from("vault")],
        PROGRAM_ID
      );

      // Kullanıcının token hesabını bul
      const userTokenAccount = await getAssociatedTokenAddress(
        isPscu ? PSCU_MINT : USDC_MINT,
        publicKey
      );

      // Vault token hesabını bul
      const vaultTokenAccount = await getAssociatedTokenAddress(
        isPscu ? PSCU_MINT : USDC_MINT,
        vaultPDA,
        true
      );

      // Vault token hesabının var olup olmadığını kontrol et
      const vaultTokenAccountInfo = await connection.getAccountInfo(vaultTokenAccount);
      
      // Eğer vault token hesabı yoksa, oluştur
      let tx;
      if (!vaultTokenAccountInfo) {
        console.log("Creating vault token account:", vaultTokenAccount.toString());
        
        // Vault token hesabını oluşturmak için bir transaction oluştur
        const createVaultTokenAccountIx = createAssociatedTokenAccountInstruction(
          publicKey,
          vaultTokenAccount,
          vaultPDA,
          isPscu ? PSCU_MINT : USDC_MINT
        );
        
        // Transaction'ı gönder
        const createTx = new Transaction().add(createVaultTokenAccountIx);
        const signature = await provider.sendAndConfirm(createTx);
        console.log("Created vault token account:", signature);
      }

      // Stake miktarını lamports'a çevir
      const amountLamports = new BN(parseFloat(amount) * 1_000_000_000);
      console.log(`Staking ${amount} ${isPscu ? 'PSCU' : 'USDC'} (${amountLamports.toString()} lamports)`);

      // Stake işlemini çağır
      tx = await program.methods
        .stake(amountLamports)
        .accounts({
          user: publicKey,
          vault: vaultPDA,
          userTokenAccount: userTokenAccount,
          vaultTokenAccount: vaultTokenAccount,
          tokenMint: isPscu ? PSCU_MINT : USDC_MINT,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      console.log(`Stake transaction: ${tx}`);
      toast.success('Liquidity added successfully!');
      setAmount("");
    } catch (error) {
      console.error("Stake error:", error);
      
      // Hata mesajını daha kullanıcı dostu hale getir
      if (error.toString().includes("insufficient funds")) {
        toast.error("Insufficient funds in your wallet");
      } else {
        toast.error("Failed to add liquidity: " + error.toString());
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleUnstake = async () => {
    if (!publicKey || !signTransaction || !unstakeAmount) {
      toast.error("Please connect your wallet and enter an amount");
      return;
    }

    try {
      setIsUnstakeLoading(true);

      // Anchor provider oluştur
      const provider = new anchor.AnchorProvider(
        connection,
        {
          publicKey,
          signTransaction,
          signAllTransactions: async (txs) => {
            return await Promise.all(txs.map(tx => signTransaction(tx)));
          }
        },
        { commitment: 'confirmed' }
      );

      // Anchor program oluştur
      const program = new anchor.Program(IDL as anchor.Idl, PROGRAM_ID, provider);

      // Vault PDA'sını bul
      const [vaultPDA] = await PublicKey.findProgramAddress(
        [Buffer.from("vault")],
        PROGRAM_ID
      );

      // Kullanıcının token hesabını bul
      const userTokenAccount = await getAssociatedTokenAddress(
        isUnstakePscu ? PSCU_MINT : USDC_MINT,
        publicKey
      );

      // Vault token hesabını bul
      const vaultTokenAccount = await getAssociatedTokenAddress(
        isUnstakePscu ? PSCU_MINT : USDC_MINT,
        vaultPDA,
        true
      );

      // Vault token hesabının var olup olmadığını kontrol et
      const vaultTokenAccountInfo = await connection.getAccountInfo(vaultTokenAccount);
      if (!vaultTokenAccountInfo) {
        toast.error("Vault token account does not exist. Please add liquidity first.");
        return;
      }

      // Unstake miktarını lamports'a çevir
      const amountLamports = new BN(parseFloat(unstakeAmount) * 1_000_000_000);
      console.log(`Unstaking ${unstakeAmount} ${isUnstakePscu ? 'PSCU' : 'USDC'} (${amountLamports.toString()} lamports)`);

      // Unstake işlemini çağır
      const tx = await program.methods
        .unstake(amountLamports)
        .accounts({
          user: publicKey,
          vault: vaultPDA,
          userTokenAccount: userTokenAccount,
          vaultTokenAccount: vaultTokenAccount,
          tokenMint: isUnstakePscu ? PSCU_MINT : USDC_MINT,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      console.log(`Unstake transaction: ${tx}`);
      toast.success('Liquidity removed successfully!');
      setUnstakeAmount("");
    } catch (error) {
      console.error("Unstake error:", error);
      
      // Hata mesajını daha kullanıcı dostu hale getir
      if (error.toString().includes("custom program error: 0x1")) {
        toast.error("Insufficient funds in vault. Please add liquidity first.");
      } else if (error.toString().includes("custom program error: 0x1770")) {
        toast.error("Insufficient liquidity amount");
      } else {
        toast.error("Failed to remove liquidity: " + error.toString());
      }
    } finally {
      setIsUnstakeLoading(false);
    }
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Your Balance</h2>
          
          {publicKey && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <TokenBalance mint={PSCU_MINT} owner={publicKey} symbol="PSCU" />
              <TokenBalance mint={USDC_MINT} owner={publicKey} symbol="USDC" />
            </div>
          )}
        </div>
      </div>
      
      <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg">
        <h2 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white">Your Liquidity</h2>
        <StakeInfo />
      </div>
      
      <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg">
        <h2 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white">Your Rewards</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {/* Pending Rewards Card */}
          <div className="bg-purple-800 p-6 rounded-xl">
            <div className="flex items-center mb-4">
              <div className="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center mr-3">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M6 10a2 2 0 11-4 0 2 2 0 014 0zM12 10a2 2 0 11-4 0 2 2 0 014 0zM16 12a2 2 0 100-4 2 2 0 000 4z" />
                </svg>
              </div>
              <span className="text-lg text-purple-100">Pending Rewards</span>
            </div>
            <div className="text-4xl font-bold text-white mb-4">0 PSCU</div>
            <button className="w-full py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors">
              Claim Rewards
            </button>
          </div>
          
          {/* Stake Duration Card */}
          <div className="bg-blue-800 p-6 rounded-xl">
            <div className="flex items-center mb-4">
              <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center mr-3">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                </svg>
              </div>
              <span className="text-lg text-blue-100">Stake Duration</span>
            </div>
            <div className="text-4xl font-bold text-white mb-4">0 Days</div>
            <div className="text-blue-100">Time since your first deposit</div>
          </div>
          
          {/* USDC Multiplier Card */}
          <div className="bg-green-800 p-6 rounded-xl">
            <div className="flex items-center mb-4">
              <div className="w-8 h-8 rounded-full bg-green-600 flex items-center justify-center mr-3">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M12 7a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0V8.414l-4.293 4.293a1 1 0 01-1.414 0L8 10.414l-4.293 4.293a1 1 0 01-1.414-1.414l5-5a1 1 0 011.414 0L11 10.586 14.586 7H12z" clipRule="evenodd" />
                </svg>
              </div>
              <span className="text-lg text-green-100">USDC Multiplier</span>
            </div>
            <div className="text-4xl font-bold text-white mb-4">100.00%</div>
            <div className="text-green-100">Increases by 1% each day</div>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* PSCU APY Card */}
          <div className="bg-amber-800 p-6 rounded-xl">
            <div className="flex items-center mb-4">
              <div className="w-8 h-8 rounded-full bg-amber-600 flex items-center justify-center mr-3">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M12 7a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0V8.414l-4.293 4.293a1 1 0 01-1.414 0L8 10.414l-4.293 4.293a1 1 0 01-1.414-1.414l5-5a1 1 0 011.414 0L11 10.586 14.586 7H12z" clipRule="evenodd" />
                </svg>
              </div>
              <span className="text-lg text-amber-100">PSCU APY</span>
            </div>
            <div className="text-4xl font-bold text-white mb-4">0.00%</div>
            <div className="text-amber-100">Fixed annual percentage yield</div>
          </div>
          
          {/* USDC APY Card */}
          <div className="bg-red-800 p-6 rounded-xl">
            <div className="flex items-center mb-4">
              <div className="w-8 h-8 rounded-full bg-red-600 flex items-center justify-center mr-3">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M12 7a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0V8.414l-4.293 4.293a1 1 0 01-1.414 0L8 10.414l-4.293 4.293a1 1 0 01-1.414-1.414l5-5a1 1 0 011.414 0L11 10.586 14.586 7H12z" clipRule="evenodd" />
                </svg>
              </div>
              <span className="text-lg text-red-100">USDC APY</span>
            </div>
            <div className="text-4xl font-bold text-white mb-4">0.00%</div>
            <div className="text-red-100">Variable APY based on pool size</div>
          </div>
        </div>
      </div>
      
      <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg">
        <h2 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white">Add / Remove Liquidity</h2>
        
        <div className="flex mb-4">
          <button
            className={`flex-1 py-2 px-4 rounded-l-lg ${
              activeTab === 'stake' 
                ? 'bg-purple-600 text-white' 
                : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
            }`}
            onClick={() => setActiveTab('stake')}
          >
            Add Liquidity
          </button>
          <button
            className={`flex-1 py-2 px-4 rounded-r-lg ${
              activeTab === 'unstake' 
                ? 'bg-purple-600 text-white' 
                : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
            }`}
            onClick={() => setActiveTab('unstake')}
          >
            Remove Liquidity
          </button>
        </div>
        
        {activeTab === 'stake' ? (
          <div className="space-y-6">
            <div>
              <label className="block text-lg font-medium text-gray-700 dark:text-gray-300 mb-2">Token Type</label>
              <div className="flex space-x-4">
                <label className="inline-flex items-center">
                  <input
                    type="radio"
                    className="form-radio h-5 w-5 text-blue-600"
                    checked={isPscu}
                    onChange={() => setIsPscu(true)}
                  />
                  <span className="ml-2 text-gray-700 dark:text-gray-300">PSCU</span>
                </label>
                <label className="inline-flex items-center">
                  <input
                    type="radio"
                    className="form-radio h-5 w-5 text-blue-600"
                    checked={!isPscu}
                    onChange={() => setIsPscu(false)}
                  />
                  <span className="ml-2 text-gray-700 dark:text-gray-300">USDC</span>
                </label>
              </div>
            </div>
            
            <div>
              <label className="block text-lg font-medium text-gray-700 dark:text-gray-300 mb-2">
                Amount to Add
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="Enter amount"
                  className="w-full p-4 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <div className="absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none">
                  <span className="text-gray-500 dark:text-gray-400">{isPscu ? 'PSCU' : 'USDC'}</span>
                </div>
              </div>
            </div>
            
            <button
              onClick={handleStake}
              disabled={!publicKey || !amount || isLoading}
              className="w-full bg-gradient-to-r from-purple-500 to-indigo-600 text-white p-4 rounded-lg font-medium hover:from-purple-600 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 flex justify-center items-center"
            >
              {isLoading ? <LoadingSpinner size="sm" /> : 'Add Liquidity'}
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            <div>
              <label className="block text-lg font-medium text-gray-700 dark:text-gray-300 mb-2">Token Type</label>
              <div className="flex space-x-4">
                <label className="inline-flex items-center">
                  <input
                    type="radio"
                    className="form-radio h-5 w-5 text-blue-600"
                    checked={isUnstakePscu}
                    onChange={() => setIsUnstakePscu(true)}
                  />
                  <span className="ml-2 text-gray-700 dark:text-gray-300">PSCU</span>
                </label>
                <label className="inline-flex items-center">
                  <input
                    type="radio"
                    className="form-radio h-5 w-5 text-blue-600"
                    checked={!isUnstakePscu}
                    onChange={() => setIsUnstakePscu(false)}
                  />
                  <span className="ml-2 text-gray-700 dark:text-gray-300">USDC</span>
                </label>
              </div>
            </div>
            
            <div>
              <label className="block text-lg font-medium text-gray-700 dark:text-gray-300 mb-2">
                Amount to Remove
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={unstakeAmount}
                  onChange={(e) => setUnstakeAmount(e.target.value)}
                  placeholder="Enter amount"
                  className="w-full p-4 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <div className="absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none">
                  <span className="text-gray-500 dark:text-gray-400">{isUnstakePscu ? 'PSCU' : 'USDC'}</span>
                </div>
              </div>
            </div>
            
            <button
              onClick={handleUnstake}
              disabled={!publicKey || !unstakeAmount || isUnstakeLoading}
              className="w-full bg-gradient-to-r from-purple-500 to-indigo-600 text-white p-4 rounded-lg font-medium hover:from-purple-600 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 flex justify-center items-center"
            >
              {isUnstakeLoading ? <LoadingSpinner size="sm" /> : 'Remove Liquidity'}
            </button>
          </div>
        )}
      </div>
      
      <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg">
        <h2 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white">Initialize Program</h2>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          Initialize the program before adding or removing liquidity. This only needs to be done once.
        </p>
        <button
          onClick={handleInitialize}
          disabled={!publicKey}
          className="w-full bg-gradient-to-r from-purple-500 to-pink-600 text-white p-4 rounded-lg font-medium hover:from-purple-600 hover:to-pink-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300"
        >
          Initialize Program
        </button>
      </div>
    </div>
  );
};

export default StakingForm;