use anchor_lang::prelude::*;

pub mod instructions;
pub mod state;
pub mod errors;

use instructions::*;

declare_id!("Acc1111111111111111111111111111111111111111");

#[program]
pub mod access_controller {
    use super::*;

    // VIP Pass Management
    pub fn create_vip_pass(
        ctx: Context<CreateVipPass>,
        pass_type: String,
        benefits: Vec<String>,
        valid_until: i64,
        transferable: bool,
    ) -> Result<()> {
        instructions::create_vip_pass::handler(ctx, pass_type, benefits, valid_until, transferable)
    }

    pub fn create_season_pass(
        ctx: Context<CreateSeasonPass>,
        season_name: String,
        event_count: u16,
        benefits: Vec<String>,
        expires_at: i64,
    ) -> Result<()> {
        instructions::create_season_pass::handler(ctx, season_name, event_count, benefits, expires_at)
    }

    // Access Management
    pub fn grant_access(
        ctx: Context<GrantAccess>,
        access_type: String,
        permissions: Vec<String>,
        expires_at: Option<i64>,
    ) -> Result<()> {
        instructions::grant_access::handler(ctx, access_type, permissions, expires_at)
    }

    pub fn revoke_access(
        ctx: Context<RevokeAccess>,
        reason: String,
    ) -> Result<()> {
        instructions::revoke_access::handler(ctx, reason)
    }

    pub fn check_access(
        ctx: Context<CheckAccess>,
        required_permission: String,
    ) -> Result<()> {
        instructions::check_access::handler(ctx, required_permission)
    }

    // Time-based Access
    pub fn create_time_gate(
        ctx: Context<CreateTimeGate>,
        start_time: i64,
        end_time: i64,
        gate_type: String,
        conditions: Vec<String>,
    ) -> Result<()> {
        instructions::create_time_gate::handler(ctx, start_time, end_time, gate_type, conditions)
    }

    // Benefits Management
    pub fn manage_benefits(
        ctx: Context<ManageBenefits>,
        benefit_type: String,
        action: String, // "add", "remove", "update"
        value: String,
    ) -> Result<()> {
        instructions::manage_benefits::handler(ctx, benefit_type, action, value)
    }

    // Pass Transfers
    pub fn transfer_pass(
        ctx: Context<TransferPass>,
        new_owner: Pubkey,
    ) -> Result<()> {
        instructions::transfer_pass::handler(ctx, new_owner)
    }
}
