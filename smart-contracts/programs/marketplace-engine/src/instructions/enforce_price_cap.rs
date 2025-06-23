use anchor_lang::prelude::*;
use crate::state::*;
use crate::errors::*;

#[derive(Accounts)]
pub struct EnforcePriceCap<'info> {
    pub listing: Account<'info, Listing>,
}

pub fn handler(ctx: Context<EnforcePriceCap>) -> Result<()> {
    let listing = &ctx.accounts.listing;
    require!(listing.price <= listing.price_cap, MarketplaceError::PriceExceedsCap);
    Ok(())
}
