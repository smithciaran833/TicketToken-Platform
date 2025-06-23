use anchor_lang::prelude::*;

#[account]
pub struct Listing {
    /// The ticket NFT being sold
    pub ticket_mint: Pubkey,
    /// Who owns/is selling the ticket
    pub seller: Pubkey,
    /// Sale price in lamports (SOL)
    pub price: u64,
    /// When this listing expires (Unix timestamp)
    pub expires_at: Option<i64>,
    /// Whether to accept offers below asking price
    pub allow_offers: bool,
    /// When listing was created
    pub created_at: i64,
    /// Current status
    pub status: ListingStatus,
    /// Original ticket price (for price cap calculation)
    pub original_price: u64,
    /// Maximum resale price (set by artist/venue)
    pub price_cap: u64,
    /// Bump for PDA derivation
    pub bump: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum ListingStatus {
    Active,
    Sold,
    Cancelled,
    Expired,
}

impl Listing {
    pub const LEN: usize = 8 +  // discriminator
        32 +  // ticket_mint
        32 +  // seller
        8 +   // price
        9 +   // expires_at (Option<i64>)
        1 +   // allow_offers
        8 +   // created_at
        1 +   // status
        8 +   // original_price
        8 +   // price_cap
        1;    // bump
}
