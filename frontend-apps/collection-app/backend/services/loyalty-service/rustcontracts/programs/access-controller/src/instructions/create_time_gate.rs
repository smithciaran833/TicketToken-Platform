use anchor_lang::prelude::*;
use crate::state::*;
use crate::errors::*;

#[derive(Accounts)]
#[instruction(gate_type: String)]
pub struct CreateTimeGate<'info> {
    #[account(
        init,
        payer = authority,
        space = TimeGate::MAX_SIZE,
        seeds = [b"time_gate", authority.key().as_ref(), gate_type.as_bytes()],
        bump
    )]
    pub time_gate: Account<'info, TimeGate>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<CreateTimeGate>,
    start_time: i64,
    end_time: i64,
    gate_type: String,
    conditions: Vec<String>,
) -> Result<()> {
    let time_gate = &mut ctx.accounts.time_gate;
    let clock = Clock::get()?;

    // Validate inputs
    require!(start_time > clock.unix_timestamp, AccessControlError::InvalidTimestamp);
    require!(end_time > start_time, AccessControlError::InvalidTimeGate);
    require!(gate_type.len() <= 32, AccessControlError::StringTooLong);

    time_gate.authority = ctx.accounts.authority.key();
    time_gate.start_time = start_time;
    time_gate.end_time = end_time;
    time_gate.gate_type = gate_type;
    time_gate.conditions = conditions;
    time_gate.active = true;
    time_gate.passed_users = Vec::new();
    time_gate.max_participants = None;
    time_gate.current_participants = 0;
    time_gate.created_at = clock.unix_timestamp;
    time_gate.bump = ctx.bumps.time_gate;

    msg!("Time gate created from {} to {}", start_time, end_time);

    Ok(())
}
