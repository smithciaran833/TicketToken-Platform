use anchor_lang::prelude::*;
use crate::state::*;
use crate::errors::*;

#[derive(Accounts)]
#[instruction(recipient: Pubkey)]
pub struct TransferPoints<'info> {
    #[account(
        mut,
        seeds = [b"points_config"],
        bump = points_config.bump
    )]
    pub points_config: Account<'info, PointsConfig>,
    
    #[account(
        mut,
        seeds = [b"user_profile", sender.key().as_ref()],
        bump = sender_profile.bump
    )]
    pub sender_profile: Account<'info, UserProfile>,
    
    #[account(
        init_if_needed,
        payer = sender,
        space = UserProfile::MAX_SIZE,
        seeds = [b"user_profile", recipient.as_ref()],
        bump
    )]
    pub recipient_profile: Account<'info, UserProfile>,
    
    #[account(
        init,
        payer = sender,
        space = PointsTransaction::MAX_SIZE,
        seeds = [b"points_tx", sender.key().as_ref(), &Clock::get()?.unix_timestamp.to_le_bytes()],
        bump
    )]
    pub sender_transaction: Account<'info, PointsTransaction>,
    
    #[account(
        init,
        payer = sender,
        space = PointsTransaction::MAX_SIZE,
        seeds = [b"points_tx", recipient.as_ref(), &Clock::get()?.unix_timestamp.to_le_bytes(), b"received"],
        bump
    )]
    pub recipient_transaction: Account<'info, PointsTransaction>,
    
    #[account(mut)]
    pub sender: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<TransferPoints>,
    recipient: Pubkey,
    amount: u64,
    message: String,
) -> Result<()> {
    let points_config = &mut ctx.accounts.points_config;
    let sender_profile = &mut ctx.accounts.sender_profile;
    let recipient_profile = &mut ctx.accounts.recipient_profile;
    let sender_transaction = &mut ctx.accounts.sender_transaction;
    let recipient_transaction = &mut ctx.accounts.recipient_transaction;
    let clock = Clock::get()?;

    // Validate inputs
    require!(amount > 0, GovernanceError::InvalidPointsAmount);
    require!(message.len() <= 100, GovernanceError::StringTooLong);
    require!(
        sender_profile.owner != recipient,
        GovernanceError::SelfTransferNotAllowed
    );

    // Check sufficient balance
    require!(
        sender_profile.points_balance >= amount,
        GovernanceError::InsufficientPoints
    );

    // Initialize recipient profile if new
    if recipient_profile.owner == Pubkey::default() {
        recipient_profile.owner = recipient;
        recipient_profile.points_balance = 0;
        recipient_profile.points_earned = 0;
        recipient_profile.points_spent = 0;
        recipient_profile.current_tier = 0;
        recipient_profile.tier_progress = 0;
        recipient_profile.referral_count = 0;
        recipient_profile.referral_earnings = 0;
        recipient_profile.attendance_streak = 0;
        recipient_profile.created_at = clock.unix_timestamp;
        recipient_profile.metadata = String::new();
        recipient_profile.bump = ctx.bumps.recipient_profile;
        
        points_config.total_users += 1;
    }

    // Transfer points
    sender_profile.points_balance = sender_profile.points_balance
        .checked_sub(amount)
        .ok_or(GovernanceError::CalculationOverflow)?;
    
    recipient_profile.points_balance = recipient_profile.points_balance
        .checked_add(amount)
        .ok_or(GovernanceError::CalculationOverflow)?;

    // Update activity timestamps
    sender_profile.last_activity = clock.unix_timestamp;
    recipient_profile.last_activity = clock.unix_timestamp;
    points_config.updated_at = clock.unix_timestamp;

    // Record sender transaction
    sender_transaction.user = sender_profile.owner;
    sender_transaction.transaction_type = TransactionType::Transferred;
    sender_transaction.amount = amount;
    sender_transaction.balance_after = sender_profile.points_balance;
    sender_transaction.reason = format!("Transfer to {}", recipient);
    sender_transaction.metadata = message.clone();
    sender_transaction.timestamp = clock.unix_timestamp;
    sender_transaction.bump = ctx.bumps.sender_transaction;

    // Record recipient transaction
    recipient_transaction.user = recipient;
    recipient_transaction.transaction_type = TransactionType::Received;
    recipient_transaction.amount = amount;
    recipient_transaction.balance_after = recipient_profile.points_balance;
    recipient_transaction.reason = format!("Transfer from {}", sender_profile.owner);
    recipient_transaction.metadata = message;
    recipient_transaction.timestamp = clock.unix_timestamp;
    recipient_transaction.bump = ctx.bumps.recipient_transaction;

    msg!("Transferred {} points from {} to {}", amount, sender_profile.owner, recipient);

    Ok(())
}
