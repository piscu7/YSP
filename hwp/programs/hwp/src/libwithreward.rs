use anchor_lang::prelude::*;
use anchor_spl::token::{
    self,
    Token,
    TokenAccount,
    Transfer as TokenTransfer
};
use anchor_spl::associated_token::AssociatedToken;
use std::ops::Div;

// Constants for token mint addresses
pub const PSCU_MINT: Pubkey = pubkey!("Cpe4nvqZ9ym6C2BgnSYJ3Pbup7sGmT9HG4oGPhJcPWxh");
pub const USDC_MINT: Pubkey = pubkey!("AKEWE7Bgh87GPp171b4cJPSSZfmZwQ3KaqYqXoKLNAEE");

declare_id!("78V1S4FQ256qFjNCS1wbsrDem9AjCfeZdU3cwajdq9SG");

#[program]
pub mod hwp {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>, daily_reward: u64) -> Result<()> {
        let vault = &mut ctx.accounts.vault;
        vault.authority = ctx.accounts.user.key();
        vault.pscu_mint = PSCU_MINT;
        vault.usdc_mint = USDC_MINT;

        let reward_pool = &mut ctx.accounts.reward_pool;
        reward_pool.authority = ctx.accounts.user.key();
        reward_pool.daily_reward = daily_reward;
        reward_pool.last_update_time = Clock::get()?.unix_timestamp;
        reward_pool.total_staked = 0;
        reward_pool.total_rewards_claimed = 0;

        Ok(())
    }

    pub fn stake_tokens(ctx: Context<StakeTokens>, amount: u64, is_pscu: bool) -> Result<()> {
        let user_stake_info = &mut ctx.accounts.user_stake_info;
        
        // If staking for the first time, set user information
        if user_stake_info.owner == Pubkey::default() {
            user_stake_info.owner = ctx.accounts.user.key();
            user_stake_info.pscu_staked = 0;
            user_stake_info.usdc_staked = 0;
            user_stake_info.last_update_time = Clock::get()?.unix_timestamp;
            user_stake_info.reward_debt = 0;
        } else {
            // Calculate current rewards
            let current_time = Clock::get()?.unix_timestamp;
            let days_passed = ((current_time - user_stake_info.last_update_time) / 86400) as u64;
            
            if days_passed > 0 {
                // Calculate PSCU rewards
                let pscu_daily_rate = ctx.accounts.reward_pool.daily_reward as f64 / 365.0;
                let pscu_reward = (user_stake_info.pscu_staked as f64 * pscu_daily_rate * days_passed as f64) as u64;
                
                // Calculate weighted USDC amount (using a fixed 1.0 instead of usdc_multiplier)
                let weighted_usdc = user_stake_info.usdc_staked;
                
                // Calculate total PSCU rewards
                let total_pscu_reward = (ctx.accounts.reward_pool.total_staked as f64 * pscu_daily_rate * days_passed as f64) as u64;
                
                // USDC portion of the reward pool
                let usdc_pool_reward = ctx.accounts.reward_pool.daily_reward.saturating_mul(days_passed).saturating_sub(total_pscu_reward);
                
                // Calculate the user's USDC reward
                let usdc_reward = if ctx.accounts.reward_pool.total_staked > 0 {
                    (weighted_usdc as u128)
                        .checked_mul(usdc_pool_reward as u128)
                        .unwrap_or(0)
                        .checked_div(ctx.accounts.reward_pool.total_staked as u128)
                        .unwrap_or(0) as u64
                } else {
                    0
                };
                
                // Calculate and accumulate the total reward
                let total_reward = pscu_reward.saturating_add(usdc_reward);
                user_stake_info.reward_debt = user_stake_info.reward_debt.saturating_add(total_reward);
                
                // Update the last reward time
                user_stake_info.last_update_time = current_time;
            }
        }
        
        // Update token amounts
        if is_pscu {
            user_stake_info.pscu_staked = user_stake_info.pscu_staked.checked_add(amount).unwrap();
            
            // Update total PSCU staked amount
            ctx.accounts.reward_pool.total_staked = ctx.accounts.reward_pool.total_staked.checked_add(amount).unwrap();
        } else {
            user_stake_info.usdc_staked = user_stake_info.usdc_staked.checked_add(amount).unwrap();
            
            // Calculate weighted USDC and update total weighted USDC
            let weighted_usdc = amount;
            ctx.accounts.reward_pool.total_staked = ctx.accounts.reward_pool.total_staked.checked_add(weighted_usdc).unwrap();
        }
        
        // Perform token transfer
        let cpi_accounts = TokenTransfer {
            from: ctx.accounts.user_token_account.to_account_info(),
            to: ctx.accounts.vault_token_account.to_account_info(),
            authority: ctx.accounts.user.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
        token::transfer(cpi_ctx, amount)?;
        
        Ok(())
    }

    pub fn claim_rewards(ctx: Context<ClaimRewards>) -> Result<()> {
        let user_stake_info = &mut ctx.accounts.user_stake_info;
        let reward_pool = &mut ctx.accounts.reward_pool;
        
        // Calculate rewards
        let current_time = Clock::get()?.unix_timestamp;
        let time_since_last_update = current_time.checked_sub(user_stake_info.last_update_time).unwrap() as u64;
        
        // Calculate rewards based on staked amounts and time
        let pscu_rewards = user_stake_info.pscu_staked
            .checked_mul(reward_pool.daily_reward)
            .unwrap()
            .checked_mul(time_since_last_update)
            .unwrap()
            .checked_div(86400) // Seconds in a day
            .unwrap();
        
        let usdc_rewards = user_stake_info.usdc_staked
            .checked_mul(reward_pool.daily_reward)
            .unwrap()
            .checked_mul(time_since_last_update)
            .unwrap()
            .checked_div(86400) // Seconds in a day
            .unwrap();
        
        let total_rewards = pscu_rewards.checked_add(usdc_rewards).unwrap();
        
        // Transfer rewards from vault to user
        let seeds = &[b"vault".as_ref(), &[ctx.bumps.vault]];
        let signer = &[&seeds[..]];
        
        let cpi_accounts = TokenTransfer {
            from: ctx.accounts.vault_pscu_account.to_account_info(),
            to: ctx.accounts.user_pscu_account.to_account_info(),
            authority: ctx.accounts.vault.to_account_info(),
        };
        
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer);
        
        token::transfer(cpi_ctx, total_rewards)?;
        
        // Update user stake info and reward pool
        user_stake_info.last_update_time = current_time;
        reward_pool.total_rewards_claimed = reward_pool.total_rewards_claimed.checked_add(total_rewards).unwrap();
        
        Ok(())
    }
}
