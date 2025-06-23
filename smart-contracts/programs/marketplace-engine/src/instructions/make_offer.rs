use anchor_lang::prelude::*;
use crate::state::*;
use crate::errors::*;

#[derive(Accounts)]
pub struct MakeOffer<'info> {
    #[account(
        init,
        payer = buyer,
        space = Offer::LEN,
        seeds = [b"offer", listing.key().as_ref(), buyer.key().as_ref()],
        bump
    )]
    pub offer: Account<'info, Offer>,
    
    #[account(
        constraint = listing.status == ListingStatus::Active @ MarketplaceError::ListingNotActive,
        constraint = listing.allow_offers @ MarketplaceError::OffersNotAllowed
    )]
    pub listing: Account<'info, Listing>,
    
    #[account(mut)]
    pub buyer: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<MakeOffer>, amount: u64, expires_at: i64) -> Result<()> {
    let offer = &mut ctx.accounts.offer;
    let clock = Clock::get()?;
    
    require!(expires_at > clock.unix_timestamp, MarketplaceError::OfferExpired);
    require!(amount > 0, MarketplaceError::InsufficientFunds);
    
    offer.listing = ctx.accounts.listing.key();
    offer.buyer = ctx.accounts.buyer.key();
    offer.amount = amount;
    offer.expires_at = expires_at;
    offer.created_at = clock.unix_timestamp;
    offer.status = OfferStatus::Active;
    offer.bump = ctx.bumps.offer;
    
    msg!("Offer made: {} SOL", amount as f64 / 1_000_000_000.0);
    
    Ok(())
}
