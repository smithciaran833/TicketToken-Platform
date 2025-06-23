use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct CreateLoanOffer<'info> {
    #[account(
        init,
        payer = lender,
        space = 8 + LoanOffer::INIT_SPACE
    )]
    pub loan_offer: Account<'info, LoanOffer>,
    
    #[account(mut)]
    pub lender: Signer<'info>,
    
    pub ticket_mint: Account<'info, anchor_spl::token::Mint>,
    
    pub system_program: Program<'info, System>,
}

#[account]
#[derive(InitSpace)]
pub struct LoanOffer {
    pub lender: Pubkey,
    pub ticket_mint: Pubkey,
    pub loan_amount: u64,
    pub interest_rate: u16, // basis points (100 = 1%)
    pub duration: i64, // seconds
    pub collateral_required: u64,
    pub is_active: bool,
    pub created_at: i64,
}

pub fn create_loan_offer(
    ctx: Context<CreateLoanOffer>,
    loan_amount: u64,
    interest_rate: u16,
    duration: i64,
    collateral_required: u64,
) -> Result<()> {
    let loan_offer = &mut ctx.accounts.loan_offer;
    let clock = Clock::get()?;
    
    loan_offer.lender = ctx.accounts.lender.key();
    loan_offer.ticket_mint = ctx.accounts.ticket_mint.key();
    loan_offer.loan_amount = loan_amount;
    loan_offer.interest_rate = interest_rate;
    loan_offer.duration = duration;
    loan_offer.collateral_required = collateral_required;
    loan_offer.is_active = true;
    loan_offer.created_at = clock.unix_timestamp;
    
    msg!("💰 Loan offer created: {} SOL at {}% for {} seconds", 
         loan_amount as f64 / 1_000_000_000.0, 
         interest_rate as f64 / 100.0,
         duration);
    
    Ok(())
}
