import { Connection, PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY, TransactionInstruction, Transaction } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddress, createAssociatedTokenAccountInstruction, createTransferInstruction } from "@solana/spl-token";
import { Buffer } from 'buffer';
import { BN } from "@project-serum/anchor";
import { Program, AnchorProvider, Idl } from "@project-serum/anchor";
import { Hwp } from "../idl/hwp";
import * as anchor from "@coral-xyz/anchor";
import { WalletContextState } from "@solana/wallet-adapter-react";
import idl from "@/idl/hwp.json";

export const PROGRAM_ID = new PublicKey("78V1S4FQ256qFjNCS1wbsrDem9AjCfeZdU3cwajdq9SG");
export const PSCU_MINT = new PublicKey("Cpe4nvqZ9ym6C2BgnSYJ3Pbup7sGmT9HG4oGPhJcPWxh");
export const USDC_MINT = new PublicKey("AKEWE7Bgh87GPp171b4cJPSSZfmZwQ3KaqYqXoKLNAEE");

// Vault PDA'yı program ID kullanarak oluşturalım
const [VAULT_ADDRESS] = PublicKey.findProgramAddressSync(
  [Buffer.from("vault")],
  PROGRAM_ID
);

interface WalletAdapter {
    publicKey: PublicKey | null;
    signTransaction: <T extends Transaction>(tx: T) => Promise<T>;
    signAllTransactions: <T extends Transaction>(txs: T[]) => Promise<T[]>;
}

