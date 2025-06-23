#!/bin/bash

# Test TicketToken Event Service
BACKEND_URL=${BACKEND_URL:-"http://localhost:3001"}

echo "🚀 Testing TicketToken Event Service at $BACKEND_URL"

# Test 1: Health Check
echo "Testing health endpoint..."
curl -s "$BACKEND_URL/health"
echo ""

# Test 2: Events API
echo "Testing events API..."
curl -s "$BACKEND_URL/api/events"
echo ""

# Test 3: Create Event
echo "Creating test event..."
curl -s -X POST "$BACKEND_URL/api/events" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Load Test Event",
    "venue": "Test Venue", 
    "date": "'$(date -d '+7 days' -Iseconds)'",
    "capacity": 100,
    "price": 50.00
  }'
echo ""

echo "✅ Basic tests completed!"
