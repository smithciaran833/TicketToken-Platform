use anchor_lang::prelude::*;

#[account]
pub struct Listing {
    pub ticket_mint: Pubkey,      // Which ticket is being sold
    pub seller: Pubkey,           // Who's selling it
    pub price: u64,               // Price in lamports (SOL)
    pub original_price: u64,      // Original ticket price
    pub price_cap: u64,           // Maximum resale price (anti-scalping)
    pub status: ListingStatus,    // Active/Sold/Cancelled
    pub bump: u8,                 // For PDA derivation
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum ListingStatus {
    Active,
    Sold,
    Cancelled,
}

impl Listing {
    pub const LEN: usize = 8 + 32 + 32 + 8 + 8 + 8 + 1 + 1; // ~100 bytes
}

#[account]
pub struct RoyaltyConfig {
    pub event_mint: Pubkey,           // Which event this applies to
    pub artist_wallet: Pubkey,        // Artist gets paid here
    pub venue_wallet: Pubkey,         // Venue gets paid here
    pub platform_wallet: Pubkey,     // Platform fee wallet
    pub artist_percentage: u16,       // Artist royalty % (1000 = 10%)
    pub venue_percentage: u16,        // Venue royalty % (500 = 5%)
    pub platform_percentage: u16,     // Platform fee % (100 = 1%)
    pub price_cap_multiplier: u16,    // Max resale % (20000 = 200%)
    pub bump: u8,
}

impl RoyaltyConfig {
    pub const LEN: usize = 8 + 32 + 32 + 32 + 32 + 2 + 2 + 2 + 2 + 1; // ~147 bytes
}

#[account] 
pub struct Auction {
    pub ticket_mint: Pubkey,          // Which ticket is being auctioned
    pub seller: Pubkey,               // Who's selling via auction
    pub starting_bid: u64,            // Minimum bid to start
    pub current_bid: u64,             // Current highest bid
    pub highest_bidder: Option<Pubkey>, // Current winner
    pub end_time: i64,                // When auction ends
    pub auction_type: AuctionType,    // English (bid up) or Dutch (price down)
    pub status: AuctionStatus,        // Active/Ended/Cancelled
    pub bump: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum AuctionType {
    English,  // Traditional bidding war (price goes up)
    Dutch,    // Price starts high and drops until someone buys
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum AuctionStatus {
    Active,
    Ended,
    Cancelled,
}

impl Auction {
    pub const LEN: usize = 8 + 32 + 32 + 8 + 8 + 33 + 8 + 1 + 1 + 1; // ~132 bytes
}
