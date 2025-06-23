use anchor_lang::prelude::*;

#[account]
pub struct VipPass {
    pub owner: Pubkey,
    pub pass_type: String,        // "backstage", "meet_greet", "premium_seating"
    pub benefits: Vec<String>,    // List of included benefits
    pub valid_until: i64,         // Expiration timestamp
    pub transferable: bool,       // Can be transferred
    pub created_at: i64,
    pub last_used: Option<i64>,
    pub usage_count: u32,
    pub metadata_uri: String,     // Link to metadata
    pub bump: u8,
}

impl VipPass {
    pub const MAX_SIZE: usize = 8 + 32 + 64 + 256 + 8 + 1 + 8 + 8 + 4 + 256 + 1;
    
    pub fn is_valid(&self) -> bool {
        let clock = Clock::get().unwrap();
        clock.unix_timestamp < self.valid_until
    }
}

#[account]
pub struct SeasonPass {
    pub owner: Pubkey,
    pub season_name: String,      // "2024 Summer Tour"
    pub total_events: u16,        // Total events in season
    pub events_attended: u16,     // Events already attended
    pub benefits: Vec<String>,    // Season benefits
    pub expires_at: i64,
    pub created_at: i64,
    pub last_event_date: Option<i64>,
    pub events_list: Vec<Pubkey>, // Event IDs included
    pub bump: u8,
}

impl SeasonPass {
    pub const MAX_SIZE: usize = 8 + 32 + 64 + 2 + 2 + 256 + 8 + 8 + 8 + 256 + 1;
    
    pub fn can_attend_event(&self, event_id: Pubkey) -> bool {
        self.events_list.contains(&event_id) && 
        self.events_attended < self.total_events &&
        self.is_valid()
    }
    
    pub fn is_valid(&self) -> bool {
        let clock = Clock::get().unwrap();
        clock.unix_timestamp < self.expires_at
    }
}

#[account]
pub struct AccessPermission {
    pub holder: Pubkey,
    pub grantor: Pubkey,          // Who granted this access
    pub access_type: String,      // "content", "merchandise", "presale"
    pub permissions: Vec<String>, // Specific permissions
    pub granted_at: i64,
    pub expires_at: Option<i64>,  // Optional expiration
    pub active: bool,
    pub last_used: Option<i64>,
    pub usage_count: u32,
    pub conditions: Vec<String>,  // Additional conditions
    pub bump: u8,
}

impl AccessPermission {
    pub const MAX_SIZE: usize = 8 + 32 + 32 + 64 + 256 + 8 + 8 + 1 + 8 + 4 + 256 + 1;
    
    pub fn is_valid(&self) -> bool {
        if !self.active {
            return false;
        }
        
        if let Some(expiry) = self.expires_at {
            let clock = Clock::get().unwrap();
            return clock.unix_timestamp < expiry;
        }
        
        true
    }
    
    pub fn has_permission(&self, required: &str) -> bool {
        self.is_valid() && 
        (self.permissions.contains(&required.to_string()) ||
         self.permissions.contains(&"all".to_string()))
    }
}

#[account]
pub struct TimeGate {
    pub authority: Pubkey,
    pub start_time: i64,
    pub end_time: i64,
    pub gate_type: String,        // "presale", "content_unlock", "exclusive_access"
    pub conditions: Vec<String>,  // Required conditions to pass gate
    pub active: bool,
    pub passed_users: Vec<Pubkey>, // Users who have passed
    pub max_participants: Option<u32>,
    pub current_participants: u32,
    pub created_at: i64,
    pub bump: u8,
}

impl TimeGate {
    pub const MAX_SIZE: usize = 8 + 32 + 8 + 8 + 64 + 256 + 1 + 1024 + 4 + 4 + 8 + 1;
    
    pub fn is_active(&self) -> bool {
        if !self.active {
            return false;
        }
        
        let clock = Clock::get().unwrap();
        let now = clock.unix_timestamp;
        
        now >= self.start_time && now <= self.end_time
    }
    
    pub fn can_pass(&self, user: Pubkey) -> bool {
        if !self.is_active() {
            return false;
        }
        
        if self.passed_users.contains(&user) {
            return true; // Already passed
        }
        
        if let Some(max) = self.max_participants {
            if self.current_participants >= max {
                return false;
            }
        }
        
        true
    }
}

#[account]
pub struct AccessBenefit {
    pub benefit_id: String,
    pub benefit_type: String,     // "discount", "exclusive_content", "merchandise"
    pub title: String,
    pub description: String,
    pub value: String,            // JSON encoded value
    pub required_access: Vec<String>, // Required access types
    pub active: bool,
    pub created_at: i64,
    pub expires_at: Option<i64>,
    pub usage_limit: Option<u32>,
    pub current_usage: u32,
    pub bump: u8,
}

impl AccessBenefit {
    pub const MAX_SIZE: usize = 8 + 64 + 64 + 128 + 256 + 512 + 256 + 1 + 8 + 8 + 4 + 4 + 1;
    
    pub fn is_available(&self) -> bool {
        if !self.active {
            return false;
        }
        
        if let Some(limit) = self.usage_limit {
            if self.current_usage >= limit {
                return false;
            }
        }
        
        if let Some(expiry) = self.expires_at {
            let clock = Clock::get().unwrap();
            if clock.unix_timestamp > expiry {
                return false;
            }
        }
        
        true
    }
}

// Event types for governance
#[event]
pub struct VipPassCreated {
    pub pass_id: Pubkey,
    pub owner: Pubkey,
    pub pass_type: String,
    pub valid_until: i64,
}

#[event]
pub struct AccessGranted {
    pub permission_id: Pubkey,
    pub holder: Pubkey,
    pub access_type: String,
    pub granted_by: Pubkey,
}

#[event]
pub struct AccessRevoked {
    pub permission_id: Pubkey,
    pub holder: Pubkey,
    pub revoked_by: Pubkey,
    pub reason: String,
}

#[event]
pub struct TimeGatePassed {
    pub gate_id: Pubkey,
    pub user: Pubkey,
    pub timestamp: i64,
}
