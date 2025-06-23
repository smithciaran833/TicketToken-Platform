-- =====================================================================================
-- TICKETTOKEN MATERIALIZED VIEWS
-- Pre-computed views for high-performance analytics and reporting
-- =====================================================================================

-- Enable timing
\timing

-- Event Discovery Materialized View
-- Ultra-fast event browsing and search
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_event_discovery AS
SELECT 
    e.id,
    e.name,
    e.slug,
    e.description,
    e.start_date,
    e.end_date,
    e.status,
    e.image_url,
    e.min_price,
    e.max_price,
    e.total_tickets,
    e.available_tickets,
    e.ticket_sales_count,
    e.created_at,
    
    -- Venue information
    v.id as venue_id,
    v.name as venue_name,
    v.address as venue_address,
    v.city as venue_city,
    v.state as venue_state,
    v.country as venue_country,
    v.capacity as venue_capacity,
    v.latitude as venue_latitude,
    v.longitude as venue_longitude,
    
    -- Category information
    c.id as category_id,
    c.name as category_name,
    c.slug as category_slug,
    
    -- Artist information (if applicable)
    a.id as artist_id,
    a.name as artist_name,
    a.verified as artist_verified,
    
    -- Computed fields for search and ranking
    CASE 
        WHEN e.start_date <= NOW() + INTERVAL '24 hours' THEN 'urgent'
        WHEN e.start_date <= NOW() + INTERVAL '7 days' THEN 'soon'
        WHEN e.start_date <= NOW() + INTERVAL '30 days' THEN 'upcoming'
        ELSE 'future'
    END as urgency,
    
    CASE
        WHEN e.available_tickets::float / e.total_tickets < 0.1 THEN 'almost_sold_out'
        WHEN e.available_tickets::float / e.total_tickets < 0.3 THEN 'selling_fast'
        ELSE 'available'
    END as availability_status,
    
    -- Search vector for full-text search
    to_tsvector('english', 
        COALESCE(e.name, '') || ' ' || 
        COALESCE(e.description, '') || ' ' ||
        COALESCE(v.name, '') || ' ' ||
        COALESCE(v.city, '') || ' ' ||
        COALESCE(c.name, '') || ' ' ||
        COALESCE(a.name, '')
    ) as search_vector,
    
    -- Popularity score (weighted algorithm)
    (
        COALESCE(e.ticket_sales_count, 0) * 0.4 +
        COALESCE(e.view_count, 0) * 0.2 +
        COALESCE(e.wishlist_count, 0) * 0.3 +
        CASE WHEN a.verified THEN 100 ELSE 0 END * 0.1
    ) as popularity_score
    
FROM events e
JOIN venues v ON e.venue_id = v.id
JOIN categories c ON e.category_id = c.id
LEFT JOIN artists a ON e.artist_id = a.id
WHERE e.status = 'active' 
  AND e.start_date > NOW()
  AND v.status = 'active'
ORDER BY e.start_date ASC, popularity_score DESC;

-- Create unique index for concurrent refresh
CREATE UNIQUE INDEX IF NOT EXISTS mv_event_discovery_unique_idx ON mv_event_discovery (id);

-- Create additional indexes for fast filtering
CREATE INDEX IF NOT EXISTS mv_event_discovery_location_idx ON mv_event_discovery (venue_city, venue_state, start_date);
CREATE INDEX IF NOT EXISTS mv_event_discovery_category_idx ON mv_event_discovery (category_id, start_date);
CREATE INDEX IF NOT EXISTS mv_event_discovery_price_idx ON mv_event_discovery (min_price, max_price);
CREATE INDEX IF NOT EXISTS mv_event_discovery_search_idx ON mv_event_discovery USING gin(search_vector);
CREATE INDEX IF NOT EXISTS mv_event_discovery_popularity_idx ON mv_event_discovery (popularity_score DESC);

