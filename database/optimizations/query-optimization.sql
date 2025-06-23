-- =====================================================================================
-- TICKETTOKEN QUERY OPTIMIZATION
-- Optimized queries for common operations with performance hints
-- =====================================================================================

-- Enable timing and analysis
\timing
SET work_mem = '256MB';
SET random_page_cost = 1.1;  -- SSD optimization
SET effective_cache_size = '8GB';

-- Event Discovery Optimized Queries
-- Ultra-fast event browsing with all filters

-- Hot Events Query (< 10ms target)
CREATE OR REPLACE FUNCTION get_hot_events(
    p_limit INTEGER DEFAULT 20,
    p_offset INTEGER DEFAULT 0,
    p_city TEXT DEFAULT NULL,
    p_category_id UUID DEFAULT NULL,
    p_min_price DECIMAL DEFAULT NULL,
    p_max_price DECIMAL DEFAULT NULL
)
RETURNS TABLE (
    event_id UUID,
    event_name TEXT,
    venue_name TEXT,
    start_date TIMESTAMP WITH TIME ZONE,
    min_price DECIMAL,
    max_price DECIMAL,
    availability_status TEXT,
    popularity_score NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        mv.id,
        mv.name,
        mv.venue_name,
        mv.start_date,
        mv.min_price,
        mv.max_price,
        mv.availability_status,
        mv.popularity_score
    FROM mv_event_discovery mv
    WHERE 
        (p_city IS NULL OR mv.venue_city = p_city)
        AND (p_category_id IS NULL OR mv.category_id = p_category_id)
        AND (p_min_price IS NULL OR mv.max_price >= p_min_price)
        AND (p_max_price IS NULL OR mv.min_price <= p_max_price)
        AND mv.start_date > NOW()
    ORDER BY 
        mv.popularity_score DESC,
        mv.start_date ASC
    LIMIT p_limit OFFSET p_offset;
END;
$$ LANGUAGE plpgsql STABLE;

-- Event Search Query (full-text search)
CREATE OR REPLACE FUNCTION search_events(
    p_search_term TEXT,
    p_limit INTEGER DEFAULT 20,
    p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
    event_id UUID,
    event_name TEXT,
    venue_name TEXT,
    start_date TIMESTAMP WITH TIME ZONE,
    search_rank REAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        mv.id,
        mv.name,
        mv.venue_name,
        mv.start_date,
        ts_rank(mv.search_vector, plainto_tsquery('english', p_search_term)) as rank
    FROM mv_event_discovery mv
    WHERE mv.search_vector @@ plainto_tsquery('english', p_search_term)
        AND mv.start_date > NOW()
    ORDER BY 
        ts_rank(mv.search_vector, plainto_tsquery('english', p_search_term)) DESC,
        mv.popularity_score DESC
    LIMIT p_limit OFFSET p_offset;
END;
$$ LANGUAGE plpgsql STABLE;

-- User Ticket History (optimized for pagination)
CREATE OR REPLACE FUNCTION get_user_tickets(
    p_user_id UUID,
    p_limit INTEGER DEFAULT 50,
    p_offset INTEGER DEFAULT 0,
    p_include_past BOOLEAN DEFAULT FALSE
)
RETURNS TABLE (
    ticket_id UUID,
    event_name TEXT,
    venue_name TEXT,
    start_date TIMESTAMP WITH TIME ZONE,
    ticket_status TEXT,
    price DECIMAL,
    qr_code TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        t.id,
        e.name,
        v.name,
        e.start_date,
        t.status,
        t.price,
        t.qr_code
    FROM tickets t
    JOIN events e ON t.event_id = e.id
    JOIN venues v ON e.venue_id = v.id
    WHERE t.user_id = p_user_id
        AND (p_include_past OR e.start_date > NOW())
        AND t.status IN ('valid', 'used')
    ORDER BY e.start_date DESC
    LIMIT p_limit OFFSET p_offset;
END;
$$ LANGUAGE plpgsql STABLE;

-- Marketplace Listings (high-performance secondary market)
CREATE OR REPLACE FUNCTION get_marketplace_listings(
    p_event_id UUID DEFAULT NULL,
    p_max_price DECIMAL DEFAULT NULL,
    p_listing_type TEXT DEFAULT NULL,
    p_limit INTEGER DEFAULT 50,
    p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
    listing_id UUID,
    ticket_id UUID,
    seller_id UUID,
    price DECIMAL,
    listing_type TEXT,
    created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ml.id,
        ml.ticket_id,
        ml.seller_id,
        ml.price,
        ml.listing_type,
        ml.created_at
    FROM marketplace_listings ml
    WHERE ml.status = 'active'
        AND (p_event_id IS NULL OR ml.event_id = p_event_id)
        AND (p_max_price IS NULL OR ml.price <= p_max_price)
        AND (p_listing_type IS NULL OR ml.listing_type = p_listing_type)
    ORDER BY 
        CASE 
            WHEN ml.listing_type = 'auction' THEN ml.auction_end_time
            ELSE ml.price
        END ASC
    LIMIT p_limit OFFSET p_offset;
END;
$$ LANGUAGE plpgsql STABLE;

-- Revenue Analytics Query (fast financial reporting)
CREATE OR REPLACE FUNCTION get_revenue_analytics(
    p_start_date DATE,
    p_end_date DATE,
    p_group_by TEXT DEFAULT 'day'
)
RETURNS TABLE (
    period TEXT,
    gross_revenue DECIMAL,
    platform_revenue DECIMAL,
    transaction_count BIGINT,
    avg_transaction_value DECIMAL
) AS $$
BEGIN
    IF p_group_by = 'month' THEN
        RETURN QUERY
        SELECT 
            TO_CHAR(rv.month, 'YYYY-MM') as period,
            SUM(rv.gross_revenue) as gross_revenue,
            SUM(rv.platform_revenue) as platform_revenue,
            SUM(rv.successful_transactions) as transaction_count,
            AVG(rv.avg_transaction_value) as avg_transaction_value
        FROM mv_revenue_analytics rv
        WHERE rv.date BETWEEN p_start_date AND p_end_date
        GROUP BY rv.month
        ORDER BY rv.month;
    ELSIF p_group_by = 'week' THEN
        RETURN QUERY
        SELECT 
            TO_CHAR(rv.week, 'YYYY-WW') as period,
            SUM(rv.gross_revenue) as gross_revenue,
            SUM(rv.platform_revenue) as platform_revenue,
            SUM(rv.successful_transactions) as transaction_count,
            AVG(rv.avg_transaction_value) as avg_transaction_value
        FROM mv_revenue_analytics rv
        WHERE rv.date BETWEEN p_start_date AND p_end_date
        GROUP BY rv.week
        ORDER BY rv.week;
    ELSE
        RETURN QUERY
        SELECT 
            rv.date::TEXT as period,
            rv.gross_revenue,
            rv.platform_revenue,
            rv.successful_transactions as transaction_count,
            rv.avg_transaction_value
        FROM mv_revenue_analytics rv
        WHERE rv.date BETWEEN p_start_date AND p_end_date
        ORDER BY rv.date;
    END IF;
END;
$$ LANGUAGE plpgsql STABLE;

-- Venue Performance Dashboard
CREATE OR REPLACE FUNCTION get_venue_dashboard(p_venue_id UUID)
RETURNS TABLE (
    venue_name TEXT,
    total_events BIGINT,
    upcoming_events BIGINT,
    total_revenue DECIMAL,
    avg_capacity_utilization NUMERIC,
    avg_rating NUMERIC,
    last_30_days_revenue DECIMAL,
    last_30_days_events BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        vp.venue_name,
        vp.total_events,
        vp.upcoming_events,
        vp.total_revenue,
        vp.avg_capacity_utilization,
        vp.avg_rating,
        
        -- Last 30 days metrics (computed on demand)
        (SELECT COALESCE(SUM(t.price), 0) 
         FROM tickets t 
         JOIN events e ON t.event_id = e.id 
         WHERE e.venue_id = p_venue_id 
           AND t.created_at >= NOW() - INTERVAL '30 days'
           AND t.status = 'valid') as last_30_days_revenue,
           
        (SELECT COUNT(DISTINCT e.id)
         FROM events e
         WHERE e.venue_id = p_venue_id
           AND e.created_at >= NOW() - INTERVAL '30 days') as last_30_days_events
           
    FROM mv_venue_performance vp
    WHERE vp.venue_id = p_venue_id;
END;
$$ LANGUAGE plpgsql STABLE;

-- Fraud Detection Query
CREATE OR REPLACE FUNCTION detect_suspicious_activity(
    p_lookback_hours INTEGER DEFAULT 24
)
RETURNS TABLE (
    user_id UUID,
    suspicious_score INTEGER,
    total_transactions BIGINT,
    total_amount DECIMAL,
    unique_ips BIGINT,
    rapid_purchases BIGINT
) AS $$
BEGIN
    RETURN QUERY
    WITH suspicious_users AS (
        SELECT 
            t.user_id,
            COUNT(*) as transaction_count,
            SUM(p.amount) as total_spent,
            COUNT(DISTINCT p.ip_address) as unique_ip_count,
            COUNT(*) FILTER (
                WHERE t.created_at > NOW() - INTERVAL '1 hour'
            ) as recent_purchases
        FROM transactions t
        JOIN payments p ON t.id = p.transaction_id
        WHERE t.created_at >= NOW() - (p_lookback_hours || ' hours')::INTERVAL
            AND t.status = 'completed'
        GROUP BY t.user_id
    )
    SELECT 
        su.user_id,
        (
            CASE WHEN su.transaction_count > 10 THEN 20 ELSE 0 END +
            CASE WHEN su.total_spent > 5000 THEN 30 ELSE 0 END +
            CASE WHEN su.unique_ip_count > 5 THEN 25 ELSE 0 END +
            CASE WHEN su.recent_purchases > 5 THEN 35 ELSE 0 END
        ) as suspicious_score,
        su.transaction_count,
        su.total_spent,
        su.unique_ip_count,
        su.recent_purchases
    FROM suspicious_users su
    WHERE (
        su.transaction_count > 10 OR
        su.total_spent > 5000 OR
        su.unique_ip_count > 5 OR
        su.recent_purchases > 5
    )
    ORDER BY suspicious_score DESC;
END;
$$ LANGUAGE plpgsql STABLE;

-- Performance Testing Function
CREATE OR REPLACE FUNCTION test_query_performance()
RETURNS TABLE (
    query_name TEXT,
    execution_time_ms NUMERIC,
    rows_returned BIGINT
) AS $$
DECLARE
    start_time TIMESTAMP;
    end_time TIMESTAMP;
    row_count BIGINT;
BEGIN
    -- Test event discovery
    start_time := clock_timestamp();
    SELECT COUNT(*) INTO row_count FROM get_hot_events(20, 0);
    end_time := clock_timestamp();
    RETURN QUERY SELECT 'get_hot_events', EXTRACT(MILLISECONDS FROM (end_time - start_time)), row_count;
    
    -- Test search
    start_time := clock_timestamp();
    SELECT COUNT(*) INTO row_count FROM search_events('music concert', 20, 0);
    end_time := clock_timestamp();
    RETURN QUERY SELECT 'search_events', EXTRACT(MILLISECONDS FROM (end_time - start_time)), row_count;
    
    -- Test marketplace
    start_time := clock_timestamp();
    SELECT COUNT(*) INTO row_count FROM get_marketplace_listings();
    end_time := clock_timestamp();
    RETURN QUERY SELECT 'get_marketplace_listings', EXTRACT(MILLISECONDS FROM (end_time - start_time)), row_count;
    
END;
$$ LANGUAGE plpgsql;

-- Database maintenance functions
CREATE OR REPLACE FUNCTION optimize_database()
RETURNS void AS $$
BEGIN
    -- Update table statistics
    ANALYZE;
    
    -- Reindex heavily used indexes
    REINDEX INDEX CONCURRENTLY idx_events_discovery;
    REINDEX INDEX CONCURRENTLY idx_tickets_user_event;
    REINDEX INDEX CONCURRENTLY idx_marketplace_active;
    
    -- Vacuum analyze for maintenance
    VACUUM ANALYZE events;
    VACUUM ANALYZE tickets;
    VACUUM ANALYZE marketplace_listings;
    VACUUM ANALYZE transactions;
    
    RAISE NOTICE 'Database optimization completed at %', NOW();
END;
$$ LANGUAGE plpgsql;

-- Schedule database maintenance
SELECT cron.schedule('weekly-database-optimization', '0 2 * * 0', 
    'SELECT optimize_database();'
);

SELECT 'Query optimization functions created successfully!' as status;

-- Show query performance baseline
SELECT * FROM test_query_performance();
