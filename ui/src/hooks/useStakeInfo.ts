import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useState, useEffect } from "react";
import { USDC_MINT } from "@/utils/program";
import { getAssociatedTokenAddress } from "@solana/spl-token";

export function useStakeInfo() {
    const { connection } = useConnection();
    const { publicKey } = useWallet();
    const [stakedAmount, setStakedAmount] = useState(0);

    async function fetchStakeInfo() {
        if (!publicKey) return;

        try {
            const userUsdcAccount = await getAssociatedTokenAddress(
                USDC_MINT,
                publicKey
            );

            const balance = await connection.getTokenAccountBalance(userUsdcAccount);
            setStakedAmount(balance.value.uiAmount || 0);

        } catch (error) {
            console.error("Error fetching stake info:", error);
        }
    }

    useEffect(() => {
        fetchStakeInfo();
        const interval = setInterval(fetchStakeInfo, 1000);
        return () => clearInterval(interval);
    }, [publicKey]);

    return { stakedAmount };
} 