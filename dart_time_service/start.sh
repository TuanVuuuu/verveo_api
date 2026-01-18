#!/bin/bash

# Start Dart Time Resolution Service

echo "🚀 Starting Dart Time Resolution Service..."
echo ""

# Check if Dart is installed
if ! command -v dart &> /dev/null; then
    echo "❌ Dart is not installed. Please install Dart SDK first."
    echo "   Visit: https://dart.dev/get-dart"
    exit 1
fi

# Get dependencies
echo "📦 Installing dependencies..."
dart pub get

echo ""
echo "✅ Dependencies installed"
echo ""

# Set port
export PORT=8081

echo "🔧 Configuration:"
echo "   Port: $PORT"
echo ""

# Start server
echo "▶️  Starting server..."
dart run bin/server.dart

