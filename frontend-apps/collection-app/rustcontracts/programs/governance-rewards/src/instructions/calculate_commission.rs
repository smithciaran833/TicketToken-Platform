use anchor_lang::prelude::*;
use crate::state::*;
use crate::errors::*;

#[derive(Accounts)]
#[instruction(referral_code: String)]
pub struct CalculateCommission<'info> {
    #[account(
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
    
    /// CHECK: This account is validated through the referral code ownership
    pub referrer: UncheckedAccount<'info>,
}

pub fn handler(
    ctx: Context<CalculateCommission>,
    referral_code: String,
    transaction_amount: u64,
) -> Result<()> {
    let referral_code_account = &ctx.accounts.referral_code_account;
    let referrer_profile = &mut ctx.accounts.referrer_profile;

    // Validate referral code ownership
    require!(
        referral_code_account.owner == ctx.accounts.referrer.key(),
        GovernanceError::Unauthorized
    );

    // Validate referral code is active
    require!(referral_code_account.is_valid(), GovernanceError::InvalidReferralCode);

    // Calculate commission
    let commission_amount = referral_code_account.calculate_commission(transaction_amount);
    
    // Calculate tier bonus (higher tiers get bonus commission)
    let tier_bonus_multiplier = match referrer_profile.current_tier {
        0 => 1.0,    // Bronze: no bonus
        1 => 1.1,    // Silver: 10% bonus
        2 => 1.2,    // Gold: 20% bonus
        3 => 1.3,    // Platinum: 30% bonus
        4 => 1.5,    // Diamond: 50% bonus
        _ => 1.0,
    };

    let final_commission = ((commission_amount as f64) * tier_bonus_multiplier) as u64;

    msg!("Referral code: {}", referral_code);
    msg!("Transaction amount: ${}", transaction_amount);
    msg!("Base commission: ${}", commission_amount);
    msg!("Tier bonus: {}%", (tier_bonus_multiplier - 1.0) * 100.0);
    msg!("Final commission: ${}", final_commission);

    // Update referrer's last activity
    referrer_profile.last_activity = Clock::get()?.unix_timestamp;

    Ok(())
}
