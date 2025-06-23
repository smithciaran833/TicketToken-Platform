use anchor_lang::prelude::*;

declare_id!("4MangoMjqJ2firMokCjjGgoTQjRNMjLi1KN1dj7iGKvK");

pub mod state;
pub mod errors;

use state::*;
use errors::*;

#[program]
pub mod marketplace_engine {
    use super::*;

    pub fn create_listing(
        ctx: Context<CreateListing>,
        price: u64,
        _expires_at: Option<i64>,
        _allow_offers: bool,
    ) -> Result<()> {
        let listing = &mut ctx.accounts.listing;
        
        listing.ticket_mint = ctx.accounts.ticket_mint.key();
        listing.seller = ctx.accounts.seller.key();
        listing.price = price;
        listing.original_price = 5_000_000_000; // 5 SOL original price
        listing.price_cap = listing.original_price * 2; // 200% price cap
        listing.status = ListingStatus::Active;
        listing.bump = ctx.bumps.listing;
        
        msg!("🎫 Listing created for {} SOL", price as f64 / 1_000_000_000.0);
        Ok(())
    }

    pub fn buy_ticket(ctx: Context<BuyTicket>) -> Result<()> {
        let listing = &mut ctx.accounts.listing;
        let royalty_config = &ctx.accounts.royalty_config;
        
        // Validate listing is active
        require!(listing.status == ListingStatus::Active, MarketplaceError::ListingNotActive);
        
        let total_price = listing.price;
        
        // Calculate royalty distributions (using basis points: 1000 = 10%)
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
        
        // Pay everyone instantly
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
        
        // Pay artist royalty (REVOLUTIONARY!)
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
        
        // Mark as sold
        listing.status = ListingStatus::Sold;
        
        msg!("🎉 REVOLUTIONARY SALE! Artist: {} SOL, Venue: {} SOL, Seller: {} SOL", 
             artist_royalty as f64 / 1_000_000_000.0,
             venue_royalty as f64 / 1_000_000_000.0,
             seller_amount as f64 / 1_000_000_000.0);
        
        Ok(())
    }

    /// Start an auction for a ticket
    pub fn create_auction(
        ctx: Context<CreateAuction>,
        starting_bid: u64,
        duration_hours: u64,
        auction_type: AuctionType,
    ) -> Result<()> {
        let auction = &mut ctx.accounts.auction;
        let clock = Clock::get()?;
        
        auction.ticket_mint = ctx.accounts.ticket_mint.key();
        auction.seller = ctx.accounts.seller.key();
        auction.starting_bid = starting_bid;
        auction.current_bid = starting_bid;
        auction.highest_bidder = None;
        auction.end_time = clock.unix_timestamp + (duration_hours as i64 * 3600);
        auction.auction_type = auction_type.clone();
        auction.status = AuctionStatus::Active;
        auction.bump = ctx.bumps.auction;
        
        match auction_type {
            AuctionType::English => {
                msg!("🔥 English auction started! Starting bid: {} SOL", starting_bid as f64 / 1_000_000_000.0);
            },
            AuctionType::Dutch => {
                msg!("⚡ Dutch auction started! Price drops from {} SOL", starting_bid as f64 / 1_000_000_000.0);
            }
        }
        
        Ok(())
    }

