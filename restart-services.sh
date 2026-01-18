#!/bin/bash

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
API_DIR="$SCRIPT_DIR"
DART_DIR="$SCRIPT_DIR/dart_time_service"

MODE=${1:-build} # build | dev

# Stop existing services (systemd only)
# Disable auto-restart temporarily to prevent restart loop
if systemctl list-unit-files --type=service | grep -q "^api_verveo.service"; then
  sudo systemctl disable api_verveo --now || true
fi
if systemctl list-unit-files --type=service | grep -q "^dart_time_service.service"; then
  sudo systemctl disable dart_time_service --now || true
fi
sudo systemctl stop api_verveo || true
sudo systemctl stop dart_time_service || true

# Kill any processes still holding ports (safety net)
echo "🔍 Checking for processes holding ports..."
if lsof -ti:8000 >/dev/null 2>&1; then
  echo "⚠️  Killing process on port 8000..."
  sudo lsof -ti:8000 | xargs -r sudo kill -9 || true
fi
if lsof -ti:8081 >/dev/null 2>&1; then
  echo "⚠️  Killing process on port 8081..."
  sudo lsof -ti:8081 | xargs -r sudo kill -9 || true
fi

# Wait for ports to be released
sleep 2

# Ensure Flutter 3.35.2 exists for Dart service
cd "$DART_DIR"
FLUTTER_VERSION_REQUIRED="3.35.2"
FLUTTER_INSTALL_DIR="/opt/flutter-$FLUTTER_VERSION_REQUIRED"
FLUTTER_BIN="$FLUTTER_INSTALL_DIR/bin/flutter"

# Set PATH first (even if Flutter already exists)
export FLUTTER_ROOT="$FLUTTER_INSTALL_DIR"
export PATH="$FLUTTER_INSTALL_DIR/bin:$PATH"

# Check if Flutter binary exists (check file directly, not command -v)
if [ ! -f "$FLUTTER_BIN" ]; then
  echo "❌ Flutter not found at $FLUTTER_BIN"
  echo "👉 Installing Flutter $FLUTTER_VERSION_REQUIRED..."
  sudo mkdir -p "$FLUTTER_INSTALL_DIR"
  wget -qO /tmp/flutter.tar.xz "https://storage.googleapis.com/flutter_infra_release/releases/stable/linux/flutter_linux_${FLUTTER_VERSION_REQUIRED}-stable.tar.xz"
  tar -xJf /tmp/flutter.tar.xz -C "$FLUTTER_INSTALL_DIR" --strip-components=1
  git config --global --add safe.directory "$FLUTTER_INSTALL_DIR" || true
  "$FLUTTER_BIN" --disable-analytics || true
else
  echo "✅ Flutter found at $FLUTTER_BIN"
fi

# Always configure git safe directory and ensure PATH is set
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

# Verify ports are free before starting
if lsof -ti:8000 >/dev/null 2>&1; then
  echo "❌ Port 8000 still in use. Aborting."
  exit 1
fi
if lsof -ti:8081 >/dev/null 2>&1; then
  echo "⚠️  Port 8081 still in use, but continuing..."
fi

# Start systemd services
if systemctl list-unit-files --type=service | grep -q "^dart_time_service.service"; then
  sudo systemctl enable dart_time_service || true
  sudo systemctl start dart_time_service || true
fi
if systemctl list-unit-files --type=service | grep -q "^api_verveo.service"; then
  sudo systemctl enable api_verveo
  sudo systemctl start api_verveo
else
  echo "❌ api_verveo.service not found. Please create systemd service file."
  exit 1
fi

echo "✅ Services started via systemd"
echo "📄 Tailing logs: sudo journalctl -u api_verveo -f"
sudo journalctl -u api_verveo -f