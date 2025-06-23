use anchor_lang::prelude::*;
use crate::state::*;
use crate::errors::*;

#[derive(Accounts)]
#[instruction(access_type: String)]
pub struct GrantAccess<'info> {
    #[account(
        init,
        payer = grantor,
        space = AccessPermission::MAX_SIZE,
        seeds = [b"access_permission", holder.key().as_ref(), access_type.as_bytes()],
        bump
    )]
    pub access_permission: Account<'info, AccessPermission>,

    /// CHECK: The user receiving access
    pub holder: UncheckedAccount<'info>,

    #[account(mut)]
    pub grantor: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<GrantAccess>,
    access_type: String,
    permissions: Vec<String>,
    expires_at: Option<i64>,
) -> Result<()> {
    let access_permission = &mut ctx.accounts.access_permission;
    let clock = Clock::get()?;

    // Validate inputs
    require!(access_type.len() <= 32, AccessControlError::StringTooLong);
    require!(!permissions.is_empty(), AccessControlError::InvalidAction);

    if let Some(expiry) = expires_at {
        require!(expiry > clock.unix_timestamp, AccessControlError::InvalidTimestamp);
    }

    access_permission.holder = ctx.accounts.holder.key();
    access_permission.grantor = ctx.accounts.grantor.key();
    access_permission.access_type = access_type.clone();
    access_permission.permissions = permissions;
    access_permission.granted_at = clock.unix_timestamp;
    access_permission.expires_at = expires_at;
    access_permission.active = true;
    access_permission.last_used = None;
    access_permission.usage_count = 0;
    access_permission.conditions = Vec::new();
    access_permission.bump = ctx.bumps.access_permission;

    // Emit event
    emit!(AccessGranted {
        permission_id: access_permission.key(),
        holder: access_permission.holder,
        access_type,
        granted_by: access_permission.grantor,
    });

    msg!("Access granted to {}", access_permission.holder);

    Ok(())
}
