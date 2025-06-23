-- =====================================================================================
-- TICKETTOKEN DATABASE PERFORMANCE MONITORING
-- Comprehensive monitoring for database performance and health
-- =====================================================================================

-- Query Performance Monitoring View
CREATE OR REPLACE VIEW v_query_performance AS
SELECT 
    query,
    calls,
    total_time,
    mean_time,
    max_time,
    stddev_time,
    rows,
    100.0 * shared_blks_hit / nullif(shared_blks_hit + shared_blks_read, 0) AS hit_percent
FROM pg_stat_statements
WHERE calls > 10
ORDER BY total_time DESC;

-- Index Usage Monitoring
CREATE OR REPLACE VIEW v_index_usage AS
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_tup_read,
    idx_tup_fetch,
    idx_scan,
    CASE 
        WHEN idx_scan = 0 THEN 'UNUSED'
        WHEN idx_tup_read < 1000 THEN 'LOW_USAGE'
        ELSE 'ACTIVE'
    END as usage_category
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_tup_read DESC;

-- Table Size and Bloat Monitoring
CREATE OR REPLACE VIEW v_table_stats AS
SELECT 
    schemaname,
    tablename,
    n_tup_ins as inserts,
    n_tup_upd as updates,
    n_tup_del as deletes,
    n_live_tup as live_tuples,
    n_dead_tup as dead_tuples,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as total_size,
    CASE 
        WHEN n_live_tup > 0 THEN 
            round(100.0 * n_dead_tup / (n_live_tup + n_dead_tup), 2)
        ELSE 0 
    END as dead_tuple_percent
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Connection and Lock Monitoring
CREATE OR REPLACE VIEW v_connection_stats AS
SELECT 
    state,
    COUNT(*) as connection_count,
    AVG(EXTRACT(EPOCH FROM (NOW() - query_start))) as avg_query_duration_seconds
FROM pg_stat_activity 
WHERE state IS NOT NULL
GROUP BY state;

-- Performance Alert Functions
CREATE OR REPLACE FUNCTION check_performance_alerts()
RETURNS TABLE (
    alert_type TEXT,
    severity TEXT,
    message TEXT,
    metric_value NUMERIC
) AS $$
BEGIN
    -- Slow queries alert
    RETURN QUERY
    SELECT 
        'SLOW_QUERY'::TEXT,
        'HIGH'::TEXT,
        'Query exceeds 5 second average: ' || substring(query, 1, 100),
        mean_time
    FROM pg_stat_statements
    WHERE mean_time > 5000 AND calls > 5;
    
    -- High dead tuple percentage
    RETURN QUERY
    SELECT 
        'TABLE_BLOAT'::TEXT,
        'MEDIUM'::TEXT,
        'Table has high dead tuple percentage: ' || tablename,
        dead_tuple_percent
    FROM v_table_stats
    WHERE dead_tuple_percent > 20;
    
    -- Unused indexes
    RETURN QUERY
    SELECT 
        'UNUSED_INDEX'::TEXT,
        'LOW'::TEXT,
        'Index is not being used: ' || indexname,
        idx_scan::NUMERIC
    FROM v_index_usage
    WHERE usage_category = 'UNUSED';
    
    -- Low cache hit ratio
    RETURN QUERY
    SELECT 
        'LOW_CACHE_HIT'::TEXT,
        'HIGH'::TEXT,
        'Query has low cache hit ratio: ' || substring(query, 1, 100),
        hit_percent
    FROM v_query_performance
    WHERE hit_percent < 95 AND calls > 50;
    
END;
$$ LANGUAGE plpgsql;