-- User Analytics Materialized View
-- Pre-computed user behavior and engagement metrics
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_user_analytics AS
SELECT 
    u.id as user_id,
    u.email,
    u.created_at as user_created_at,
    u.last_login,
    u.status as user_status,
    u.kyc_status,
    
    -- Ticket purchase statistics
    COUNT(DISTINCT t.id) as total_tickets_purchased,
    COUNT(DISTINCT t.event_id) as unique_events_attended,
    COALESCE(SUM(t.price), 0) as total_spent,
    COALESCE(AVG(t.price), 0) as avg_ticket_price,
    MIN(t.created_at) as first_purchase_date,
    MAX(t.created_at) as last_purchase_date,
    
    -- Event preferences
    MODE() WITHIN GROUP (ORDER BY c.name) as favorite_category,
    MODE() WITHIN GROUP (ORDER BY v.city) as favorite_city,
    
    -- Engagement metrics
    COUNT(DISTINCT DATE(ae.created_at)) as active_days_last_90,
    COUNT(ae.id) FILTER (WHERE ae.event_type = 'page_view') as page_views_last_90,
    COUNT(ae.id) FILTER (WHERE ae.event_type = 'search') as searches_last_90,
    
    -- Behavioral scoring
    CASE 
        WHEN COUNT(DISTINCT t.id) >= 10 THEN 'power_user'
        WHEN COUNT(DISTINCT t.id) >= 3 THEN 'regular_user'
        WHEN COUNT(DISTINCT t.id) >= 1 THEN 'occasional_user'
        ELSE 'new_user'
    END as user_segment,
    
    -- Loyalty score
    (
        COUNT(DISTINCT t.id) * 10 +
        COUNT(DISTINCT t.event_id) * 5 +
        COUNT(DISTINCT DATE(ae.created_at)) * 2
    ) as loyalty_score
    
FROM users u
LEFT JOIN tickets t ON u.id = t.user_id AND t.status = 'valid'
LEFT JOIN events e ON t.event_id = e.id
LEFT JOIN venues v ON e.venue_id = v.id
LEFT JOIN categories c ON e.category_id = c.id
LEFT JOIN analytics_events ae ON u.id = ae.user_id 
    AND ae.created_at >= NOW() - INTERVAL '90 days'
WHERE u.status = 'active'
GROUP BY u.id, u.email, u.created_at, u.last_login, u.status, u.kyc_status;

-- Create indexes for user analytics
CREATE UNIQUE INDEX IF NOT EXISTS mv_user_analytics_unique_idx ON mv_user_analytics (user_id);
CREATE INDEX IF NOT EXISTS mv_user_analytics_segment_idx ON mv_user_analytics (user_segment, loyalty_score DESC);
CREATE INDEX IF NOT EXISTS mv_user_analytics_spending_idx ON mv_user_analytics (total_spent DESC);

-- Revenue Analytics Materialized View
-- Financial performance and trends
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_revenue_analytics AS
SELECT 
    DATE(p.created_at) as date,
    DATE_TRUNC('week', p.created_at) as week,
    DATE_TRUNC('month', p.created_at) as month,
    
    -- Revenue metrics
    COUNT(*) as total_transactions,
    COUNT(*) FILTER (WHERE p.status = 'completed') as successful_transactions,
    COUNT(*) FILTER (WHERE p.status = 'failed') as failed_transactions,
    
    SUM(p.amount) FILTER (WHERE p.status = 'completed') as gross_revenue,
    SUM(p.platform_fee) FILTER (WHERE p.status = 'completed') as platform_revenue,
    AVG(p.amount) FILTER (WHERE p.status = 'completed') as avg_transaction_value,
    
    -- Payment method breakdown
    COUNT(*) FILTER (WHERE p.payment_method = 'credit_card') as credit_card_payments,
    COUNT(*) FILTER (WHERE p.payment_method = 'crypto') as crypto_payments,
    COUNT(*) FILTER (WHERE p.payment_method = 'bank_transfer') as bank_transfer_payments,
    
    -- Refund metrics
    COUNT(*) FILTER (WHERE p.refund_status = 'completed') as refunds_processed,
    SUM(p.refund_amount) FILTER (WHERE p.refund_status = 'completed') as total_refunded,
    
    -- Geographic revenue
    json_agg(DISTINCT jsonb_build_object(
        'city', v.city,
        'state', v.state,
        'revenue', SUM(p.amount) FILTER (WHERE p.status = 'completed')
    )) as revenue_by_location
    
FROM payments p
JOIN tickets t ON p.ticket_id = t.id
JOIN events e ON t.event_id = e.id
JOIN venues v ON e.venue_id = v.id
WHERE p.created_at >= CURRENT_DATE - INTERVAL '365 days'
GROUP BY DATE(p.created_at), DATE_TRUNC('week', p.created_at), DATE_TRUNC('month', p.created_at);

