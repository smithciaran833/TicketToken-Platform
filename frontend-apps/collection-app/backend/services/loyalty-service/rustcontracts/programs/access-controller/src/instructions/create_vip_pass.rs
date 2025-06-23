use anchor_lang::prelude::*;
use crate::state::*;
use crate::errors::*;

#[derive(Accounts)]
#[instruction(pass_type: String)]
pub struct CreateVipPass<'info> {
    #[account(
        init,
        payer = authority,
        space = VipPass::MAX_SIZE,
        seeds = [b"vip_pass", authority.key().as_ref(), pass_type.as_bytes()],
        bump
    )]
    pub vip_pass: Account<'info, VipPass>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<CreateVipPass>,
    pass_type: String,
    benefits: Vec<String>,
    valid_until: i64,
    transferable: bool,
) -> Result<()> {
    let vip_pass = &mut ctx.accounts.vip_pass;
    let clock = Clock::get()?;

    // Validate inputs
    require!(pass_type.len() <= 32, AccessControlError::StringTooLong);
    require!(valid_until > clock.unix_timestamp, AccessControlError::InvalidTimestamp);
    require!(benefits.len() <= 10, AccessControlError::StringTooLong);

    vip_pass.owner = ctx.accounts.authority.key();
    vip_pass.pass_type = pass_type.clone();
    vip_pass.benefits = benefits.clone();
    vip_pass.valid_until = valid_until;
    vip_pass.transferable = transferable;
    vip_pass.created_at = clock.unix_timestamp;
    vip_pass.last_used = None;
    vip_pass.usage_count = 0;
    vip_pass.metadata_uri = String::new();
    vip_pass.bump = ctx.bumps.vip_pass;

    // Emit event
    emit!(VipPassCreated {
        pass_id: vip_pass.key(),
        owner: vip_pass.owner,
        pass_type,
        valid_until,
    });

    msg!("VIP Pass created for {}", vip_pass.owner);
    msg!("Pass type: {}", vip_pass.pass_type);
    msg!("Benefits: {:?}", benefits);

    Ok(())
}