    /// Place a bid (simplified version that compiles)
    pub fn place_bid(ctx: Context<PlaceBid>, bid_amount: u64) -> Result<()> {
        let auction = &mut ctx.accounts.auction;
        let clock = Clock::get()?;
        
        require!(auction.status == AuctionStatus::Active, MarketplaceError::ListingNotActive);
        require!(clock.unix_timestamp < auction.end_time, MarketplaceError::ListingNotActive);
        require!(bid_amount > auction.current_bid, MarketplaceError::InsufficientFunds);
        
        auction.current_bid = bid_amount;
        auction.highest_bidder = Some(ctx.accounts.bidder.key());
        
        msg!("🚀 New highest bid: {} SOL", bid_amount as f64 / 1_000_000_000.0);
        Ok(())
    }
}

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
    
    pub ticket_mint: AccountInfo<'info>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct BuyTicket<'info> {
    #[account(
        mut,
        seeds = [b"listing", listing.ticket_mint.as_ref()],
        bump = listing.bump
    )]
    pub listing: Account<'info, Listing>,
    
    #[account(mut)]
    pub buyer: Signer<'info>,
    
    #[account(
        mut,
        constraint = seller.key() == listing.seller
    )]
    pub seller: SystemAccount<'info>,
    
    pub royalty_config: Account<'info, RoyaltyConfig>,
    
    #[account(
        mut,
        constraint = artist_wallet.key() == royalty_config.artist_wallet
    )]
    pub artist_wallet: SystemAccount<'info>,
    
    #[account(
        mut,
        constraint = venue_wallet.key() == royalty_config.venue_wallet
    )]
    pub venue_wallet: SystemAccount<'info>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CreateAuction<'info> {
    #[account(
        init,
        payer = seller,
        space = Auction::LEN,
        seeds = [b"auction", ticket_mint.key().as_ref()],
        bump
    )]
    pub auction: Account<'info, Auction>,
    
    #[account(mut)]
    pub seller: Signer<'info>,
    
    pub ticket_mint: AccountInfo<'info>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct PlaceBid<'info> {
    #[account(
        mut,
        seeds = [b"auction", auction.ticket_mint.as_ref()],
        bump = auction.bump
    )]
    pub auction: Account<'info, Auction>,
    
    #[account(mut)]
    pub bidder: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}

    /// Configure royalty percentages for an event
    pub fn configure_royalty(
        ctx: Context<ConfigureRoyalty>,
        artist_percentage: u16,   // 1000 = 10%
        venue_percentage: u16,    // 500 = 5%
        platform_percentage: u16, // 100 = 1%
        price_cap_multiplier: u16, // 20000 = 200%
    ) -> Result<()> {
        let royalty_config = &mut ctx.accounts.royalty_config;
        
        // Validate percentages don't exceed 100%
        let total_percentage = artist_percentage + venue_percentage + platform_percentage;
        require!(total_percentage <= 10000, MarketplaceError::ArithmeticOverflow);
        
        royalty_config.event_mint = ctx.accounts.event_mint.key();
        royalty_config.artist_wallet = ctx.accounts.artist_wallet.key();
        royalty_config.venue_wallet = ctx.accounts.venue_wallet.key();
        royalty_config.platform_wallet = ctx.accounts.platform_wallet.key();
        royalty_config.artist_percentage = artist_percentage;
        royalty_config.venue_percentage = venue_percentage;
        royalty_config.platform_percentage = platform_percentage;
        royalty_config.price_cap_multiplier = price_cap_multiplier;
        royalty_config.bump = ctx.bumps.royalty_config;
        
        msg!("💰 Royalty config set! Artist: {}%, Venue: {}%, Price cap: {}%",
             artist_percentage as f64 / 100.0,
             venue_percentage as f64 / 100.0,
             price_cap_multiplier as f64 / 100.0);
        
        Ok(())
    }

    /// Get royalty analytics (how much earned)
    pub fn get_royalty_analytics(ctx: Context<GetRoyaltyAnalytics>) -> Result<()> {
        let royalty_config = &ctx.accounts.royalty_config;
        
        // This would typically query historical transactions
        // For now, we'll just show the configuration
        msg!("📊 ROYALTY ANALYTICS:");
        msg!("Artist wallet: {}", royalty_config.artist_wallet);
        msg!("Artist percentage: {}%", royalty_config.artist_percentage as f64 / 100.0);
        msg!("Venue percentage: {}%", royalty_config.venue_percentage as f64 / 100.0);
        msg!("Price cap: {}%", royalty_config.price_cap_multiplier as f64 / 100.0);
        
        Ok(())
    }

#[derive(Accounts)]
pub struct ConfigureRoyalty<'info> {
    #[account(
        init,
        payer = authority,
        space = RoyaltyConfig::LEN,
        seeds = [b"royalty_config", event_mint.key().as_ref()],
        bump
    )]
    pub royalty_config: Account<'info, RoyaltyConfig>,
    
    #[account(mut)]
    pub authority: Signer<'info>,
    
    pub event_mint: AccountInfo<'info>,
    pub artist_wallet: AccountInfo<'info>,
    pub venue_wallet: AccountInfo<'info>,
    pub platform_wallet: AccountInfo<'info>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct GetRoyaltyAnalytics<'info> {
    #[account(
        seeds = [b"royalty_config", royalty_config.event_mint.as_ref()],
        bump = royalty_config.bump
    )]
    pub royalty_config: Account<'info, RoyaltyConfig>,
}
