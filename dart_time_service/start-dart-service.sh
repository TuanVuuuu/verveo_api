#!/bin/bash

set -e

SERVICE_DIR="/Users/nguyentuanvu/dev/BE/test_ai/version_2.0/projects/dart_time_service"
PORT_VALUE=${PORT:-8081}

cd "$SERVICE_DIR"

if ! command -v dart >/dev/null 2>&1; then
  echo "❌ Dart SDK not found. Please install Dart first."
  echo "   macOS: brew install dart"
  exit 1
fi

echo "📦 Installing Dart dependencies..."
dart pub get

echo "🚀 Starting Dart Time Service on port $PORT_VALUE"
PORT="$PORT_VALUE" dart run bin/server.dart
