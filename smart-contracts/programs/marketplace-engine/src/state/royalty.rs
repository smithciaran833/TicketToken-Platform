use anchor_lang::prelude::*;

#[account]
pub struct RoyaltyConfig {
    /// The event this royalty config applies to
    pub event_mint: Pubkey,
    /// Artist wallet for royalty payments
    pub artist_wallet: Pubkey,
    /// Venue wallet for royalty payments
    pub venue_wallet: Pubkey,
    /// Platform wallet for fees
    pub platform_wallet: Pubkey,
    /// Artist royalty percentage (basis points: 1000 = 10%)
    pub artist_percentage: u16,
    /// Venue royalty percentage (basis points)
    pub venue_percentage: u16,
    /// Platform fee percentage (basis points)
    pub platform_percentage: u16,
    /// Price cap multiplier (basis points: 20000 = 200%)
    pub price_cap_multiplier: u16,
    /// Who can modify this config
    pub authority: Pubkey,
    /// When config was created
    pub created_at: i64,
    /// Bump for PDA derivation
    pub bump: u8,
}

impl RoyaltyConfig {
    pub const LEN: usize = 8 +  // discriminator
        32 +  // event_mint
        32 +  // artist_wallet
        32 +  // venue_wallet
        32 +  // platform_wallet
        2 +   // artist_percentage
        2 +   // venue_percentage
        2 +   // platform_percentage
        2 +   // price_cap_multiplier
        32 +  // authority
        8 +   // created_at
        1;    // bump
}
