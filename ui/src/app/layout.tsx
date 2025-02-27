import React from 'react';
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { WalletContextProvider } from "@/contexts/WalletContextProvider";
import { ToastProvider } from "@/providers/ToastProvider";
import { ThemeProvider } from "@/providers/ThemeProvider";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "HWP Staking",
  description: "Stake your tokens and earn rewards",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <WalletContextProvider>
            <main className="min-h-screen bg-gray-100 dark:bg-gray-900">
              <ToastProvider>{children}</ToastProvider>
            </main>
          </WalletContextProvider>
        </ThemeProvider>
      </body>
    </html>
  );
} 