// Basitleştirilmiş IDL
export const IDL: Hwp = {
  "version": "0.1.0",
  "name": "hwp",
  "instructions": [
    {
      "name": "initialize",
      "accounts": [
        {
          "name": "admin",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "vault",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "vaultTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "tokenMint",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "rent",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "associatedTokenProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": []
    },
    {
      "name": "stake",
      "accounts": [
        {
          "name": "user",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "vault",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "userTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "vaultTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "tokenMint",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "unstake",
      "accounts": [
        {
          "name": "user",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "vault",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "userTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "vaultTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "tokenMint",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "vault",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "admin",
            "type": "publicKey"
          },
          {
            "name": "totalStaked",
            "type": "u64"
          }
        ]
      }
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "InsufficientStake",
      "msg": "Insufficient stake amount"
    },
    {
      "code": 6001,
      "name": "NumberOverflow",
      "msg": "Number overflow"
    }
  ]
};

export const getProvider = (connection: Connection, wallet: any) => {
  if (!wallet.publicKey) throw new Error("Wallet not connected");
  
  return new AnchorProvider(
    connection,
    wallet,
    { commitment: 'confirmed', preflightCommitment: 'confirmed' }
  );
};

export const getProgram = (connection: Connection, wallet: WalletContextState["wallet"]) => {
  if (!wallet || !wallet.adapter.publicKey) {
    throw new Error("Provider has no public key");
  }

  const provider = new anchor.AnchorProvider(
    connection,
    wallet.adapter as any,
    { commitment: "confirmed" }
  );

  return new Program(idl as any, PROGRAM_ID, provider);
};

export const initialize = async (
    provider: AnchorProvider,
    pscuMint: PublicKey,
    usdcMint: PublicKey
) => {
    if (!provider.publicKey) throw new Error("Wallet not connected");
    
    const program = getProgram(provider);
    
    try {
        const [vault] = PublicKey.findProgramAddressSync(
            [Buffer.from("vault")],
            program.programId
        );

        const [vaultUsdcAccount] = PublicKey.findProgramAddressSync(
            [Buffer.from("vault_usdc"), vault.toBuffer()],
            program.programId
        );

        const [vaultPscuAccount] = PublicKey.findProgramAddressSync(
            [Buffer.from("vault_pscu"), vault.toBuffer()],
            program.programId
        );

        await program.methods
            .initialize()
            .accounts({
                admin: provider.publicKey,
                vault,
                vaultUsdcAccount,
                vaultPscuAccount,
                pscuMint,
                usdcMint,
                tokenProgram: TOKEN_PROGRAM_ID,
                systemProgram: SystemProgram.programId,
            })
            .rpc();

    } catch (error) {
        console.error("Initialize error:", error);
        throw error;
    }
};

export const initializeVault = async (
  connection: Connection,
  wallet: any,
  pscuMint: PublicKey,
  usdcMint: PublicKey
) => {
  const provider = new AnchorProvider(
    connection,
    wallet,
    { commitment: "confirmed" }
  );

  const program = new Program(IDL as Idl, PROGRAM_ID, provider);

  const [vault] = PublicKey.findProgramAddressSync(
    [Buffer.from("vault")],
    program.programId
  );

  const tx = await program.methods
    .initialize()
    .accounts({
      admin: wallet.publicKey,
      vault,
      pscuMint,
      usdcMint,
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .rpc();

  return tx;
};

export const stake = async (
  connection: Connection,
  wallet: { publicKey: PublicKey; signTransaction: (tx: Transaction) => Promise<Transaction> },
  amount: number,
  isPscu: boolean
) => {
  if (!wallet.publicKey) throw new Error("Wallet not connected");

  try {
    const provider = new AnchorProvider(
      connection,
      wallet,
      { commitment: "confirmed" }
    );

    const program = new Program(IDL as Idl, PROGRAM_ID, provider);

    // User token hesabı
    const userTokenAccount = await getAssociatedTokenAddress(
      isPscu ? PSCU_MINT : USDC_MINT,
      wallet.publicKey
    );

    // Vault PDA'yı bul
    const [vault] = PublicKey.findProgramAddressSync(
      [Buffer.from("vault")],
      program.programId
    );

    // Vault token hesabını bul
    const [vaultTokenAccount] = PublicKey.findProgramAddressSync(
      [Buffer.from(isPscu ? "vault_pscu" : "vault_usdc"), vault.toBuffer()],
      program.programId
    );

    // Stake instruction'ı çağır
    const tx = await program.methods
      .stake(new BN(amount))
      .accounts({
        user: wallet.publicKey,
        vault,
        userTokenAccount,
        vaultTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();

    await connection.confirmTransaction(tx);
    return tx;
  } catch (error) {
    console.error("Stake error:", error);
    throw error;
  }
};

export const unstake = async (connection: Connection, wallet: any, amount: number, isPscu: boolean) => {
  if (!wallet.publicKey) throw new Error("Wallet not connected");

  try {
    // Get token accounts
    const userTokenAccount = await getAssociatedTokenAddress(
      isPscu ? PSCU_MINT : USDC_MINT,
      wallet.publicKey
    );

    const [vaultTokenAccount] = PublicKey.findProgramAddressSync(
      [Buffer.from(isPscu ? "vault_pscu" : "vault_usdc"), VAULT_ADDRESS.toBuffer()],
      PROGRAM_ID
    );

    // Create transaction
    const tx = new Transaction().add(
      createTransferInstruction(
        vaultTokenAccount,
        userTokenAccount,
        wallet.publicKey,
        amount
      )
    );

    // Get latest blockhash
    const { blockhash } = await connection.getLatestBlockhash();
    tx.recentBlockhash = blockhash;
    tx.feePayer = wallet.publicKey;

    // Sign and send
    const signed = await wallet.signTransaction(tx);
    const signature = await connection.sendRawTransaction(signed.serialize());
    await connection.confirmTransaction(signature);

    return signature;
  } catch (error) {
    console.error("Unstake error:", error);
    throw error;
  }
};

// Calculate ATA (Associated Token Account)
export async function getRecipientATA(recipient: string) {
  if (!recipient) throw new Error("Recipient address is required");
  
  return await getAssociatedTokenAddress(
    USDC_MINT,
    new PublicKey(recipient)
  );
}

export async function claimRewards(
  connection: Connection,
  wallet: any
) {
  if (!wallet.publicKey) throw new Error("Wallet not connected");

  try {
    const program = getProgram(wallet as AnchorProvider);

    // PDAs create
    const [vault] = await PublicKey.findProgramAddress(
      [Buffer.from("vault")],
      program.programId
    );

    const [userStakeInfo] = await PublicKey.findProgramAddress(
      [Buffer.from("user_stake"), wallet.publicKey.toBuffer()],
      program.programId
    );

    // PSCU token account
    const userPscuAccount = await getAssociatedTokenAddress(
      PSCU_MINT,
      wallet.publicKey
    );

    const [vaultPscuAccount] = await PublicKey.findProgramAddress(
      [Buffer.from("vault_pscu"), vault.toBuffer()],
      program.programId
    );

    const tx = await program.methods
      .claimRewards()
      .accounts({
        user: wallet.publicKey,
        vault,
        userStakeInfo,
        userPscuAccount,
        vaultPscuAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
        pscuMint: PSCU_MINT,
      })
      .rpc();

    return tx;
  } catch (error) {
    console.error("Claim rewards error:", error);
    throw error;
  }
}

export async function transferTokens(
  connection: Connection,
  wallet: any,
  amount: number,
  fromMint: PublicKey,
  toAddress: PublicKey
) {
  if (!wallet.publicKey) throw new Error("Wallet not connected");

  const fromATA = await getAssociatedTokenAddress(fromMint, wallet.publicKey);
  const toATA = await getAssociatedTokenAddress(fromMint, toAddress);

  const tx = new Transaction().add(
    createTransferInstruction(
      fromATA,
      toATA,
      wallet.publicKey,
      amount
    )
  );

  const { blockhash } = await connection.getLatestBlockhash();
  tx.recentBlockhash = blockhash;
  tx.feePayer = wallet.publicKey;

  const signed = await wallet.signTransaction(tx);
  const signature = await connection.sendRawTransaction(signed.serialize());
  await connection.confirmTransaction(signature);

  return signature;
} 