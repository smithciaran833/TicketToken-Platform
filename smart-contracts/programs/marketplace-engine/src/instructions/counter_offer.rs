use anchor_lang::prelude::*;
use crate::state::*;

#[derive(Accounts)]
pub struct CounterOffer<'info> {
    #[account(mut)]
    pub offer: Account<'info, Offer>,
    pub seller: Signer<'info>,
}

pub fn handler(ctx: Context<CounterOffer>, new_amount: u64, expires_at: i64) -> Result<()> {
    msg!("Counter offer: {} SOL", new_amount as f64 / 1_000_000_000.0);
    Ok(())
}
