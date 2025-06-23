use anchor_lang::prelude::*;
use crate::state::*;
use crate::errors::*;

#[derive(Accounts)]
pub struct TierUpgrade<'info> {
    #[account(
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
    
    pub user: Signer<'info>,
}

pub fn handler(ctx: Context<TierUpgrade>) -> Result<()> {
    let points_config = &ctx.accounts.points_config;
    let user_profile = &mut ctx.accounts.user_profile;
    let clock = Clock::get()?;

    // Calculate new tier based on points earned
    let new_tier = user_profile.calculate_tier(&points_config.tier_thresholds);
    
    // Check if upgrade is possible
    require!(
        user_profile.can_upgrade_tier(&points_config.tier_thresholds),
        GovernanceError::InvalidTier
    );

    let old_tier = user_profile.current_tier;
    user_profile.current_tier = new_tier;
    user_profile.last_activity = clock.unix_timestamp;

    // Get tier names for logging
    let old_tier_name = UserTier::from_u8(old_tier)
        .map(|t| t.name())
        .unwrap_or("Unknown");
    let new_tier_name = UserTier::from_u8(new_tier)
        .map(|t| t.name())
        .unwrap_or("Unknown");

    msg!("User {} upgraded from {} to {}", 
         user_profile.owner, old_tier_name, new_tier_name);

    // Log tier benefits
    if let Some(tier) = UserTier::from_u8(new_tier) {
        msg!("New tier benefits: {:?}", tier.benefits());
    }

    Ok(())
}
