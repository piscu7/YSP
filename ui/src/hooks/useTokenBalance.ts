import { useEffect, useState } from 'react';
import { useConnection } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddress, getAccount } from '@solana/spl-token';

export function useTokenBalance(
  tokenMint: PublicKey | null,
  ownerPublicKey: PublicKey | null
) {
  const { connection } = useConnection();
  const [balance, setBalance] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const fetchBalance = async () => {
      if (!tokenMint || !ownerPublicKey) {
        setBalance(null);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const ata = await getAssociatedTokenAddress(tokenMint, ownerPublicKey);
        const account = await getAccount(connection, ata);
        
        if (isMounted) {
          setBalance(Number(account.amount));
        }
      } catch (err) {
        if (isMounted) {
          setError('Failed to fetch balance');
          setBalance(null);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    fetchBalance();

    return () => {
      isMounted = false;
    };
  }, [connection, tokenMint, ownerPublicKey]);

  return { balance, isLoading, error };
} 