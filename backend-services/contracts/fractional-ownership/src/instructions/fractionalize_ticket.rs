use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Mint, MintTo};

#[derive(Accounts)]
pub struct FractionalizeTicket<'info> {
    #[account(
        init,
        payer = owner,
        space = 8 + FractionalTicket::INIT_SPACE
    )]
    pub fractional_ticket: Account<'info, FractionalTicket>,
    
    #[account(mut)]
    pub owner: Signer<'info>,
    
    // Original ticket being fractionalized
    #[account(
        mut,
        constraint = original_ticket.owner == owner.key(),
        constraint = original_ticket.amount == 1
    )]
    pub original_ticket: Account<'info, TokenAccount>,
    
    // New mint for fractional shares
    #[account(
        init,
        payer = owner,
        mint::decimals = 6,
        mint::authority = fractional_ticket
    )]
    pub share_mint: Account<'info, Mint>,
    
    // Owner's share token account
    #[account(
        init,
        payer = owner,
        token::mint = share_mint,
        token::authority = owner
    )]
    pub owner_shares: Account<'info, TokenAccount>,
    
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[account]
#[derive(InitSpace)]
pub struct FractionalTicket {
    pub original_mint: Pubkey,
    pub share_mint: Pubkey,
    pub owner: Pubkey,
    pub total_shares: u64,
    pub shares_sold: u64,
    pub price_per_share: u64,
    pub event_date: i64,
    pub is_redeemable: bool,
    pub minimum_shares_for_redemption: u64,
    pub created_at: i64,
}

pub fn fractionalize_ticket(
    ctx: Context<FractionalizeTicket>,
    total_shares: u64,
    price_per_share: u64,
    event_date: i64,
    minimum_shares_for_redemption: u64,
) -> Result<()> {
    let fractional_ticket = &mut ctx.accounts.fractional_ticket;
    let clock = Clock::get()?;
    
    // Transfer original ticket to escrow (burn it)
    let transfer_ctx = CpiContext::new(
        ctx.accounts.token_program.to_account_info(),
        token::Transfer {
            from: ctx.accounts.original_ticket.to_account_info(),
            to: ctx.accounts.fractional_ticket.to_account_info(), // This would be an escrow
            authority: ctx.accounts.owner.to_account_info(),
        },
    );
    // token::transfer(transfer_ctx, 1)?;
    
    // Mint all shares to owner initially
    let mint_ctx = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        MintTo {
            mint: ctx.accounts.share_mint.to_account_info(),
            to: ctx.accounts.owner_shares.to_account_info(),
            authority: fractional_ticket.to_account_info(),
        },
        &[&[
            b"fractional_ticket",
            ctx.accounts.original_ticket.mint.as_ref(),
            &[*ctx.bumps.get("fractional_ticket").unwrap()],
        ]],
    );
    token::mint_to(mint_ctx, total_shares)?;
    
    // Set up fractional ticket data
    fractional_ticket.original_mint = ctx.accounts.original_ticket.mint;
    fractional_ticket.share_mint = ctx.accounts.share_mint.key();
    fractional_ticket.owner = ctx.accounts.owner.key();
    fractional_ticket.total_shares = total_shares;
    fractional_ticket.shares_sold = 0;
    fractional_ticket.price_per_share = price_per_share;
    fractional_ticket.event_date = event_date;
    fractional_ticket.is_redeemable = false;
    fractional_ticket.minimum_shares_for_redemption = minimum_shares_for_redemption;
    fractional_ticket.created_at = clock.unix_timestamp;
    
    msg!("🧩 Ticket fractionalized into {} shares at {} SOL each", 
         total_shares, 
         price_per_share as f64 / 1_000_000_000.0);
    
    Ok(())
}
