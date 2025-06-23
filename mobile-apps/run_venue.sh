#!/bin/bash
cd TicketTokenVenue

echo "🏟️ Starting TicketToken Venue App"
echo "================================="

echo "🔍 Checking for Android device/emulator..."
adb devices

echo ""
echo "🚀 Starting React Native..."
npm run android
