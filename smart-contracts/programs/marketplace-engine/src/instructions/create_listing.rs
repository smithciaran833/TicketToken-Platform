use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

use crate::state::*;
use crate::errors::*;

#[derive(Accounts)]
pub struct CreateListing<'info> {
    #[account(
        init,
        payer = seller,
        space = Listing::LEN,
        seeds = [b"listing", ticket_mint.key().as_ref()],
        bump
    )]
    pub listing: Account<'info, Listing>,
    
    #[account(mut)]
    pub seller: Signer<'info>,
    
    /// The ticket NFT being listed
    pub ticket_mint: Account<'info, anchor_spl::token::Mint>,
    
    /// Seller's token account holding the ticket
    #[account(
        mut,
        constraint = seller_token_account.mint == ticket_mint.key(),
        constraint = seller_token_account.owner == seller.key(),
        constraint = seller_token_account.amount == 1
    )]
    pub seller_token_account: Account<'info, TokenAccount>,
    
    /// Escrow token account to hold ticket during sale
    #[account(
        init,
        payer = seller,
        token::mint = ticket_mint,
        token::authority = listing,
        seeds = [b"escrow", listing.key().as_ref()],
        bump
    )]
    pub escrow_token_account: Account<'info, TokenAccount>,
    
    /// Royalty configuration for this event
    #[account(
        seeds = [b"royalty_config", royalty_config.event_mint.as_ref()],
        bump = royalty_config.bump
    )]
    pub royalty_config: Account<'info, RoyaltyConfig>,
    
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

pub fn handler(
    ctx: Context<CreateListing>,
    price: u64,
    expires_at: Option<i64>,
    allow_offers: bool,
) -> Result<()> {
    let listing = &mut ctx.accounts.listing;
    let royalty_config = &ctx.accounts.royalty_config;
    let clock = Clock::get()?;
    
    // Calculate price cap based on original ticket price
    let original_price = 5000000000; // This should come from ticket metadata
    let price_cap = original_price
        .checked_mul(royalty_config.price_cap_multiplier as u64)
        .ok_or(MarketplaceError::ArithmeticOverflow)?
        .checked_div(10000)
        .ok_or(MarketplaceError::ArithmeticOverflow)?;
    
    // Validate price doesn't exceed cap
    require!(price <= price_cap, MarketplaceError::PriceExceedsCap);
    
    // Validate expiration is in the future (if set)
    if let Some(expires) = expires_at {
        require!(expires > clock.unix_timestamp, MarketplaceError::ListingExpired);
    }
    
    // Transfer ticket to escrow
    let cpi_accounts = Transfer {
        from: ctx.accounts.seller_token_account.to_account_info(),
        to: ctx.accounts.escrow_token_account.to_account_info(),
        authority: ctx.accounts.seller.to_account_info(),
    };
    let cpi_program = ctx.accounts.token_program.to_account_info();
    let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
    token::transfer(cpi_ctx, 1)?;
    
    // Initialize listing
    listing.ticket_mint = ctx.accounts.ticket_mint.key();
    listing.seller = ctx.accounts.seller.key();
    listing.price = price;
    listing.expires_at = expires_at;
    listing.allow_offers = allow_offers;
    listing.created_at = clock.unix_timestamp;
    listing.status = ListingStatus::Active;
    listing.original_price = original_price;
    listing.price_cap = price_cap;
    listing.bump = ctx.bumps.listing;
    
    msg!("Listing created: {} SOL", price as f64 / 1_000_000_000.0);
    
    Ok(())
}
