use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct WriteOption<'info> {
    #[account(
        init,
        payer = writer,
        space = 8 + TicketOption::INIT_SPACE
    )]
    pub ticket_option: Account<'info, TicketOption>,
    
    #[account(mut)]
    pub writer: Signer<'info>,
    
    pub underlying_ticket: Account<'info, anchor_spl::token::Mint>,
    
    pub system_program: Program<'info, System>,
}

#[account]
#[derive(InitSpace)]
pub struct TicketOption {
    pub writer: Pubkey,
    pub underlying_ticket: Pubkey,
    pub option_type: OptionType,
    pub strike_price: u64,
    pub premium: u64,
    pub expiration: i64,
    pub event_date: i64,
    pub is_exercised: bool,
    pub is_expired: bool,
    pub buyer: Option<Pubkey>,
    pub created_at: i64,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum OptionType {
    Call,  // Right to buy ticket at strike price
    Put,   // Right to sell ticket at strike price
}

impl Default for OptionType {
    fn default() -> Self {
        OptionType::Call
    }
}

pub fn write_option(
    ctx: Context<WriteOption>,
    option_type: OptionType,
    strike_price: u64,
    premium: u64,
    expiration: i64,
    event_date: i64,
) -> Result<()> {
    let ticket_option = &mut ctx.accounts.ticket_option;
    let clock = Clock::get()?;
    
    require!(expiration > clock.unix_timestamp, OptionsError::ExpirationInPast);
    require!(expiration < event_date, OptionsError::ExpirationAfterEvent);
    require!(premium > 0, OptionsError::InvalidPremium);
    require!(strike_price > 0, OptionsError::InvalidStrikePrice);
    
    ticket_option.writer = ctx.accounts.writer.key();
    ticket_option.underlying_ticket = ctx.accounts.underlying_ticket.key();
    ticket_option.option_type = option_type.clone();
    ticket_option.strike_price = strike_price;
    ticket_option.premium = premium;
    ticket_option.expiration = expiration;
    ticket_option.event_date = event_date;
    ticket_option.is_exercised = false;
    ticket_option.is_expired = false;
    ticket_option.buyer = None;
    ticket_option.created_at = clock.unix_timestamp;
    
    msg!("📃 {:?} option written: Strike {} SOL, Premium {} SOL, Expires {}", 
         option_type,
         strike_price as f64 / 1_000_000_000.0,
         premium as f64 / 1_000_000_000.0,
         expiration);
    
    Ok(())
}

#[error_code]
pub enum OptionsError {
    #[msg("Expiration date must be in the future")]
    ExpirationInPast,
    #[msg("Option must expire before event date")]
    ExpirationAfterEvent,
    #[msg("Premium must be greater than zero")]
    InvalidPremium,
    #[msg("Strike price must be greater than zero")]
    InvalidStrikePrice,
    #[msg("Option has already been exercised")]
    OptionAlreadyExercised,
    #[msg("Option has expired")]
    OptionExpired,
    #[msg("Insufficient funds to exercise option")]
    InsufficientFunds,
}
