use anchor_lang::prelude::*;

use crate::state::*;
use crate::errors::*;

#[derive(Accounts)]
pub struct UpdateListing<'info> {
    #[account(
        mut,
        seeds = [b"listing", listing.ticket_mint.as_ref()],
        bump = listing.bump,
        constraint = listing.seller == seller.key() @ MarketplaceError::Unauthorized,
        constraint = listing.status == ListingStatus::Active @ MarketplaceError::ListingNotActive
    )]
    pub listing: Account<'info, Listing>,
    
    pub seller: Signer<'info>,
}

pub fn handler(
    ctx: Context<UpdateListing>,
    new_price: Option<u64>,
    expires_at: Option<i64>,
    allow_offers: Option<bool>,
) -> Result<()> {
    let listing = &mut ctx.accounts.listing;
    let clock = Clock::get()?;
    
    // Check listing hasn't expired
    if let Some(expires) = listing.expires_at {
        require!(expires > clock.unix_timestamp, MarketplaceError::ListingExpired);
    }
    
    // Update price if provided
    if let Some(price) = new_price {
        require!(price <= listing.price_cap, MarketplaceError::PriceExceedsCap);
        listing.price = price;
        msg!("Price updated to: {} SOL", price as f64 / 1_000_000_000.0);
    }
    
    // Update expiration if provided
    if let Some(expires) = expires_at {
        require!(expires > clock.unix_timestamp, MarketplaceError::ListingExpired);
        listing.expires_at = Some(expires);
    }
    
    // Update offer settings if provided
    if let Some(offers) = allow_offers {
        listing.allow_offers = offers;
    }
    
    Ok(())
}
