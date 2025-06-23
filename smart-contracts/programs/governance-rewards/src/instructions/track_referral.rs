use anchor_lang::prelude::*;
use crate::state::*;
use crate::errors::*;

#[derive(Accounts)]
#[instruction(referral_code: String)]
pub struct TrackReferral<'info> {
    #[account(
        mut,
        seeds = [b"points_config"],
        bump = points_config.bump
    )]
    pub points_config: Account<'info, PointsConfig>,
    
    #[account(
        mut,
        seeds = [b"referral_code", referral_code.as_bytes()],
        bump = referral_code_account.bump
    )]
    pub referral_code_account: Account<'info, ReferralCode>,
    
    #[account(
        mut,
        seeds = [b"user_profile", referrer.key().as_ref()],
        bump = referrer_profile.bump
    )]
    pub referrer_profile: Account<'info, UserProfile>,
    
    #[account(
        init_if_needed,
        payer = referee,
        space = UserProfile::MAX_SIZE,
        seeds = [b"user_profile", referee.key().as_ref()],
        bump
    )]
    pub referee_profile: Account<'info, UserProfile>,
    
    #[account(
        init,
        payer = referee,
        space = ReferralTransaction::MAX_SIZE,
        seeds = [b"referral_tx", referee.key().as_ref(), &Clock::get()?.unix_timestamp.to_le_bytes()],
        bump
    )]
    pub referral_transaction: Account<'info, ReferralTransaction>,
    
    /// CHECK: Referrer is verified through referral code ownership
    pub referrer: UncheckedAccount<'info>,
    
    #[account(mut)]
    pub referee: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<TrackReferral>,
    referral_code: String,
    transaction_amount: u64,
    metadata: String,
) -> Result<()> {
    let points_config = &mut ctx.accounts.points_config;
    let referral_code_account = &mut ctx.accounts.referral_code_account;
    let referrer_profile = &mut ctx.accounts.referrer_profile;
    let referee_profile = &mut ctx.accounts.referee_profile;
    let referral_transaction = &mut ctx.accounts.referral_transaction;
    let clock = Clock::get()?;

    // Validate referral code
    require!(referral_code_account.is_valid(), GovernanceError::InvalidReferralCode);
    require!(
        referral_code_account.owner == ctx.accounts.referrer.key(),
        GovernanceError::Unauthorized
    );

    // Prevent self-referral
    require!(
        ctx.accounts.referrer.key() != ctx.accounts.referee.key(),
        GovernanceError::SelfReferralNotAllowed
    );

    // Validate inputs
    require!(transaction_amount > 0, GovernanceError::InvalidPointsAmount);
    require!(metadata.len() <= 200, GovernanceError::StringTooLong);

    // Initialize referee profile if new
    if referee_profile.owner == Pubkey::default() {
        referee_profile.owner = ctx.accounts.referee.key();
        referee_profile.points_balance = 0;
        referee_profile.points_earned = 0;
        referee_profile.points_spent = 0;
        referee_profile.current_tier = 0;
        referee_profile.tier_progress = 0;
        referee_profile.referral_count = 0;
        referee_profile.referral_earnings = 0;
        referee_profile.attendance_streak = 0;
        referee_profile.created_at = clock.unix_timestamp;
        referee_profile.metadata = String::new();
        referee_profile.bump = ctx.bumps.referee_profile;
        
        points_config.total_users += 1;
    }

    // Calculate commission
    let commission_amount = referral_code_account.calculate_commission(transaction_amount);

    // Update referral code stats
    referral_code_account.total_referrals = referral_code_account.total_referrals
        .checked_add(1)
        .ok_or(GovernanceError::CalculationOverflow)?;
    
    referral_code_account.total_commission = referral_code_account.total_commission
        .checked_add(commission_amount)
        .ok_or(GovernanceError::CalculationOverflow)?;

    // Update referrer profile
    referrer_profile.referral_count = referrer_profile.referral_count
        .checked_add(1)
        .ok_or(GovernanceError::CalculationOverflow)?;
    
    referrer_profile.referral_earnings = referrer_profile.referral_earnings
        .checked_add(commission_amount)
        .ok_or(GovernanceError::CalculationOverflow)?;
    
    referrer_profile.last_activity = clock.unix_timestamp;

    // Update referee profile
    referee_profile.last_activity = clock.unix_timestamp;

    // Create referral transaction record
    referral_transaction.referrer = ctx.accounts.referrer.key();
    referral_transaction.referee = ctx.accounts.referee.key();
    referral_transaction.referral_code = referral_code;
    referral_transaction.transaction_amount = transaction_amount;
    referral_transaction.commission_amount = commission_amount;
    referral_transaction.commission_paid = false;
    referral_transaction.timestamp = clock.unix_timestamp;
    referral_transaction.metadata = metadata;
    referral_transaction.bump = ctx.bumps.referral_transaction;

    // Update global stats
    points_config.updated_at = clock.unix_timestamp;

    msg!("Tracked referral: {} referred {} for ${}", 
         ctx.accounts.referrer.key(), 
         ctx.accounts.referee.key(), 
         transaction_amount);
    msg!("Commission earned: ${}", commission_amount);

    Ok(())
}
