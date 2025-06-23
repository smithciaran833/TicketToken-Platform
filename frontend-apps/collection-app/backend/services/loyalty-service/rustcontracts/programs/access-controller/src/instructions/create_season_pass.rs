use anchor_lang::prelude::*;
use crate::state::*;
use crate::errors::*;

#[derive(Accounts)]
#[instruction(season_name: String)]
pub struct CreateSeasonPass<'info> {
    #[account(
        init,
        payer = authority,
        space = SeasonPass::MAX_SIZE,
        seeds = [b"season_pass", authority.key().as_ref(), season_name.as_bytes()],
        bump
    )]
    pub season_pass: Account<'info, SeasonPass>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<CreateSeasonPass>,
    season_name: String,
    event_count: u16,
    benefits: Vec<String>,
    expires_at: i64,
) -> Result<()> {
    let season_pass = &mut ctx.accounts.season_pass;
    let clock = Clock::get()?;

    // Validate inputs
    require!(season_name.len() <= 32, AccessControlError::StringTooLong);
    require!(event_count > 0, AccessControlError::InvalidAction);
    require!(expires_at > clock.unix_timestamp, AccessControlError::InvalidTimestamp);

    season_pass.owner = ctx.accounts.authority.key();
    season_pass.season_name = season_name;
    season_pass.total_events = event_count;
    season_pass.events_attended = 0;
    season_pass.benefits = benefits;
    season_pass.expires_at = expires_at;
    season_pass.created_at = clock.unix_timestamp;
    season_pass.last_event_date = None;
    season_pass.events_list = Vec::new();
    season_pass.bump = ctx.bumps.season_pass;

    msg!("Season Pass created for {} events", event_count);

    Ok(())
}
