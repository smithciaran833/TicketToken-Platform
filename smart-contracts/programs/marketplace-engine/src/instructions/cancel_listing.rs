use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

use crate::state::*;
use crate::errors::*;

#[derive(Accounts)]
pub struct CancelListing<'info> {
    #[account(
        mut,
        seeds = [b"listing", listing.ticket_mint.as_ref()],
        bump = listing.bump,
        constraint = listing.seller == seller.key() @ MarketplaceError::Unauthorized,
        constraint = listing.status == ListingStatus::Active @ MarketplaceError::ListingNotActive
    )]
    pub listing: Account<'info, Listing>,
    
    #[account(mut)]
    pub seller: Signer<'info>,
    
    /// Seller's token account to receive ticket back
    #[account(
        mut,
        constraint = seller_token_account.mint == listing.ticket_mint,
        constraint = seller_token_account.owner == seller.key()
    )]
    pub seller_token_account: Account<'info, TokenAccount>,
    
    /// Escrow token account holding the ticket
    #[account(
        mut,
        seeds = [b"escrow", listing.key().as_ref()],
        bump,
        constraint = escrow_token_account.amount == 1
    )]
    pub escrow_token_account: Account<'info, TokenAccount>,
    
    pub token_program: Program<'info, Token>,
}

pub fn handler(ctx: Context<CancelListing>) -> Result<()> {
    let listing = &mut ctx.accounts.listing;
    
    // Transfer ticket back to seller
    let listing_key = listing.key();
    let seeds = &[
        b"listing",
        listing.ticket_mint.as_ref(),
        &[listing.bump],
    ];
    let signer = &[&seeds[..]];
    
    let cpi_accounts = Transfer {
        from: ctx.accounts.escrow_token_account.to_account_info(),
        to: ctx.accounts.seller_token_account.to_account_info(),
        authority: listing.to_account_info(),
    };
    let cpi_program = ctx.accounts.token_program.to_account_info();
    let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer);
    token::transfer(cpi_ctx, 1)?;
    
    // Mark as cancelled
    listing.status = ListingStatus::Cancelled;
    
    msg!("Listing cancelled and ticket returned to seller");
    
    Ok(())
}
