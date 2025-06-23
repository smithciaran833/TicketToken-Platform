use anchor_lang::prelude::*;

pub mod instructions;
pub mod state;
pub mod errors;

use instructions::*;

declare_id!("Gov1111111111111111111111111111111111111111");

#[program]
pub mod governance_rewards {
    use super::*;

    // System initialization
    pub fn initialize_points(
        ctx: Context<InitializePoints>,
        authority: Pubkey,
        points_per_dollar: u64,
        tier_thresholds: Vec<u64>,
    ) -> Result<()> {
        instructions::initialize_points::handler(ctx, authority, points_per_dollar, tier_thresholds)
    }

    // Points management
    pub fn earn_points(
        ctx: Context<EarnPoints>,
        user: Pubkey,
        amount: u64,
        reason: String,
        metadata: String,
    ) -> Result<()> {
        instructions::earn_points::handler(ctx, user, amount, reason, metadata)
    }

    pub fn spend_points(
        ctx: Context<SpendPoints>,
        amount: u64,
        reward_id: String,
        metadata: String,
    ) -> Result<()> {
        instructions::spend_points::handler(ctx, amount, reward_id, metadata)
    }

    pub fn transfer_points(
        ctx: Context<TransferPoints>,
        recipient: Pubkey,
        amount: u64,
        message: String,
    ) -> Result<()> {
        instructions::transfer_points::handler(ctx, recipient, amount, message)
    }

    // Tier management
    pub fn tier_upgrade(ctx: Context<TierUpgrade>) -> Result<()> {
        instructions::tier_upgrade::handler(ctx)
    }

    // Rewards management
    pub fn create_reward(
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
        instructions::create_reward::handler(
            ctx, reward_id, name, description, cost, supply, tier_required, expires_at, metadata
        )
    }

    pub fn claim_reward(
        ctx: Context<ClaimReward>,
        reward_id: String,
    ) -> Result<()> {
        instructions::claim_reward::handler(ctx, reward_id)
    }

    // Referral system
    pub fn create_referral_code(
        ctx: Context<CreateReferralCode>,
        code: String,
        commission_rate: u16,
        expires_at: Option<i64>,
    ) -> Result<()> {
        instructions::create_referral_code::handler(ctx, code, commission_rate, expires_at)
    }

    pub fn track_referral(
        ctx: Context<TrackReferral>,
        referral_code: String,
        transaction_amount: u64,
        metadata: String,
    ) -> Result<()> {
        instructions::track_referral::handler(ctx, referral_code, transaction_amount, metadata)
    }

    pub fn calculate_commission(
        ctx: Context<CalculateCommission>,
        referral_code: String,
        transaction_amount: u64,
    ) -> Result<()> {
        instructions::calculate_commission::handler(ctx, referral_code, transaction_amount)
    }

    pub fn payout_referrals(ctx: Context<PayoutReferrals>) -> Result<()> {
        instructions::payout_referrals::handler(ctx)
    }
}
