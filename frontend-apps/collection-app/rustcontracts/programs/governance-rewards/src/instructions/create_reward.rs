use anchor_lang::prelude::*;
use crate::state::*;
use crate::errors::*;

#[derive(Accounts)]
#[instruction(reward_id: String)]
pub struct CreateReward<'info> {
    #[account(
        seeds = [b"points_config"],
        bump = points_config.bump
    )]
    pub points_config: Account<'info, PointsConfig>,
    
    #[account(
        init,
        payer = creator,
        space = Reward::MAX_SIZE,
        seeds = [b"reward", reward_id.as_bytes()],
        bump
    )]
    pub reward: Account<'info, Reward>,
    
    #[account(mut)]
    pub creator: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<CreateReward>,
    reward_id: String,
    name: String,
    description: String,
    cost: u64,
    supply: u64,
    tier_required: u8,
    expires_at: Option<i64>,
    metadata: String,
) -> Result<()> {
    let reward = &mut ctx.accounts.reward;
    let clock = Clock::get()?;

    // Validate inputs
    require!(reward_id.len() <= 50, GovernanceError::StringTooLong);
    require!(name.len() <= 100, GovernanceError::StringTooLong);
    require!(description.len() <= 500, GovernanceError::StringTooLong);
    require!(metadata.len() <= 500, GovernanceError::StringTooLong);
    require!(cost > 0, GovernanceError::InvalidPointsAmount);
    require!(supply > 0, GovernanceError::InvalidPointsAmount);
    require!(tier_required <= 4, GovernanceError::InvalidTier); // Max Diamond tier

    // Validate expiration if provided
    if let Some(exp_time) = expires_at {
        require!(
            exp_time > clock.unix_timestamp,
            GovernanceError::InvalidTimestamp
        );
    }

    // Initialize reward
    reward.id = reward_id.clone();
    reward.creator = ctx.accounts.creator.key();
    reward.name = name;
    reward.description = description;
    reward.cost = cost;
    reward.total_supply = supply;
    reward.claimed_supply = 0;
    reward.tier_required = tier_required;
    reward.is_active = true;
    reward.expires_at = expires_at;
    reward.created_at = clock.unix_timestamp;
    reward.metadata = metadata;
    reward.bump = ctx.bumps.reward;

    let tier_name = UserTier::from_u8(tier_required)
        .map(|t| t.name())
        .unwrap_or("Unknown");

    msg!("Created reward '{}' with cost {} points", reward.name, reward.cost);
    msg!("Required tier: {} | Supply: {}", tier_name, reward.total_supply);

    Ok(())
}
