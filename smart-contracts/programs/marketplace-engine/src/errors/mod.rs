use anchor_lang::prelude::*;

#[error_code]
pub enum MarketplaceError {
    #[msg("Price exceeds maximum allowed by price cap")]
    PriceExceedsCap,
    #[msg("Listing is not active")]
    ListingNotActive,
    #[msg("Insufficient funds for purchase")]
    InsufficientFunds,
    #[msg("Arithmetic overflow")]
    ArithmeticOverflow,
}
