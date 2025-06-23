#!/bin/bash

echo "🔧 TICKETTOKEN DATABASE MAINTENANCE"
echo "=================================="

DB_HOST=${DB_HOST:-localhost}
DB_PORT=${DB_PORT:-5432}
DB_NAME=${DB_NAME:-tickettoken}
DB_USER=${DB_USER:-postgres}

# Function to execute SQL command
execute_sql_command() {
    local command=$1
    local description=$2
    
    echo "🔧 $description..."
    psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "$command"
}

echo "📊 Running database maintenance tasks..."

# Update statistics
execute_sql_command "ANALYZE;" "Updating table statistics"

# Refresh materialized views
execute_sql_command "SELECT refresh_materialized_views();" "Refreshing materialized views"

# Run optimization function
execute_sql_command "SELECT optimize_database();" "Running database optimization"

# Generate performance report
execute_sql_command "SELECT generate_daily_performance_report();" "Generating performance report"

# Show current performance
echo ""
echo "📊 Current Performance Metrics:"
psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "SELECT * FROM get_performance_dashboard();"

echo ""
echo "🚨 Performance Alerts:"
psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "SELECT * FROM check_performance_alerts();"

echo ""
echo "✅ Database maintenance completed!"
