#!/bin/bash

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
API_DIR="$SCRIPT_DIR"
DART_DIR="$SCRIPT_DIR/dart_time_service"
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
  echo "❌ Dart SDK not found."
  echo "👉 Installing Dart SDK (Ubuntu)..."
  sudo apt-get update
  sudo apt-get install -y apt-transport-https
  wget -qO- https://dl-ssl.google.com/linux/linux_signing_key.pub | sudo gpg --dearmor -o /usr/share/keyrings/dart.gpg
  echo 'deb [signed-by=/usr/share/keyrings/dart.gpg arch=amd64] https://storage.googleapis.com/download.dartlang.org/linux/debian stable main' | sudo tee /etc/apt/sources.list.d/dart_stable.list
  sudo apt-get update
  sudo apt-get install -y dart
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
