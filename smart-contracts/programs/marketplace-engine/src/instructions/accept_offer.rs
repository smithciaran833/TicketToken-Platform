use anchor_lang::prelude::*;
use crate::state::*;

#[derive(Accounts)]
pub struct AcceptOffer<'info> {
    #[account(mut)]
    pub offer: Account<'info, Offer>,
    #[account(mut)]
    pub listing: Account<'info, Listing>,
    pub seller: Signer<'info>,
}

pub fn handler(ctx: Context<AcceptOffer>) -> Result<()> {
    // Implementation similar to buy_ticket but at offer price
    msg!("Offer accepted");
    Ok(())
}