-- Create indexes for revenue analytics
CREATE UNIQUE INDEX IF NOT EXISTS mv_revenue_analytics_unique_idx ON mv_revenue_analytics (date);
CREATE INDEX IF NOT EXISTS mv_revenue_analytics_week_idx ON mv_revenue_analytics (week);
CREATE INDEX IF NOT EXISTS mv_revenue_analytics_month_idx ON mv_revenue_analytics (month);

-- Venue Performance Materialized View
-- Venue analytics and performance metrics
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_venue_performance AS
SELECT 
    v.id as venue_id,
    v.name as venue_name,
    v.city,
    v.state,
    v.capacity,
    
    -- Event statistics
    COUNT(DISTINCT e.id) as total_events,
    COUNT(DISTINCT e.id) FILTER (WHERE e.status = 'completed') as completed_events,
    COUNT(DISTINCT e.id) FILTER (WHERE e.start_date > NOW()) as upcoming_events,
    
    -- Ticket sales
    COUNT(DISTINCT t.id) as total_tickets_sold,
    SUM(t.price) as total_revenue,
    AVG(t.price) as avg_ticket_price,
    
    -- Capacity utilization
    AVG(
        (COUNT(DISTINCT t.id)::float / NULLIF(e.total_tickets, 0)) * 100
    ) as avg_capacity_utilization,
    
    -- Performance metrics
    AVG(e.ticket_sales_count) as avg_tickets_per_event,
    MAX(e.ticket_sales_count) as best_selling_event_tickets,
    
    -- Rating and reviews (if applicable)
    AVG(r.rating) as avg_rating,
    COUNT(r.id) as total_reviews,
    
    -- Time-based performance
    MIN(e.created_at) as first_event_date,
    MAX(e.created_at) as last_event_date
    
FROM venues v
LEFT JOIN events e ON v.id = e.venue_id
LEFT JOIN tickets t ON e.id = t.event_id AND t.status = 'valid'
LEFT JOIN reviews r ON v.id = r.venue_id
WHERE v.status = 'active'
GROUP BY v.id, v.name, v.city, v.state, v.capacity;

-- Create indexes for venue performance
CREATE UNIQUE INDEX IF NOT EXISTS mv_venue_performance_unique_idx ON mv_venue_performance (venue_id);
CREATE INDEX IF NOT EXISTS mv_venue_performance_location_idx ON mv_venue_performance (city, state);
CREATE INDEX IF NOT EXISTS mv_venue_performance_revenue_idx ON mv_venue_performance (total_revenue DESC);

-- Automated Refresh Functions
CREATE OR REPLACE FUNCTION refresh_materialized_views()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_event_discovery;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_user_analytics;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_revenue_analytics;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_venue_performance;
    
    -- Update last refresh timestamp
    INSERT INTO materialized_view_refresh_log (view_name, refreshed_at)
    VALUES 
        ('mv_event_discovery', NOW()),
        ('mv_user_analytics', NOW()),
        ('mv_revenue_analytics', NOW()),
        ('mv_venue_performance', NOW())
    ON CONFLICT (view_name) DO UPDATE SET refreshed_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Create refresh log table
CREATE TABLE IF NOT EXISTS materialized_view_refresh_log (
    view_name VARCHAR(100) PRIMARY KEY,
    refreshed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Schedule regular refreshes (requires pg_cron)
SELECT cron.schedule('refresh-event-discovery', '*/5 * * * *', 
    'REFRESH MATERIALIZED VIEW CONCURRENTLY mv_event_discovery;'
);

SELECT cron.schedule('refresh-user-analytics', '0 * * * *', 
    'REFRESH MATERIALIZED VIEW CONCURRENTLY mv_user_analytics;'
);

SELECT cron.schedule('refresh-revenue-analytics', '0 0 * * *', 
    'REFRESH MATERIALIZED VIEW CONCURRENTLY mv_revenue_analytics;'
);

SELECT cron.schedule('refresh-venue-performance', '0 2 * * *', 
    'REFRESH MATERIALIZED VIEW CONCURRENTLY mv_venue_performance;'
);

-- Performance summary
SELECT 'Materialized views created successfully!' as status;

-- Show materialized view sizes
SELECT 
    schemaname,
    matviewname,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||matviewname)) as size,
    pg_stat_get_tuples(c.oid) as row_count
FROM pg_matviews mv
JOIN pg_class c ON c.relname = mv.matviewname
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||matviewname) DESC;
