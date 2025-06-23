#!/bin/bash

echo "⚡ Quick Week 13 Integration Test"

# Test core functionality without full setup
echo "🔧 Testing core functions..."

# Mock test - just verify files exist and are syntactically correct
echo "📁 Checking file structure..."
ls -la src/social/spotify/ && echo "✅ Spotify files exist"
ls -la src/social/instagram/ && echo "✅ Instagram files exist" 
ls -la src/social/twitter/ && echo "✅ Twitter files exist"
ls -la src/marketing/email/ && echo "✅ Email marketing files exist"
ls -la src/business/crm/ && echo "✅ CRM files exist"

echo "🔍 Checking TypeScript compilation..."
npx tsc --noEmit --project . && echo "✅ TypeScript compilation successful"

echo "📦 Checking dependencies..."
npm list --depth=0 && echo "✅ Dependencies installed"

echo "⚡ Quick test completed!"
echo ""
echo "🎯 To run full test suite:"
echo "   ./test-runner.sh"
echo ""
echo "🔧 To run specific tests:"
echo "   npm run test:social     # Social media integrations"
echo "   npm run test:marketing  # Email and analytics"
echo "   npm run test:business   # CRM and accounting"
echo "   npm run test:e2e        # End-to-end workflows"
