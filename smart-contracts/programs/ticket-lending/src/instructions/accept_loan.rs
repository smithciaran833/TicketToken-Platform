use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

#[derive(Accounts)]
pub struct AcceptLoan<'info> {
    #[account(
        mut,
        constraint = loan_offer.is_active @ LendingError::LoanOfferInactive
    )]
    pub loan_offer: Account<'info, LoanOffer>,
    
    #[account(
        init,
        payer = borrower,
        space = 8 + ActiveLoan::INIT_SPACE
    )]
    pub active_loan: Account<'info, ActiveLoan>,
    
    #[account(mut)]
    pub borrower: Signer<'info>,
    
    /// CHECK: This is the lender's account
    #[account(mut)]
    pub lender: AccountInfo<'info>,
    
    // Borrower's ticket (collateral)
    #[account(
        mut,
        constraint = borrower_ticket.mint == loan_offer.ticket_mint,
        constraint = borrower_ticket.owner == borrower.key()
    )]
    pub borrower_ticket: Account<'info, TokenAccount>,
    
    // Escrow account for collateral
    #[account(
        init,
        payer = borrower,
        token::mint = loan_offer.ticket_mint,
        token::authority = active_loan
    )]
    pub escrow_account: Account<'info, TokenAccount>,
    
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[account]
#[derive(InitSpace)]
pub struct ActiveLoan {
    pub loan_offer: Pubkey,
    pub borrower: Pubkey,
    pub lender: Pubkey,
    pub ticket_mint: Pubkey,
    pub principal: u64,
    pub interest_rate: u16,
    pub start_time: i64,
    pub due_date: i64,
    pub collateral_amount: u64,
    pub is_repaid: bool,
    pub is_defaulted: bool,
}

#[error_code]
pub enum LendingError {
    #[msg("Loan offer is no longer active")]
    LoanOfferInactive,
    #[msg("Insufficient collateral")]
    InsufficientCollateral,
    #[msg("Loan already repaid")]
    LoanAlreadyRepaid,
    #[msg("Loan not yet due")]
    LoanNotDue,
}

pub fn accept_loan(ctx: Context<AcceptLoan>) -> Result<()> {
    let loan_offer = &mut ctx.accounts.loan_offer;
    let active_loan = &mut ctx.accounts.active_loan;
    let clock = Clock::get()?;
    
    // Transfer collateral to escrow
    let transfer_ctx = CpiContext::new(
        ctx.accounts.token_program.to_account_info(),
        Transfer {
            from: ctx.accounts.borrower_ticket.to_account_info(),
            to: ctx.accounts.escrow_account.to_account_info(),
            authority: ctx.accounts.borrower.to_account_info(),
        },
    );
    token::transfer(transfer_ctx, loan_offer.collateral_required)?;
    
    // Transfer loan amount to borrower
    **ctx.accounts.borrower.to_account_info().try_borrow_mut_lamports()? += loan_offer.loan_amount;
    **ctx.accounts.lender.to_account_info().try_borrow_mut_lamports()? -= loan_offer.loan_amount;
    
    // Set up active loan
    active_loan.loan_offer = loan_offer.key();
    active_loan.borrower = ctx.accounts.borrower.key();
    active_loan.lender = loan_offer.lender;
    active_loan.ticket_mint = loan_offer.ticket_mint;
    active_loan.principal = loan_offer.loan_amount;
    active_loan.interest_rate = loan_offer.interest_rate;
    active_loan.start_time = clock.unix_timestamp;
    active_loan.due_date = clock.unix_timestamp + loan_offer.duration;
    active_loan.collateral_amount = loan_offer.collateral_required;
    active_loan.is_repaid = false;
    active_loan.is_defaulted = false;
    
    // Deactivate loan offer
    loan_offer.is_active = false;
    
    msg!("🤝 Loan accepted: {} SOL borrowed against ticket collateral", 
         loan_offer.loan_amount as f64 / 1_000_000_000.0);
    
    Ok(())
}
