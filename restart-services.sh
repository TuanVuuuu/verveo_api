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
FLUTTER_VERSION_REQUIRED="3.35.2"
FLUTTER_INSTALL_DIR="/opt/flutter-$FLUTTER_VERSION_REQUIRED"

if ! command -v flutter >/dev/null 2>&1; then
  echo "❌ Flutter not found."
  echo "👉 Installing Flutter $FLUTTER_VERSION_REQUIRED..."
  sudo mkdir -p "$FLUTTER_INSTALL_DIR"
  sudo chown -R "$USER":"$USER" "$FLUTTER_INSTALL_DIR"
  wget -qO /tmp/flutter.tar.xz "https://storage.googleapis.com/flutter_infra_release/releases/stable/linux/flutter_linux_${FLUTTER_VERSION_REQUIRED}-stable.tar.xz"
  tar -xJf /tmp/flutter.tar.xz -C "$FLUTTER_INSTALL_DIR" --strip-components=1
  export PATH="$FLUTTER_INSTALL_DIR/bin:$PATH"
  flutter --disable-analytics || true
fi

if ! flutter --version | grep -q "$FLUTTER_VERSION_REQUIRED"; then
  echo "❌ Flutter version mismatch. Required: $FLUTTER_VERSION_REQUIRED"
  exit 1
fi

flutter pub get
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
