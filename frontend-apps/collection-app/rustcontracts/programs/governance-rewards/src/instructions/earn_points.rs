use anchor_lang::prelude::*;
use crate::state::*;
use crate::errors::*;

#[derive(Accounts)]
#[instruction(user: Pubkey)]
pub struct EarnPoints<'info> {
    #[account(
        mut,
        seeds = [b"points_config"],
        bump = points_config.bump
    )]
    pub points_config: Account<'info, PointsConfig>,
    
    #[account(
        init_if_needed,
        payer = authority,
        space = UserProfile::MAX_SIZE,
        seeds = [b"user_profile", user.as_ref()],
        bump
    )]
    pub user_profile: Account<'info, UserProfile>,
    
    #[account(
        init,
        payer = authority,
        space = PointsTransaction::MAX_SIZE,
        seeds = [b"points_tx", user.as_ref(), &Clock::get()?.unix_timestamp.to_le_bytes()],
        bump
    )]
    pub transaction: Account<'info, PointsTransaction>,
    
    #[account(mut)]
    pub authority: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<EarnPoints>,
    user: Pubkey,
    amount: u64,
    reason: String,
    metadata: String,
) -> Result<()> {
    let points_config = &mut ctx.accounts.points_config;
    let user_profile = &mut ctx.accounts.user_profile;
    let transaction = &mut ctx.accounts.transaction;
    let clock = Clock::get()?;

    // Validate inputs
    require!(amount > 0, GovernanceError::InvalidPointsAmount);
    require!(reason.len() <= 100, GovernanceError::StringTooLong);
    require!(metadata.len() <= 200, GovernanceError::StringTooLong);

    // Initialize user profile if new
    if user_profile.owner == Pubkey::default() {
        user_profile.owner = user;
        user_profile.points_balance = 0;
        user_profile.points_earned = 0;
        user_profile.points_spent = 0;
        user_profile.current_tier = 0;
        user_profile.tier_progress = 0;
        user_profile.referral_count = 0;
        user_profile.referral_earnings = 0;
        user_profile.attendance_streak = 0;
        user_profile.created_at = clock.unix_timestamp;
        user_profile.metadata = String::new();
        user_profile.bump = ctx.bumps.user_profile;
        
        points_config.total_users += 1;
    }

    // Add points
    user_profile.points_balance = user_profile.points_balance
        .checked_add(amount)
        .ok_or(GovernanceError::CalculationOverflow)?;
    
    user_profile.points_earned = user_profile.points_earned
        .checked_add(amount)
        .ok_or(GovernanceError::CalculationOverflow)?;
    
    user_profile.last_activity = clock.unix_timestamp;

    // Update tier progress
    user_profile.tier_progress = user_profile.points_earned;

    // Update global stats
    points_config.total_points_issued = points_config.total_points_issued
        .checked_add(amount)
        .ok_or(GovernanceError::CalculationOverflow)?;
    
    points_config.updated_at = clock.unix_timestamp;

    // Record transaction
    transaction.user = user;
    transaction.transaction_type = TransactionType::Earned;
    transaction.amount = amount;
    transaction.balance_after = user_profile.points_balance;
    transaction.reason = reason.clone();
    transaction.metadata = metadata;
    transaction.timestamp = clock.unix_timestamp;
    transaction.bump = ctx.bumps.transaction;

    msg!("User {} earned {} points for: {}", user, amount, reason);
    msg!("New balance: {} points", user_profile.points_balance);

    Ok(())
}
