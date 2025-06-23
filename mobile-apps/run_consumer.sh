#!/bin/bash
cd TicketTokenConsumer

echo "📱 Starting TicketToken Consumer App"
echo "===================================="

echo "🔍 Checking for Android device/emulator..."
adb devices

echo ""
echo "🚀 Starting React Native..."
npm run android
