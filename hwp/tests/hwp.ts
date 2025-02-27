import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Hwp } from "../target/types/hwp";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { PublicKey } from "@solana/web3.js";
import { assert } from "chai";
import { getAssociatedTokenAddress } from "@solana/spl-token";

describe("hwp", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.Hwp as Program<Hwp>;

  // Eclipse token adresleri
  const pscuMint = new PublicKey("Cpe4nvqZ9ym6C2BgnSYJ3Pbup7sGmT9HG4oGPhJcPWxh");
  const usdcMint = new PublicKey("AKEWE7Bgh87GPp171b4cJPSSZfmZwQ3KaqYqXoKLNAEE");

  let vaultPscuAccount: PublicKey;
  let vaultUsdcAccount: PublicKey;
  let userPscuAccount: PublicKey;
  let userUsdcAccount: PublicKey;
  let vault: PublicKey;
  let userStakeInfo: PublicKey;

  before(async () => {
    // Get user token accounts
    userPscuAccount = await getAssociatedTokenAddress(pscuMint, provider.wallet.publicKey);
    userUsdcAccount = await getAssociatedTokenAddress(usdcMint, provider.wallet.publicKey);

    // Get PDAs
    [vault] = await PublicKey.findProgramAddress(
      [Buffer.from("vault")],
      program.programId
    );

    [vaultPscuAccount] = await PublicKey.findProgramAddress(
      [Buffer.from("vault_pscu"), vault.toBuffer()],
      program.programId
    );

    [vaultUsdcAccount] = await PublicKey.findProgramAddress(
      [Buffer.from("vault_usdc"), vault.toBuffer()],
      program.programId
    );

    [userStakeInfo] = await PublicKey.findProgramAddress(
      [Buffer.from("user_stake"), provider.wallet.publicKey.toBuffer()],
      program.programId
    );
  });

  it("Initialize", async () => {
    await program.methods
      .initialize()
      .accounts({
        admin: provider.wallet.publicKey,
        vault,
        vaultPscuAccount,
        vaultUsdcAccount,
        pscuMint,
        usdcMint,
        systemProgram: anchor.web3.SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .rpc();

    const vaultAccount = await program.account.vault.fetch(vault);
    assert.ok(vaultAccount.pscuMint.equals(pscuMint));
    assert.ok(vaultAccount.usdcMint.equals(usdcMint));
  });

  it("Add PSCU liquidity", async () => {
    const amount = new anchor.BN(100_000_000); // 100 PSCU

    await program.methods
      .addLiquidity(amount, true)
      .accounts({
        user: provider.wallet.publicKey,
        vault,
        userStakeInfo: userStakeInfo,
        userTokenAccount: userPscuAccount,
        vaultTokenAccount: vaultPscuAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    const stakeInfo = await program.account.userStakeInfo.fetch(userStakeInfo);
    console.log("Stake info after PSCU deposit:", stakeInfo);
  });

  it("Add USDC liquidity", async () => {
    const amount = new anchor.BN(100_000); // 100 USDC

    await program.methods
      .addLiquidity(amount, false)
      .accounts({
        user: provider.wallet.publicKey,
        vault,
        userStakeInfo: userStakeInfo,
        userTokenAccount: userUsdcAccount,
        vaultTokenAccount: vaultUsdcAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    const stakeInfo = await program.account.userStakeInfo.fetch(userStakeInfo);
    console.log("Stake info after USDC deposit:", stakeInfo);
  });

  // Diğer testler eklenecek...
});
