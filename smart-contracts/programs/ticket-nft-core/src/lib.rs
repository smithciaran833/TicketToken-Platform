use anchor_lang::prelude::*;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod ticket_nft_core {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        msg!("ticket-nft-core initialized!");
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}
