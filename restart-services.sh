#!/bin/bash

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
API_DIR="$SCRIPT_DIR"
DART_DIR="$SCRIPT_DIR/dart_time_service"

MODE=${1:-build} # build | dev

# Stop existing services (systemd only)
sudo systemctl stop api_verveo || true
sudo systemctl stop dart_time_service || true

# Ensure Flutter 3.35.2 exists for Dart service
cd "$DART_DIR"
FLUTTER_VERSION_REQUIRED="3.35.2"
FLUTTER_INSTALL_DIR="/opt/flutter-$FLUTTER_VERSION_REQUIRED"

if ! command -v flutter >/dev/null 2>&1; then
  echo "❌ Flutter not found."
  echo "👉 Installing Flutter $FLUTTER_VERSION_REQUIRED..."
  sudo mkdir -p "$FLUTTER_INSTALL_DIR"
  wget -qO /tmp/flutter.tar.xz "https://storage.googleapis.com/flutter_infra_release/releases/stable/linux/flutter_linux_${FLUTTER_VERSION_REQUIRED}-stable.tar.xz"
  tar -xJf /tmp/flutter.tar.xz -C "$FLUTTER_INSTALL_DIR" --strip-components=1
  git config --global --add safe.directory "$FLUTTER_INSTALL_DIR" || true
  export FLUTTER_ROOT="$FLUTTER_INSTALL_DIR"
  export PATH="$FLUTTER_INSTALL_DIR/bin:$PATH"
  flutter --disable-analytics || true
fi

git config --global --add safe.directory "$FLUTTER_INSTALL_DIR" || true
export FLUTTER_ROOT="$FLUTTER_INSTALL_DIR"
export PATH="$FLUTTER_INSTALL_DIR/bin:$PATH"

if ! flutter --version | grep -q "$FLUTTER_VERSION_REQUIRED"; then
  echo "❌ Flutter version mismatch. Required: $FLUTTER_VERSION_REQUIRED"
  exit 1
fi

# Build Dart deps to avoid first-run delay
flutter pub get

# Build Node if needed
cd "$API_DIR"
if [ "$MODE" != "dev" ]; then
  npm run build
fi

# Start systemd services
sudo systemctl start dart_time_service || true
sudo systemctl start api_verveo

echo "✅ Services started via systemd"
echo "📄 Tailing logs: sudo journalctl -u api_verveo -f"
sudo journalctl -u api_verveo -f