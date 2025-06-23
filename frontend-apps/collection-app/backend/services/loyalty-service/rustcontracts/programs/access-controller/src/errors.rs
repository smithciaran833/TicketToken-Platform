use anchor_lang::prelude::*;

#[error_code]
pub enum AccessControlError {
    #[msg("Pass has expired")]
    PassExpired,
    
    #[msg("Access permission denied")]
    AccessDenied,
    
    #[msg("Pass is not transferable")]
    NotTransferable,
    
    #[msg("Invalid time gate period")]
    InvalidTimeGate,
    
    #[msg("Time gate is not active")]
    TimeGateNotActive,
    
    #[msg("Maximum participants reached")]
    MaxParticipantsReached,
    
    #[msg("User has already passed this gate")]
    AlreadyPassed,
    
    #[msg("Insufficient permissions")]
    InsufficientPermissions,
    
    #[msg("Invalid benefit type")]
    InvalidBenefitType,
    
    #[msg("Benefit not available")]
    BenefitNotAvailable,
    
    #[msg("Invalid action")]
    InvalidAction,
    
    #[msg("Season pass exhausted")]
    SeasonPassExhausted,
    
    #[msg("Event not in season")]
    EventNotInSeason,
    
    #[msg("String too long")]
    StringTooLong,
    
    #[msg("Invalid timestamp")]
    InvalidTimestamp,
    
    #[msg("Access already exists")]
    AccessAlreadyExists,
    
    #[msg("Access not found")]
    AccessNotFound,
    
    #[msg("Unauthorized operation")]
    Unauthorized,
    
    #[msg("Invalid pass type")]
    InvalidPassType,
}
