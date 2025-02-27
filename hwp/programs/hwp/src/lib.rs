use anchor_lang::prelude::*;
use anchor_spl::token::{
    self,
    Token,
    TokenAccount,
    Transfer as TokenTransfer
};
use anchor_spl::associated_token::AssociatedToken;

declare_id!("78V1S4FQ256qFjNCS1wbsrDem9AjCfeZdU3cwajdq9SG");

#[program]
pub mod hwp {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        let vault = &mut ctx.accounts.vault;
        vault.admin = ctx.accounts.admin.key();
        vault.total_staked = 0;
        Ok(())
    }

    pub fn stake(ctx: Context<Stake>, amount: u64) -> Result<()> {
        // Transfer tokens from user to vault
        let cpi_accounts = TokenTransfer {
            from: ctx.accounts.user_token_account.to_account_info(),
            to: ctx.accounts.vault_token_account.to_account_info(),
            authority: ctx.accounts.user.to_account_info(),
        };
        
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
        
        token::transfer(cpi_ctx, amount)?;
        
        // Update total staked amount
        let vault = &mut ctx.accounts.vault;
        vault.total_staked = vault.total_staked.checked_add(amount).ok_or(ErrorCode::NumberOverflow)?;
        
        Ok(())
    }

    pub fn unstake(ctx: Context<Unstake>, amount: u64) -> Result<()> {
        // Check if enough tokens are staked
        let vault = &mut ctx.accounts.vault;
        if vault.total_staked < amount {
            return Err(ErrorCode::InsufficientStake.into());
        }
        
        // Transfer tokens from vault to user
        let vault_bump = ctx.bumps.vault;
        let seeds = &[
            b"vault".as_ref(),
            &[vault_bump],
        ];
        let signer = &[&seeds[..]];
        
        let cpi_accounts = TokenTransfer {
            from: ctx.accounts.vault_token_account.to_account_info(),
            to: ctx.accounts.user_token_account.to_account_info(),
            authority: vault.to_account_info(),
        };
        
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer);
        
        token::transfer(cpi_ctx, amount)?;
        
        // Update total staked amount
        vault.total_staked = vault.total_staked.checked_sub(amount).ok_or(ErrorCode::NumberOverflow)?;
        
        Ok(())
    }
}

#[account]
pub struct Vault {
    pub admin: Pubkey,
    pub total_staked: u64,
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    
    #[account(
        init,
        payer = admin,
        space = 8 + 32 + 8, // Discriminator + admin + total_staked
        seeds = [b"vault"],
        bump
    )]
    pub vault: Account<'info, Vault>,
    
    #[account(
        init,
        payer = admin,
        associated_token::mint = token_mint,
        associated_token::authority = vault,
    )]
    pub vault_token_account: Account<'info, TokenAccount>,
    
    pub token_mint: Account<'info, token::Mint>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}

#[derive(Accounts)]
pub struct Stake<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    
    #[account(mut)]
    pub vault: Account<'info, Vault>,
    
    #[account(mut)]
    pub user_token_account: Account<'info, TokenAccount>,
    
    #[account(
        mut,
        associated_token::mint = token_mint,
        associated_token::authority = vault,
    )]
    pub vault_token_account: Account<'info, TokenAccount>,
    
    pub token_mint: Account<'info, token::Mint>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct Unstake<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    
    #[account(
        mut,
        seeds = [b"vault"],
        bump
    )]
    pub vault: Account<'info, Vault>,
    
    #[account(mut)]
    pub user_token_account: Account<'info, TokenAccount>,
    
    #[account(
        mut,
        associated_token::mint = token_mint,
        associated_token::authority = vault,
    )]
    pub vault_token_account: Account<'info, TokenAccount>,
    
    pub token_mint: Account<'info, token::Mint>,
    pub token_program: Program<'info, Token>,
}

#[error_code]
pub enum ErrorCode {
    #[msg("Insufficient stake amount")]
    InsufficientStake,
    #[msg("Number overflow")]
    NumberOverflow,
}
