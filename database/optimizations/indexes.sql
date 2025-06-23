-- =====================================================================================
-- TICKETTOKEN PERFORMANCE INDEXES
-- Optimized for high-performance event ticketing operations
-- =====================================================================================

-- Enable timing for performance analysis
\timing

-- Event Discovery Optimization (most critical)
-- Supports fast event browsing, filtering, and search
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_events_discovery 
ON events(status, start_date, created_at) 
WHERE status = 'active'
WITH (fillfactor = 90);

-- Hot events optimization (events with high ticket sales)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_events_hot
ON events(ticket_sales_count DESC, start_date)
WHERE status = 'active' AND ticket_sales_count > 100
WITH (fillfactor = 95);

-- Event search optimization (full-text search)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_events_search
ON events USING gin(to_tsvector('english', name || ' ' || description));

-- Location-based event discovery
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_events_location
ON events(venue_id, start_date, status)
WHERE status IN ('active', 'selling');

-- Category and pricing filters
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_events_category_price
ON events(category_id, min_price, max_price, start_date)
WHERE status = 'active';

-- Ticket Operations Optimization
-- High-performance ticket lookups and operations
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tickets_user_event
ON tickets(user_id, event_id, status, created_at)
INCLUDE (tier_id, seat_number, price);

-- Ticket validation (QR code scanning)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tickets_validation
ON tickets(qr_code_hash, status)
WHERE status IN ('valid', 'used');

-- Ticket transfers
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tickets_transfers
ON tickets(original_owner_id, current_owner_id, transfer_count)
WHERE transfer_count > 0;

-- Marketplace Operations
-- Secondary market listing optimization
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_marketplace_active
ON marketplace_listings(event_id, status, price, created_at)
WHERE status = 'active'
WITH (fillfactor = 90);

-- Price range searches
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_marketplace_price_range
ON marketplace_listings(event_id, price, listing_type)
WHERE status = 'active';

-- Seller performance tracking
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_marketplace_seller
ON marketplace_listings(seller_id, status, created_at DESC)
INCLUDE (price, sold_at);

-- User Operations Optimization
-- User activity and session management
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_activity
ON users(last_login DESC, status, created_at)
WHERE status = 'active';

-- User transaction history
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_transactions
ON transactions(user_id, created_at DESC, status)
WHERE status IN ('completed', 'pending')
INCLUDE (amount, transaction_type);

-- KYC and verification status
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_verification
ON users(kyc_status, verification_level, created_at)
WHERE kyc_status IN ('pending', 'verified');

-- Payment and Financial Optimization
-- Payment processing speed
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payments_processing
ON payments(status, created_at, payment_method)
WHERE status IN ('pending', 'processing');

-- Revenue analytics
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payments_revenue
ON payments(created_at, amount, status)
WHERE status = 'completed';

-- Refund processing
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payments_refunds
ON payments(original_payment_id, refund_status, refund_requested_at)
WHERE refund_status IS NOT NULL;

-- Blockchain Operations Optimization
-- NFT minting and transfers
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_nft_operations
ON nft_transactions(transaction_signature, status, created_at DESC)
INCLUDE (mint_address, operation_type);

-- Blockchain sync status
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_blockchain_sync
ON blockchain_sync_status(block_height DESC, sync_status, updated_at);

-- Analytics and Reporting Optimization
-- Time-series analytics (partitioned by date)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_analytics_events_time
ON analytics_events(created_at, event_type)
WHERE created_at >= CURRENT_DATE - INTERVAL '90 days';

-- User behavior analytics
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_analytics_user_behavior
ON analytics_events(user_id, event_type, created_at DESC)
WHERE user_id IS NOT NULL;

-- Revenue analytics by date
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_analytics_revenue
ON analytics_events(DATE(created_at), event_type)
WHERE event_type IN ('ticket_purchased', 'payment_completed');

-- Venue Operations Optimization
-- Venue performance tracking
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_venues_performance
ON venues(id, status, capacity, created_at)
WHERE status = 'active'
INCLUDE (name, city, state);

-- Geographic venue search
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_venues_geographic
ON venues(city, state, country, status)
WHERE status = 'active';

-- Notification and Communication
-- Email queue processing
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_email_queue
ON email_queue(status, scheduled_for, priority DESC)
WHERE status IN ('pending', 'retrying');

-- Push notification delivery
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_push_notifications
ON push_notifications(user_id, status, created_at DESC)
WHERE status IN ('pending', 'sent');

-- Advanced Composite Indexes
-- Complex event filtering (location + category + price + date)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_events_complex_filter
ON events(venue_id, category_id, status, start_date, min_price)
WHERE status = 'active' AND start_date > NOW();

-- Ticket availability by tier
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tickets_availability
ON tickets(event_id, tier_id, status)
WHERE status IN ('available', 'reserved');

-- User engagement scoring
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_engagement
ON user_activity(user_id, activity_type, created_at DESC)
INCLUDE (engagement_score);

-- Fraud detection indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_fraud_detection
ON transactions(user_id, amount, created_at, ip_address)
WHERE amount > 1000 OR created_at >= NOW() - INTERVAL '1 hour';

-- Performance monitoring
SELECT 'Indexes created successfully!' as status;

-- Display index usage statistics
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_tup_read,
    idx_tup_fetch
FROM pg_stat_user_indexes 
WHERE schemaname = 'public'
ORDER BY idx_tup_read DESC
LIMIT 20;
