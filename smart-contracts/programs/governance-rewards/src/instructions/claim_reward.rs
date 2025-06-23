use anchor_lang::prelude::*;
use crate::state::*;
use crate::errors::*;

#[derive(Accounts)]
#[instruction(reward_id: String)]
pub struct ClaimReward<'info> {
    #[account(
        mut,
        seeds = [b"points_config"],
        bump = points_config.bump
    )]
    pub points_config: Account<'info, PointsConfig>,
    
    #[account(
        mut,
        seeds = [b"reward", reward_id.as_bytes()],
        bump = reward.bump
    )]
    pub reward: Account<'info, Reward>,
    
    #[account(
        mut,
        seeds = [b"user_profile", user.key().as_ref()],
        bump = user_profile.bump
    )]
    pub user_profile: Account<'info, UserProfile>,
    
    #[account(
        init,
        payer = user,
        space = RewardClaim::MAX_SIZE,
        seeds = [b"reward_claim", user.key().as_ref(), reward_id.as_bytes()],
        bump
    )]
    pub reward_claim: Account<'info, RewardClaim>,
    
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
    ctx: Context<ClaimReward>,
    reward_id: String,
) -> Result<()> {
    let points_config = &mut ctx.accounts.points_config;
    let reward = &mut ctx.accounts.reward;
    let user_profile = &mut ctx.accounts.user_profile;
    let reward_claim = &mut ctx.accounts.reward_claim;
    let transaction = &mut ctx.accounts.transaction;
    let clock = Clock::get()?;

    // Validate reward is available
    require!(reward.is_available(), GovernanceError::RewardNotAvailable);
    
    // Check user can claim (tier requirement)
    require!(
        reward.can_claim(user_profile.current_tier),
        GovernanceError::InsufficientTier
    );

    // Check sufficient points
    require!(
        user_profile.points_balance >= reward.cost,
        GovernanceError::InsufficientPoints
    );

    // Check not already claimed
    require!(
        reward_claim.user == Pubkey::default(),
        GovernanceError::RewardAlreadyClaimed
    );

    // Deduct points from user
    user_profile.points_balance = user_profile.points_balance
        .checked_sub(reward.cost)
        .ok_or(GovernanceError::CalculationOverflow)?;
    
    user_profile.points_spent = user_profile.points_spent
        .checked_add(reward.cost)
        .ok_or(GovernanceError::CalculationOverflow)?;
    
    user_profile.last_activity = clock.unix_timestamp;

    // Update reward supply
    reward.claimed_supply = reward.claimed_supply
        .checked_add(1)
        .ok_or(GovernanceError::CalculationOverflow)?;

    // Create reward claim record
    reward_claim.user = user_profile.owner;
    reward_claim.reward_id = reward_id.clone();
    reward_claim.claimed_at = clock.unix_timestamp;
    reward_claim.metadata = format!("Claimed: {}", reward.name);
    reward_claim.bump = ctx.bumps.reward_claim;

    // Record transaction
    transaction.user = user_profile.owner;
    transaction.transaction_type = TransactionType::Spent;
    transaction.amount = reward.cost;
    transaction.balance_after = user_profile.points_balance;
    transaction.reason = format!("Claimed reward: {}", reward.name);
    transaction.metadata = format!("Reward ID: {}", reward_id);
    transaction.timestamp = clock.unix_timestamp;
    transaction.bump = ctx.bumps.transaction;

    // Update global stats
    points_config.updated_at = clock.unix_timestamp;

    msg!("User {} claimed reward '{}' for {} points", 
         user_profile.owner, reward.name, reward.cost);
    msg!("Remaining supply: {}", reward.total_supply - reward.claimed_supply);

    Ok(())
}
