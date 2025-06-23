use anchor_lang::prelude::*;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod revenue_splitter {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        msg!("revenue-splitter initialized!");
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}
