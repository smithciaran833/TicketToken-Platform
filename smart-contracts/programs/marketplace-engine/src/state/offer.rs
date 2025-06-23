use anchor_lang::prelude::*;

#[account]
pub struct Offer {
    /// Which listing this offer is for
    pub listing: Pubkey,
    /// Who made the offer
    pub buyer: Pubkey,
    /// Offer amount in lamports
    pub amount: u64,
    /// When offer expires
    pub expires_at: i64,
    /// When offer was made
    pub created_at: i64,
    /// Current status
    pub status: OfferStatus,
    /// Bump for PDA derivation
    pub bump: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum OfferStatus {
    Active,
    Accepted,
    Rejected,
    Cancelled,
    Expired,
    CounterOffered,
}

impl Offer {
    pub const LEN: usize = 8 +  // discriminator
        32 +  // listing
        32 +  // buyer
        8 +   // amount
        8 +   // expires_at
        8 +   // created_at
        1 +   // status
        1;    // bump
}
