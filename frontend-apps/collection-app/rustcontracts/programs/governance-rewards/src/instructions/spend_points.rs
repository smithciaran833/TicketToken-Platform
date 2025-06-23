use anchor_lang::prelude::*;
use crate::state::*;
use crate::errors::*;

#[derive(Accounts)]
pub struct SpendPoints<'info> {
    #[account(
        mut,
        seeds = [b"points_config"],
        bump = points_config.bump
    )]
    pub points_config: Account<'info, PointsConfig>,
    
    #[account(
        mut,
        seeds = [b"user_profile", user.key().as_ref()],
        bump = user_profile.bump
    )]
    pub user_profile: Account<'info, UserProfile>,
    
    #[account(
        init,
        payer = user,
        space = PointsTransaction::MAX_SIZE,
        seeds = [b"points_tx", user.key().as_ref(), &Clock::get()?.unix_timestamp.to_le_bytes()],
        bump
    )]
    pub transaction: Account<'info, PointsTransaction>,
    
    #[account(mut)]
    pub user: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<SpendPoints>,
    amount: u64,
    reward_id: String,
    metadata: String,
) -> Result<()> {
    let points_config = &mut ctx.accounts.points_config;
    let user_profile = &mut ctx.accounts.user_profile;
    let transaction = &mut ctx.accounts.transaction;
    let clock = Clock::get()?;

    // Validate inputs
    require!(amount > 0, GovernanceError::InvalidPointsAmount);
    require!(reward_id.len() <= 50, GovernanceError::StringTooLong);
    require!(metadata.len() <= 200, GovernanceError::StringTooLong);

    // Check sufficient balance
    require!(
        user_profile.points_balance >= amount,
        GovernanceError::InsufficientPoints
    );

    // Deduct points
    user_profile.points_balance = user_profile.points_balance
        .checked_sub(amount)
        .ok_or(GovernanceError::CalculationOverflow)?;
    
    user_profile.points_spent = user_profile.points_spent
        .checked_add(amount)
        .ok_or(GovernanceError::CalculationOverflow)?;
    
    user_profile.last_activity = clock.unix_timestamp;

    // Update global stats
    points_config.updated_at = clock.unix_timestamp;

    // Record transaction
    transaction.user = user_profile.owner;
    transaction.transaction_type = TransactionType::Spent;
    transaction.amount = amount;
    transaction.balance_after = user_profile.points_balance;
    transaction.reason = format!("Reward: {}", reward_id);
    transaction.metadata = metadata;
    transaction.timestamp = clock.unix_timestamp;
    transaction.bump = ctx.bumps.transaction;

    msg!("User {} spent {} points on reward: {}", user_profile.owner, amount, reward_id);
    msg!("Remaining balance: {} points", user_profile.points_balance);

    Ok(())
}
