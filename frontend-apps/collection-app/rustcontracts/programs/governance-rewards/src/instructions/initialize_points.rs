use anchor_lang::prelude::*;
use crate::state::*;
use crate::errors::*;

#[derive(Accounts)]
pub struct InitializePoints<'info> {
    #[account(
        init,
        payer = authority,
        space = PointsConfig::MAX_SIZE,
        seeds = [b"points_config"],
        bump
    )]
    pub points_config: Account<'info, PointsConfig>,
    
    #[account(mut)]
    pub authority: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<InitializePoints>,
    authority: Pubkey,
    points_per_dollar: u64,
    tier_thresholds: Vec<u64>,
) -> Result<()> {
    let points_config = &mut ctx.accounts.points_config;
    let clock = Clock::get()?;

    // Validate tier thresholds
    require!(!tier_thresholds.is_empty(), GovernanceError::InvalidTierThresholds);
    require!(tier_thresholds.len() <= 10, GovernanceError::InvalidTierThresholds);
    
    // Ensure thresholds are in ascending order
    for i in 1..tier_thresholds.len() {
        require!(
            tier_thresholds[i] > tier_thresholds[i-1],
            GovernanceError::InvalidTierThresholds
        );
    }

    points_config.authority = authority;
    points_config.points_per_dollar = points_per_dollar;
    points_config.tier_thresholds = tier_thresholds;
    points_config.total_points_issued = 0;
    points_config.total_users = 0;
    points_config.created_at = clock.unix_timestamp;
    points_config.updated_at = clock.unix_timestamp;
    points_config.bump = ctx.bumps.points_config;

    msg!("Points system initialized with {} points per dollar", points_per_dollar);
    msg!("Tier thresholds: {:?}", points_config.tier_thresholds);

    Ok(())
}
