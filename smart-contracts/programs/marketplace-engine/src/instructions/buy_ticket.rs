use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

use crate::state::*;
use crate::errors::*;

#[derive(Accounts)]
pub struct BuyTicket<'info> {
    #[account(
        mut,
        seeds = [b"listing", listing.ticket_mint.as_ref()],
        bump = listing.bump,
        constraint = listing.status == ListingStatus::Active @ MarketplaceError::ListingNotActive
    )]
    pub listing: Account<'info, Listing>,
    
    #[account(mut)]
    pub buyer: Signer<'info>,
    
    /// Seller's account to receive payment
    #[account(
        mut,
        constraint = seller.key() == listing.seller
    )]
    pub seller: SystemAccount<'info>,
    
    /// Buyer's token account to receive ticket
    #[account(
        mut,
        constraint = buyer_token_account.mint == listing.ticket_mint,
        constraint = buyer_token_account.owner == buyer.key()
    )]
    pub buyer_token_account: Account<'info, TokenAccount>,
    
    /// Escrow token account holding the ticket
    #[account(
        mut,
        seeds = [b"escrow", listing.key().as_ref()],
        bump,
        constraint = escrow_token_account.amount == 1
    )]
    pub escrow_token_account: Account<'info, TokenAccount>,
    
    /// Royalty configuration
    #[account(
        seeds = [b"royalty_config", royalty_config.event_mint.as_ref()],
        bump = royalty_config.bump
    )]
    pub royalty_config: Account<'info, RoyaltyConfig>,
    
    /// Artist wallet for royalty payment
    #[account(
        mut,
        constraint = artist_wallet.key() == royalty_config.artist_wallet
    )]
    pub artist_wallet: SystemAccount<'info>,
    
    /// Venue wallet for royalty payment
    #[account(
        mut,
        constraint = venue_wallet.key() == royalty_config.venue_wallet
    )]
    pub venue_wallet: SystemAccount<'info>,
    
    /// Platform wallet for fees
    #[account(
        mut,
        constraint = platform_wallet.key() == royalty_config.platform_wallet
    )]
    pub platform_wallet: SystemAccount<'info>,
    
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<BuyTicket>) -> Result<()> {
    let listing = &mut ctx.accounts.listing;
    let royalty_config = &ctx.accounts.royalty_config;
    let clock = Clock::get()?;
    
    // Check listing hasn't expired
    if let Some(expires) = listing.expires_at {
        require!(expires > clock.unix_timestamp, MarketplaceError::ListingExpired);
    }
    
    let total_price = listing.price;
    
    // Calculate royalty distributions
    let artist_royalty = total_price
        .checked_mul(royalty_config.artist_percentage as u64)
        .ok_or(MarketplaceError::ArithmeticOverflow)?
        .checked_div(10000)
        .ok_or(MarketplaceError::ArithmeticOverflow)?;
    
    let venue_royalty = total_price
        .checked_mul(royalty_config.venue_percentage as u64)
        .ok_or(MarketplaceError::ArithmeticOverflow)?
        .checked_div(10000)
        .ok_or(MarketplaceError::ArithmeticOverflow)?;
    
    let platform_fee = total_price
        .checked_mul(royalty_config.platform_percentage as u64)
        .ok_or(MarketplaceError::ArithmeticOverflow)?
        .checked_div(10000)
        .ok_or(MarketplaceError::ArithmeticOverflow)?;
    
    let seller_amount = total_price
        .checked_sub(artist_royalty)
        .ok_or(MarketplaceError::ArithmeticOverflow)?
        .checked_sub(venue_royalty)
        .ok_or(MarketplaceError::ArithmeticOverflow)?
        .checked_sub(platform_fee)
        .ok_or(MarketplaceError::ArithmeticOverflow)?;
    
    // Transfer payments
    // Pay seller
    anchor_lang::system_program::transfer(
        CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            anchor_lang::system_program::Transfer {
                from: ctx.accounts.buyer.to_account_info(),
                to: ctx.accounts.seller.to_account_info(),
            },
        ),
        seller_amount,
    )?;
    
    // Pay artist royalty
    if artist_royalty > 0 {
        anchor_lang::system_program::transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                anchor_lang::system_program::Transfer {
                    from: ctx.accounts.buyer.to_account_info(),
                    to: ctx.accounts.artist_wallet.to_account_info(),
                },
            ),
            artist_royalty,
        )?;
    }
    
    // Pay venue royalty
    if venue_royalty > 0 {
        anchor_lang::system_program::transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                anchor_lang::system_program::Transfer {
                    from: ctx.accounts.buyer.to_account_info(),
                    to: ctx.accounts.venue_wallet.to_account_info(),
                },
            ),
            venue_royalty,
        )?;
    }
    
    // Pay platform fee
    if platform_fee > 0 {
        anchor_lang::system_program::transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                anchor_lang::system_program::Transfer {
                    from: ctx.accounts.buyer.to_account_info(),
                    to: ctx.accounts.platform_wallet.to_account_info(),
                },
            ),
            platform_fee,
        )?;
    }
    
    // Transfer ticket to buyer
    let listing_key = listing.key();
    let seeds = &[
        b"listing",
        listing.ticket_mint.as_ref(),
        &[listing.bump],
    ];
    let signer = &[&seeds[..]];
    
    let cpi_accounts = Transfer {
        from: ctx.accounts.escrow_token_account.to_account_info(),
        to: ctx.accounts.buyer_token_account.to_account_info(),
        authority: listing.to_account_info(),
    };
    let cpi_program = ctx.accounts.token_program.to_account_info();
    let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer);
    token::transfer(cpi_ctx, 1)?;
    
    // Mark listing as sold
    listing.status = ListingStatus::Sold;
    
    msg!("Ticket sold! Artist: {} SOL, Venue: {} SOL, Platform: {} SOL, Seller: {} SOL", 
         artist_royalty as f64 / 1_000_000_000.0,
         venue_royalty as f64 / 1_000_000_000.0,
         platform_fee as f64 / 1_000_000_000.0,
         seller_amount as f64 / 1_000_000_000.0);
    
    Ok(())
}
