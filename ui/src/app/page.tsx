'use client';

import dynamic from 'next/dynamic';
import React from 'react';
import StakingForm from '@/components/StakingForm';
import ThemeToggle from "@/components/ThemeToggle";

// WalletMultiButton'ı client-side only olarak import ediyoruz
const WalletMultiButton = dynamic(
  () => import('@solana/wallet-adapter-react-ui').then(mod => mod.WalletMultiButton),
  { ssr: false }
);

export default function Home() {
  return (
    <main className="min-h-screen p-4 md:p-8 bg-gray-100 dark:bg-gray-900">
      <div className="max-w-4xl mx-auto">
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">Eclipse Yield Surge</h1>
          <div className="flex items-center space-x-4">
            <ThemeToggle />
            <WalletMultiButton />
          </div>
        </div>
        <StakingForm />
      </div>
    </main>
  );
} 