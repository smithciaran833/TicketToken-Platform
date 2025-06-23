use anchor_lang::prelude::*;

#[account]
#[derive(Default)]
pub struct PointsConfig {
    pub authority: Pubkey,
    pub points_per_dollar: u64,
    pub tier_thresholds: Vec<u64>, // Points required for each tier
    pub total_points_issued: u64,
    pub total_users: u64,
    pub created_at: i64,
    pub updated_at: i64,
    pub bump: u8,
}

impl PointsConfig {
    pub const MAX_SIZE: usize = 8 + // discriminator
        32 + // authority
        8 + // points_per_dollar
        4 + (8 * 10) + // tier_thresholds (max 10 tiers)
        8 + // total_points_issued
        8 + // total_users
        8 + // created_at
        8 + // updated_at
        1; // bump
}

#[account]
#[derive(Default)]
pub struct UserProfile {
    pub owner: Pubkey,
    pub points_balance: u64,
    pub points_earned: u64,
    pub points_spent: u64,
    pub current_tier: u8,
    pub tier_progress: u64,
    pub referral_count: u32,
    pub referral_earnings: u64,
    pub attendance_streak: u32,
    pub last_activity: i64,
    pub created_at: i64,
    pub metadata: String, // JSON for additional data
    pub bump: u8,
}

impl UserProfile {
    pub const MAX_SIZE: usize = 8 + // discriminator
        32 + // owner
        8 + // points_balance
        8 + // points_earned
        8 + // points_spent
        1 + // current_tier
        8 + // tier_progress
        4 + // referral_count
        8 + // referral_earnings
        4 + // attendance_streak
        8 + // last_activity
        8 + // created_at
        4 + 500 + // metadata (max 500 chars)
        1; // bump

    pub fn calculate_tier(&self, tier_thresholds: &[u64]) -> u8 {
        for (index, &threshold) in tier_thresholds.iter().enumerate() {
            if self.points_earned < threshold {
                return index as u8;
            }
        }
        tier_thresholds.len() as u8 // Max tier
    }

    pub fn can_upgrade_tier(&self, tier_thresholds: &[u64]) -> bool {
        let calculated_tier = self.calculate_tier(tier_thresholds);
        calculated_tier > self.current_tier
    }
}

#[account]
#[derive(Default)]
pub struct PointsTransaction {
    pub user: Pubkey,
    pub transaction_type: TransactionType,
    pub amount: u64,
    pub balance_after: u64,
    pub reason: String,
    pub metadata: String,
    pub timestamp: i64,
    pub bump: u8,
}

impl PointsTransaction {
    pub const MAX_SIZE: usize = 8 + // discriminator
        32 + // user
        1 + // transaction_type
        8 + // amount
        8 + // balance_after
        4 + 100 + // reason (max 100 chars)
        4 + 200 + // metadata (max 200 chars)
        8 + // timestamp
        1; // bump
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum TransactionType {
    Earned,
    Spent,
    Transferred,
    Received,
    Referral,
    Bonus,
}

impl Default for TransactionType {
    fn default() -> Self {
        TransactionType::Earned
    }
}

#[account]
#[derive(Default)]
pub struct Reward {
    pub id: String,
    pub creator: Pubkey,
    pub name: String,
    pub description: String,
    pub cost: u64,
    pub total_supply: u64,
    pub claimed_supply: u64,
    pub tier_required: u8,
    pub is_active: bool,
    pub expires_at: Option<i64>,
    pub created_at: i64,
    pub metadata: String,
    pub bump: u8,
}

impl Reward {
    pub const MAX_SIZE: usize = 8 + // discriminator
        4 + 50 + // id (max 50 chars)
        32 + // creator
        4 + 100 + // name (max 100 chars)
        4 + 500 + // description (max 500 chars)
        8 + // cost
        8 + // total_supply
        8 + // claimed_supply
        1 + // tier_required
        1 + // is_active
        1 + 8 + // expires_at (Option<i64>)
        8 + // created_at
        4 + 500 + // metadata (max 500 chars)
        1; // bump

