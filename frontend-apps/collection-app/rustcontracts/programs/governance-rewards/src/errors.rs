use anchor_lang::prelude::*;

#[error_code]
pub enum GovernanceError {
    #[msg("Insufficient points balance")]
    InsufficientPoints,
    
    #[msg("Invalid tier for this operation")]
    InvalidTier,
    
    #[msg("Reward not available")]
    RewardNotAvailable,
    
    #[msg("Reward already claimed")]
    RewardAlreadyClaimed,
    
    #[msg("Invalid referral code")]
    InvalidReferralCode,
    
    #[msg("Cannot refer yourself")]
    SelfReferralNotAllowed,
    
    #[msg("Referral code expired")]
    ReferralCodeExpired,
    
    #[msg("Reward expired")]
    RewardExpired,
    
    #[msg("Insufficient tier level")]
    InsufficientTier,
    
    #[msg("Invalid commission rate")]
    InvalidCommissionRate,
    
    #[msg("Unauthorized operation")]
    Unauthorized,
    
    #[msg("Invalid points amount")]
    InvalidPointsAmount,
    
    #[msg("Transfer to self not allowed")]
    SelfTransferNotAllowed,
    
    #[msg("Reward out of stock")]
    RewardOutOfStock,
    
    #[msg("Commission already paid")]
    CommissionAlreadyPaid,
    
    #[msg("Invalid reward ID")]
    InvalidRewardId,
    
    #[msg("Invalid tier thresholds")]
    InvalidTierThresholds,
    
    #[msg("Calculation overflow")]
    CalculationOverflow,
    
    #[msg("Invalid timestamp")]
    InvalidTimestamp,
    
    #[msg("String too long")]
    StringTooLong,
}
