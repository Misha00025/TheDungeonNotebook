#!/bin/sh
set -e

CONFIG_PATH="/app/build/config.json"

if [ ! -f "$CONFIG_PATH" ]; then
  echo "Creating default config.json..."
  cat > "$CONFIG_PATH" <<EOF
{
  "API_BASE": "${API_BASE:-http://localhost:5000}"
}
EOF
fi

exec "$@"
