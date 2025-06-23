-- =====================================================================================
-- TICKETTOKEN TABLE PARTITIONING
-- Optimizes large tables for better performance and maintenance
-- =====================================================================================

-- Enable timing
\timing

-- Analytics Events Partitioning (by month)
-- This table grows very large with user activity tracking
CREATE TABLE IF NOT EXISTS analytics_events_partitioned (
    id BIGSERIAL,
    event_type VARCHAR(50) NOT NULL,
    user_id UUID,
    session_id VARCHAR(100),
    event_data JSONB,
    ip_address INET,
    user_agent TEXT,
    referrer TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Partition key
    CONSTRAINT analytics_events_partitioned_pkey PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

-- Create monthly partitions for current and future months
DO $$
DECLARE
    start_date DATE;
    end_date DATE;
    table_name TEXT;
    month_year TEXT;
BEGIN
    -- Create partitions for last 6 months, current month, and next 6 months
    FOR i IN -6..6 LOOP
        start_date := DATE_TRUNC('month', CURRENT_DATE + (i || ' months')::INTERVAL);
        end_date := start_date + INTERVAL '1 month';
        month_year := TO_CHAR(start_date, 'YYYY_MM');
        table_name := 'analytics_events_' || month_year;
        
        EXECUTE format('
            CREATE TABLE IF NOT EXISTS %I PARTITION OF analytics_events_partitioned
            FOR VALUES FROM (%L) TO (%L)
        ', table_name, start_date, end_date);
        
        -- Create indexes on each partition
        EXECUTE format('
            CREATE INDEX IF NOT EXISTS %I ON %I (event_type, user_id, created_at)
        ', 'idx_' || table_name || '_event_user', table_name);
        
        EXECUTE format('
            CREATE INDEX IF NOT EXISTS %I ON %I (created_at DESC)
        ', 'idx_' || table_name || '_time', table_name);
        
    END LOOP;
END $$;

-- Transaction History Partitioning (by quarter)
CREATE TABLE IF NOT EXISTS transactions_partitioned (
    id BIGSERIAL,
    user_id UUID NOT NULL,
    event_id UUID,
    ticket_id UUID,
    amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',
    status VARCHAR(20) NOT NULL,
    payment_method VARCHAR(50),
    transaction_type VARCHAR(30) NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT transactions_partitioned_pkey PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

-- Create quarterly partitions
DO $$
DECLARE
    start_date DATE;
    end_date DATE;
    table_name TEXT;
    quarter_year TEXT;
BEGIN
    -- Create partitions for last 4 quarters, current quarter, and next 4 quarters
    FOR i IN -4..4 LOOP
        start_date := DATE_TRUNC('quarter', CURRENT_DATE + (i * 3 || ' months')::INTERVAL);
        end_date := start_date + INTERVAL '3 months';
        quarter_year := TO_CHAR(start_date, 'YYYY_Q');
        table_name := 'transactions_' || quarter_year;
        
        EXECUTE format('
            CREATE TABLE IF NOT EXISTS %I PARTITION OF transactions_partitioned
            FOR VALUES FROM (%L) TO (%L)
        ', table_name, start_date, end_date);
        
        -- Create indexes on each partition
        EXECUTE format('
            CREATE INDEX IF NOT EXISTS %I ON %I (user_id, status, created_at DESC)
        ', 'idx_' || table_name || '_user_status', table_name);
        
        EXECUTE format('
            CREATE INDEX IF NOT EXISTS %I ON %I (status, payment_method, created_at)
        ', 'idx_' || table_name || '_status_method', table_name);
        
    END LOOP;
END $$;

-- Email Queue Partitioning (by week)
CREATE TABLE IF NOT EXISTS email_queue_partitioned (
    id BIGSERIAL,
    user_id UUID,
    email_address VARCHAR(255) NOT NULL,
    subject VARCHAR(500) NOT NULL,
    body_text TEXT,
    body_html TEXT,
    status VARCHAR(20) DEFAULT 'pending',
    priority INTEGER DEFAULT 5,
    scheduled_for TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    sent_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT email_queue_partitioned_pkey PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

-- Create weekly partitions for email queue (high volume)
DO $$
DECLARE
    start_date DATE;
    end_date DATE;
    table_name TEXT;
    week_year TEXT;
BEGIN
    -- Create partitions for last 4 weeks, current week, and next 4 weeks
    FOR i IN -4..4 LOOP
        start_date := DATE_TRUNC('week', CURRENT_DATE + (i || ' weeks')::INTERVAL);
        end_date := start_date + INTERVAL '1 week';
        week_year := TO_CHAR(start_date, 'YYYY_WW');
        table_name := 'email_queue_' || week_year;
        
        EXECUTE format('
            CREATE TABLE IF NOT EXISTS %I PARTITION OF email_queue_partitioned
            FOR VALUES FROM (%L) TO (%L)
        ', table_name, start_date, end_date);
        
        -- Create indexes on each partition
        EXECUTE format('
            CREATE INDEX IF NOT EXISTS %I ON %I (status, priority DESC, scheduled_for)
        ', 'idx_' || table_name || '_processing', table_name);
        
    END LOOP;
END $$;

-- Automatic Partition Management Function
CREATE OR REPLACE FUNCTION create_monthly_partition(table_prefix TEXT, months_ahead INTEGER DEFAULT 1)
RETURNS void AS $$
DECLARE
    start_date DATE;
    end_date DATE;
    table_name TEXT;
    month_year TEXT;
BEGIN
    start_date := DATE_TRUNC('month', CURRENT_DATE + (months_ahead || ' months')::INTERVAL);
    end_date := start_date + INTERVAL '1 month';
    month_year := TO_CHAR(start_date, 'YYYY_MM');
    table_name := table_prefix || '_' || month_year;
    
    EXECUTE format('
        CREATE TABLE IF NOT EXISTS %I PARTITION OF %I_partitioned
        FOR VALUES FROM (%L) TO (%L)
    ', table_name, table_prefix, start_date, end_date);
    
    RAISE NOTICE 'Created partition: %', table_name;
END;
$$ LANGUAGE plpgsql;

-- Automatic Partition Cleanup Function
CREATE OR REPLACE FUNCTION cleanup_old_partitions(table_prefix TEXT, retention_months INTEGER DEFAULT 12)
RETURNS void AS $$
DECLARE
    cutoff_date DATE;
    partition_name TEXT;
    partition_record RECORD;
BEGIN
    cutoff_date := CURRENT_DATE - (retention_months || ' months')::INTERVAL;
    
    FOR partition_record IN
        SELECT schemaname, tablename 
        FROM pg_tables 
        WHERE tablename LIKE table_prefix || '_%'
        AND schemaname = 'public'
    LOOP
        -- Extract date from partition name and check if it's old enough
        -- This is simplified - in production you'd want more robust date parsing
        IF partition_record.tablename ~ table_prefix || '_\d{4}_\d{2}' THEN
            EXECUTE format('DROP TABLE IF EXISTS %I CASCADE', partition_record.tablename);
            RAISE NOTICE 'Dropped old partition: %', partition_record.tablename;
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Schedule partition maintenance (requires pg_cron extension)
-- Create next month's partitions
SELECT cron.schedule('create-monthly-partitions', '0 0 25 * *', 
    'SELECT create_monthly_partition(''analytics_events'', 2);'
);

-- Cleanup old partitions quarterly
SELECT cron.schedule('cleanup-old-partitions', '0 2 1 */3 *', 
    'SELECT cleanup_old_partitions(''analytics_events'', 24);'
);

-- Performance summary
SELECT 'Partitioning setup complete!' as status;

-- Show partition information
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables 
WHERE tablename LIKE '%_partitioned' OR tablename LIKE '%_202%'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
