use anchor_lang::prelude::*;
use crate::state::*;
use crate::errors::*;

#[derive(Accounts)]
#[instruction(code: String)]
pub struct CreateReferralCode<'info> {
    #[account(
        seeds = [b"points_config"],
        bump = points_config.bump
    )]
    pub points_config: Account<'info, PointsConfig>,
    
    #[account(
        mut,
        seeds = [b"user_profile", owner.key().as_ref()],
        bump = user_profile.bump
    )]
    pub user_profile: Account<'info, UserProfile>,
    
    #[account(
        init,
        payer = owner,
        space = ReferralCode::MAX_SIZE,
        seeds = [b"referral_code", code.as_bytes()],
        bump
    )]
    pub referral_code: Account<'info, ReferralCode>,
    
    #[account(mut)]
    pub owner: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<CreateReferralCode>,
    code: String,
    commission_rate: u16,
    expires_at: Option<i64>,
) -> Result<()> {
    let referral_code = &mut ctx.accounts.referral_code;
    let user_profile = &mut ctx.accounts.user_profile;
    let clock = Clock::get()?;

    // Validate inputs
    require!(code.len() >= 3 && code.len() <= 20, GovernanceError::StringTooLong);
    require!(commission_rate <= 1000, GovernanceError::InvalidCommissionRate); // Max 10%
    
    // Validate code format (alphanumeric only)
    require!(
        code.chars().all(|c| c.is_alphanumeric()),
        GovernanceError::InvalidReferralCode
    );

    // Validate expiration if provided
    if let Some(exp_time) = expires_at {
        require!(
            exp_time > clock.unix_timestamp,
            GovernanceError::InvalidTimestamp
        );
    }

    // Initialize referral code
    referral_code.owner = ctx.accounts.owner.key();
    referral_code.code = code.clone();
    referral_code.commission_rate = commission_rate;
    referral_code.total_referrals = 0;
    referral_code.total_commission = 0;
    referral_code.is_active = true;
    referral_code.expires_at = expires_at;
    referral_code.created_at = clock.unix_timestamp;
    referral_code.metadata = String::new();
    referral_code.bump = ctx.bumps.referral_code;

    // Update user profile
    user_profile.last_activity = clock.unix_timestamp;

    msg!("Created referral code '{}' with {}% commission", 
         code, commission_rate as f64 / 100.0);

    if let Some(exp) = expires_at {
        msg!("Expires at: {}", exp);
    }

    Ok(())
}
