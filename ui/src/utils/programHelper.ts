import * as anchor from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import { PROGRAM_ID, PSCU_MINT, USDC_MINT } from "./program";
import { getAssociatedTokenAddress } from "@solana/spl-token";

export async function findVaultPDA() {
  const [vault] = await PublicKey.findProgramAddress(
    [Buffer.from("vault")],
    PROGRAM_ID
  );
  return vault;
}

export async function findVaultTokenPDA(vault: PublicKey, isPSCU: boolean) {
  const [vaultToken] = await PublicKey.findProgramAddress(
    [Buffer.from(isPSCU ? "vault_pscu" : "vault_usdc"), vault.toBuffer()],
    PROGRAM_ID
  );
  return vaultToken;
}

export async function findUserStakeInfoPDA(userPublicKey: PublicKey) {
  const [userStakeInfo] = await PublicKey.findProgramAddress(
    [Buffer.from("user_stake"), userPublicKey.toBuffer()],
    PROGRAM_ID
  );
  return userStakeInfo;
}

export async function getStakeAccounts(userPublicKey: PublicKey) {
  const vault = await findVaultPDA();
  const vaultPscuAccount = await findVaultTokenPDA(vault, true);
  const vaultUsdcAccount = await findVaultTokenPDA(vault, false);
  const userStakeInfo = await findUserStakeInfoPDA(userPublicKey);
  const userPscuAccount = await getAssociatedTokenAddress(PSCU_MINT, userPublicKey);
  const userUsdcAccount = await getAssociatedTokenAddress(USDC_MINT, userPublicKey);

  return {
    vault,
    vaultPscuAccount,
    vaultUsdcAccount,
    userStakeInfo,
    userPscuAccount,
    userUsdcAccount
  };
} 