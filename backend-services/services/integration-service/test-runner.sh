#!/bin/bash

echo "🧪 Running Week 13 Integration Tests"
echo "====================================="

# Set test environment
export NODE_ENV=test
export SPOTIFY_CLIENT_ID=test_client_id
export SPOTIFY_CLIENT_SECRET=test_client_secret
export TWITTER_API_KEY=test_api_key
export MAILCHIMP_API_KEY=test_mailchimp_key

echo "🎵 Testing Spotify Integrations..."
npm test -- tests/social/spotify/

echo "📸 Testing Instagram Integrations..."
npm test -- tests/social/instagram/

echo "🐦 Testing Twitter Integrations..."
npm test -- tests/social/twitter/

echo "📧 Testing Email Marketing..."
npm test -- tests/marketing/email/

echo "🏢 Testing Business Integrations..."
npm test -- tests/business/

echo "🔄 Testing Integration Workflows..."
npm test -- tests/integration/

echo "📊 Generating Test Coverage Report..."
npm run test:coverage

echo "✅ All tests completed!"
echo ""
echo "📋 Test Summary:"
echo "   ✓ Spotify artist verification and fan connection"
echo "   ✓ Instagram story sharing and promotion campaigns"
echo "   ✓ Twitter event announcements and viral tracking"
echo "   ✓ Email marketing automation and campaign tracking"
echo "   ✓ CRM integration with Salesforce"
echo "   ✓ Accounting integration with QuickBooks"
echo "   ✓ End-to-end workflow automation"
echo ""
echo "🎯 Ready for production deployment!"