    pub fn is_available(&self) -> bool {
        self.is_active && 
        self.claimed_supply < self.total_supply &&
        self.expires_at.map_or(true, |exp| exp > Clock::get().unwrap().unix_timestamp)
    }

    pub fn can_claim(&self, user_tier: u8) -> bool {
        self.is_available() && user_tier >= self.tier_required
    }
}

#[account]
#[derive(Default)]
pub struct RewardClaim {
    pub user: Pubkey,
    pub reward_id: String,
    pub claimed_at: i64,
    pub metadata: String,
    pub bump: u8,
}

impl RewardClaim {
    pub const MAX_SIZE: usize = 8 + // discriminator
        32 + // user
        4 + 50 + // reward_id (max 50 chars)
        8 + // claimed_at
        4 + 200 + // metadata (max 200 chars)
        1; // bump
}

#[account]
#[derive(Default)]
pub struct ReferralCode {
    pub owner: Pubkey,
    pub code: String,
    pub commission_rate: u16, // Basis points (100 = 1%)
    pub total_referrals: u32,
    pub total_commission: u64,
    pub is_active: bool,
    pub expires_at: Option<i64>,
    pub created_at: i64,
    pub metadata: String,
    pub bump: u8,
}

impl ReferralCode {
    pub const MAX_SIZE: usize = 8 + // discriminator
        32 + // owner
        4 + 20 + // code (max 20 chars)
        2 + // commission_rate
        4 + // total_referrals
        8 + // total_commission
        1 + // is_active
        1 + 8 + // expires_at (Option<i64>)
        8 + // created_at
        4 + 200 + // metadata (max 200 chars)
        1; // bump

    pub fn is_valid(&self) -> bool {
        self.is_active &&
        self.expires_at.map_or(true, |exp| exp > Clock::get().unwrap().unix_timestamp)
    }

    pub fn calculate_commission(&self, amount: u64) -> u64 {
        (amount * self.commission_rate as u64) / 10000
    }
}

#[account]
#[derive(Default)]
pub struct ReferralTransaction {
    pub referrer: Pubkey,
    pub referee: Pubkey,
    pub referral_code: String,
    pub transaction_amount: u64,
    pub commission_amount: u64,
    pub commission_paid: bool,
    pub timestamp: i64,
    pub metadata: String,
    pub bump: u8,
}

impl ReferralTransaction {
    pub const MAX_SIZE: usize = 8 + // discriminator
        32 + // referrer
        32 + // referee
        4 + 20 + // referral_code (max 20 chars)
        8 + // transaction_amount
        8 + // commission_amount
        1 + // commission_paid
        8 + // timestamp
        4 + 200 + // metadata (max 200 chars)
        1; // bump
}

// Tier definitions
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum UserTier {
    Bronze = 0,
    Silver = 1,
    Gold = 2,
    Platinum = 3,
    Diamond = 4,
}

impl UserTier {
    pub fn from_u8(value: u8) -> Option<Self> {
        match value {
            0 => Some(UserTier::Bronze),
            1 => Some(UserTier::Silver),
            2 => Some(UserTier::Gold),
            3 => Some(UserTier::Platinum),
            4 => Some(UserTier::Diamond),
            _ => None,
        }
    }

    pub fn name(&self) -> &'static str {
        match self {
            UserTier::Bronze => "Bronze",
            UserTier::Silver => "Silver",
            UserTier::Gold => "Gold",
            UserTier::Platinum => "Platinum",
            UserTier::Diamond => "Diamond",
        }
    }

    pub fn benefits(&self) -> Vec<&'static str> {
        match self {
            UserTier::Bronze => vec!["Basic rewards", "Community access"],
            UserTier::Silver => vec!["Priority support", "Early access", "5% discounts"],
            UserTier::Gold => vec!["VIP events", "Free transfers", "10% discounts"],
            UserTier::Platinum => vec!["Exclusive content", "Meet & greets", "15% discounts"],
            UserTier::Diamond => vec!["All access", "Personal concierge", "20% discounts"],
        }
    }
}
