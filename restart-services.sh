#!/bin/bash

set -e

API_DIR="/Users/nguyentuanvu/dev/BE/test_ai/version_2.0/projects/api_verveo"
DART_DIR="/Users/nguyentuanvu/dev/BE/test_ai/version_2.0/projects/api_verveo/dart_time_service"
LOG_DIR="$API_DIR/logs"

MODE=${1:-build} # build | dev

mkdir -p "$LOG_DIR"

# Stop existing services
sudo systemctl stop api_verveo || true
sudo systemctl stop dart_time_service || true
pkill -f "node dist/index.js" || true
pkill -f "tsx watch src/index.ts" || true
pkill -f "dart run bin/server.dart" || true

# Start Dart service
cd "$DART_DIR"
if ! command -v dart >/dev/null 2>&1; then
  echo "❌ Dart SDK not found. Please install Dart first."
  exit 1
fi

dart pub get
nohup PORT=8081 dart run bin/server.dart > "$LOG_DIR/dart-service.log" 2>&1 &
if systemctl list-unit-files --type=service | grep -q "^dart_time_service.service"; then
  sudo systemctl start dart_time_service
fi

# Start API service
cd "$API_DIR"
if [ "$MODE" = "dev" ]; then
  nohup npm run dev > "$LOG_DIR/api-service.log" 2>&1 &
else
  npm run build
  nohup npm run start > "$LOG_DIR/api-service.log" 2>&1 &
fi
if systemctl list-unit-files --type=service | grep -q "^api_verveo.service"; then
  sudo systemctl start api_verveo
fi

# Optional reboot (requires sudo)
if [ "$REBOOT" = "true" ]; then
  sudo reboot
fi

echo "✅ Services started"
echo "📄 Tailing logs: sudo journalctl -u api_verveo -f"
sudo journalctl -u api_verveo -f
