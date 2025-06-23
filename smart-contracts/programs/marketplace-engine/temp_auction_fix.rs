    /// Place a bid in an English auction
    pub fn place_bid(ctx: Context<PlaceBid>, bid_amount: u64) -> Result<()> {
        let clock = Clock::get()?;
        
        // Validate auction first (before any borrows)
        {
            let auction = &ctx.accounts.auction;
            require!(auction.status == AuctionStatus::Active, MarketplaceError::ListingNotActive);
            require!(clock.unix_timestamp < auction.end_time, MarketplaceError::ListingNotActive);
            require!(auction.auction_type == AuctionType::English, MarketplaceError::ListingNotActive);
            require!(bid_amount > auction.current_bid, MarketplaceError::InsufficientFunds);
        }
        
        // Get current bid for refund
        let previous_bid = ctx.accounts.auction.current_bid;
        let previous_bidder_key = ctx.accounts.auction.highest_bidder;
        
        // If there's a previous bidder, return their money
        if let Some(prev_bidder) = previous_bidder_key {
            if prev_bidder != ctx.accounts.bidder.key() && previous_bid > 0 {
                // Transfer from auction escrow back to previous bidder
                let auction_info = ctx.accounts.auction.to_account_info();
                let prev_bidder_info = ctx.accounts.previous_bidder.to_account_info();
                
                **prev_bidder_info.lamports.borrow_mut() += previous_bid;
                **auction_info.lamports.borrow_mut() -= previous_bid;
            }
        }
        
        // Escrow new bid amount
        anchor_lang::system_program::transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                anchor_lang::system_program::Transfer {
                    from: ctx.accounts.bidder.to_account_info(),
                    to: ctx.accounts.auction.to_account_info(),
                },
            ),
            bid_amount,
        )?;
        
        // Update auction with new highest bid
        let auction = &mut ctx.accounts.auction;
        auction.current_bid = bid_amount;
        auction.highest_bidder = Some(ctx.accounts.bidder.key());
        
        msg!("🚀 New highest bid: {} SOL by {}", 
             bid_amount as f64 / 1_000_000_000.0,
             ctx.accounts.bidder.key());
        
        Ok(())
    }

    /// End auction and finalize sale with royalty distribution
    pub fn end_auction(ctx: Context<EndAuction>) -> Result<()> {
        let clock = Clock::get()?;
        
        // Validate auction can be ended
        {
            let auction = &ctx.accounts.auction;
            require!(auction.status == AuctionStatus::Active, MarketplaceError::ListingNotActive);
            require!(clock.unix_timestamp >= auction.end_time, MarketplaceError::ListingNotActive);
        }
        
        let winner = ctx.accounts.auction.highest_bidder;
        let final_price = ctx.accounts.auction.current_bid;
        
        if winner.is_some() {
            let royalty_config = &ctx.accounts.royalty_config;
            
            // Calculate royalty distributions
            let artist_royalty = final_price
                .checked_mul(royalty_config.artist_percentage as u64)
                .ok_or(MarketplaceError::ArithmeticOverflow)?
                .checked_div(10000)
                .ok_or(MarketplaceError::ArithmeticOverflow)?;
            
            let venue_royalty = final_price
                .checked_mul(royalty_config.venue_percentage as u64)
                .ok_or(MarketplaceError::ArithmeticOverflow)?
                .checked_div(10000)
                .ok_or(MarketplaceError::ArithmeticOverflow)?;
            
            let platform_fee = final_price
                .checked_mul(royalty_config.platform_percentage as u64)
                .ok_or(MarketplaceError::ArithmeticOverflow)?
                .checked_div(10000)
                .ok_or(MarketplaceError::ArithmeticOverflow)?;
            
            let seller_amount = final_price
                .checked_sub(artist_royalty)
                .ok_or(MarketplaceError::ArithmeticOverflow)?
                .checked_sub(venue_royalty)
                .ok_or(MarketplaceError::ArithmeticOverflow)?
                .checked_sub(platform_fee)
                .ok_or(MarketplaceError::ArithmeticOverflow)?;
            
            // Distribute payments from escrowed auction funds
            let auction_info = ctx.accounts.auction.to_account_info();
            
            // Pay seller
            **ctx.accounts.seller.lamports.borrow_mut() += seller_amount;
            **auction_info.lamports.borrow_mut() -= seller_amount;
            
            // Pay artist royalty
            if artist_royalty > 0 {
                **ctx.accounts.artist_wallet.lamports.borrow_mut() += artist_royalty;
                **auction_info.lamports.borrow_mut() -= artist_royalty;
            }
            
            // Pay venue royalty
            if venue_royalty > 0 {
                **ctx.accounts.venue_wallet.lamports.borrow_mut() += venue_royalty;
                **auction_info.lamports.borrow_mut() -= venue_royalty;
            }
            
            // Update auction status
            let auction = &mut ctx.accounts.auction;
            auction.status = AuctionStatus::Ended;
            
            msg!("🎉 AUCTION WON! Winner: {} for {} SOL. Artist: {} SOL, Venue: {} SOL", 
                 winner.unwrap(),
                 final_price as f64 / 1_000_000_000.0,
                 artist_royalty as f64 / 1_000_000_000.0,
                 venue_royalty as f64 / 1_000_000_000.0);
        } else {
            let auction = &mut ctx.accounts.auction;
            auction.status = AuctionStatus::Cancelled;
            msg!("🚫 Auction ended with no bids");
        }
        
        Ok(())
    }
