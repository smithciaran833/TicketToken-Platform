use anchor_lang::prelude::*;
use crate::state::*;
use crate::errors::*;

#[derive(Accounts)]
pub struct PayoutReferrals<'info> {
    #[account(
        mut,
        seeds = [b"points_config"],
        bump = points_config.bump
    )]
    pub points_config: Account<'info, PointsConfig>,
    
    #[account(
        mut,
        seeds = [b"user_profile", referrer.key().as_ref()],
        bump = referrer_profile.bump
    )]
    pub referrer_profile: Account<'info, UserProfile>,
    
    #[account(
        init,
        payer = referrer,
        space = PointsTransaction::MAX_SIZE,
        seeds = [b"points_tx", referrer.key().as_ref(), &Clock::get()?.unix_timestamp.to_le_bytes()],
        bump
    )]
    pub payout_transaction: Account<'info, PointsTransaction>,
    
    #[account(mut)]
    pub referrer: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<PayoutReferrals>) -> Result<()> {
    let points_config = &mut ctx.accounts.points_config;
    let referrer_profile = &mut ctx.accounts.referrer_profile;
    let payout_transaction = &mut ctx.accounts.payout_transaction;
    let clock = Clock::get()?;

    // Check if there are unpaid referral earnings
    require!(
        referrer_profile.referral_earnings > 0,
        GovernanceError::InvalidPointsAmount
    );

    let payout_amount = referrer_profile.referral_earnings;

    // Convert referral earnings to points (1:1 ratio for simplicity)
    let points_to_award = payout_amount;

    // Add points to referrer's balance
    referrer_profile.points_balance = referrer_profile.points_balance
        .checked_add(points_to_award)
        .ok_or(GovernanceError::CalculationOverflow)?;
    
    referrer_profile.points_earned = referrer_profile.points_earned
        .checked_add(points_to_award)
        .ok_or(GovernanceError::CalculationOverflow)?;

    // Reset referral earnings (they've been paid out)
    referrer_profile.referral_earnings = 0;
    referrer_profile.last_activity = clock.unix_timestamp;

    // Update global stats
    points_config.total_points_issued = points_config.total_points_issued
        .checked_add(points_to_award)
        .ok_or(GovernanceError::CalculationOverflow)?;
    
    points_config.updated_at = clock.unix_timestamp;

    // Record payout transaction
    payout_transaction.user = referrer_profile.owner;
    payout_transaction.transaction_type = TransactionType::Referral;
    payout_transaction.amount = points_to_award;
    payout_transaction.balance_after = referrer_profile.points_balance;
    payout_transaction.reason = "Referral commission payout".to_string();
    payout_transaction.metadata = format!("Converted ${} earnings to {} points", payout_amount, points_to_award);
    payout_transaction.timestamp = clock.unix_timestamp;
    payout_transaction.bump = ctx.bumps.payout_transaction;

    msg!("Paid out ${} in referral earnings as {} points to {}", 
         payout_amount, points_to_award, referrer_profile.owner);
    msg!("New points balance: {}", referrer_profile.points_balance);

    Ok(())
}