-- Performance Dashboard Function
CREATE OR REPLACE FUNCTION get_performance_dashboard()
RETURNS TABLE (
    metric_category TEXT,
    metric_name TEXT,
    metric_value TEXT,
    status TEXT
) AS $$
BEGIN
    -- Database size metrics
    RETURN QUERY
    SELECT 
        'DATABASE'::TEXT,
        'Total Size'::TEXT,
        pg_size_pretty(pg_database_size(current_database())),
        'INFO'::TEXT;
    
    -- Connection metrics
    RETURN QUERY
    SELECT 
        'CONNECTIONS'::TEXT,
        'Active Connections'::TEXT,
        COUNT(*)::TEXT,
        CASE WHEN COUNT(*) > 80 THEN 'WARNING' ELSE 'OK' END
    FROM pg_stat_activity 
    WHERE state = 'active';
    
    -- Query performance metrics
    RETURN QUERY
    SELECT 
        'PERFORMANCE'::TEXT,
        'Avg Query Time (ms)'::TEXT,
        ROUND(AVG(mean_time), 2)::TEXT,
        CASE WHEN AVG(mean_time) > 1000 THEN 'WARNING' ELSE 'OK' END
    FROM pg_stat_statements
    WHERE calls > 10;
    
    -- Cache hit ratio
    RETURN QUERY
    SELECT 
        'CACHE'::TEXT,
        'Buffer Hit Ratio (%)'::TEXT,
        ROUND(
            100.0 * SUM(blks_hit) / NULLIF(SUM(blks_hit + blks_read), 0), 2
        )::TEXT,
        CASE 
            WHEN 100.0 * SUM(blks_hit) / NULLIF(SUM(blks_hit + blks_read), 0) < 95 
            THEN 'WARNING' 
            ELSE 'OK' 
        END
    FROM pg_stat_database
    WHERE datname = current_database();
    
    -- Largest tables
    RETURN QUERY
    SELECT 
        'STORAGE'::TEXT,
        'Largest Table: ' || tablename,
        total_size,
        CASE 
            WHEN pg_total_relation_size(schemaname||'.'||tablename) > 10737418240 
            THEN 'WARNING'  -- 10GB
            ELSE 'OK' 
        END
    FROM v_table_stats
    LIMIT 1;
    
END;
$$ LANGUAGE plpgsql;

-- Automated Performance Reporting
CREATE TABLE IF NOT EXISTS performance_reports (
    id SERIAL PRIMARY KEY,
    report_date DATE DEFAULT CURRENT_DATE,
    report_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION generate_daily_performance_report()
RETURNS void AS $$
DECLARE
    report_data JSONB;
BEGIN
    SELECT jsonb_build_object(
        'dashboard', (SELECT jsonb_agg(row_to_json(d)) FROM get_performance_dashboard() d),
        'alerts', (SELECT jsonb_agg(row_to_json(a)) FROM check_performance_alerts() a),
        'top_queries', (
            SELECT jsonb_agg(row_to_json(q)) 
            FROM (
                SELECT query, calls, total_time, mean_time, hit_percent
                FROM v_query_performance 
                LIMIT 10
            ) q
        ),
        'table_stats', (
            SELECT jsonb_agg(row_to_json(t))
            FROM (
                SELECT tablename, total_size, dead_tuple_percent
                FROM v_table_stats
                WHERE dead_tuple_percent > 10
                LIMIT 20
            ) t
        ),
        'generated_at', NOW()
    ) INTO report_data;
    
    INSERT INTO performance_reports (report_data)
    VALUES (report_data);
    
    -- Clean up old reports (keep 90 days)
    DELETE FROM performance_reports 
    WHERE created_at < NOW() - INTERVAL '90 days';
    
END;
$$ LANGUAGE plpgsql;

-- Schedule daily performance reports
SELECT cron.schedule('daily-performance-report', '0 6 * * *', 
    'SELECT generate_daily_performance_report();'
);

-- Real-time monitoring functions
CREATE OR REPLACE FUNCTION get_real_time_stats()
RETURNS TABLE (
    active_connections INTEGER,
    running_queries INTEGER,
    cache_hit_ratio NUMERIC,
    avg_query_time_ms NUMERIC,
    transactions_per_second NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        (SELECT COUNT(*)::INTEGER FROM pg_stat_activity WHERE state = 'active'),
        (SELECT COUNT(*)::INTEGER FROM pg_stat_activity WHERE state = 'active' AND query_start < NOW() - INTERVAL '30 seconds'),
        (SELECT ROUND(100.0 * SUM(blks_hit) / NULLIF(SUM(blks_hit + blks_read), 0), 2) FROM pg_stat_database WHERE datname = current_database()),
        (SELECT ROUND(AVG(mean_time), 2) FROM pg_stat_statements WHERE calls > 1),
        (SELECT ROUND(SUM(xact_commit + xact_rollback) / EXTRACT(EPOCH FROM (NOW() - stats_reset)), 2) FROM pg_stat_database WHERE datname = current_database());
END;
$$ LANGUAGE plpgsql;

SELECT 'Database monitoring setup complete!' as status;

-- Show current performance dashboard
SELECT * FROM get_performance_dashboard();
