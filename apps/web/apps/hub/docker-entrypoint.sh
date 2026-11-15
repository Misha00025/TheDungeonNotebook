#!/bin/sh
set -e

CONFIG_PATH="/app/build/config.json"

if [ ! -f "$CONFIG_PATH" ]; then
  node - "$CONFIG_PATH" <<'NODE'
const fs = require('node:fs');
const configPath = process.argv[2];
const bffBase = process.env.BFF_BASE || 'http://localhost:5080/bff';
const apiBase = process.env.API_BASE || `${bffBase.replace(/\/+$/, '')}/api`;
fs.writeFileSync(configPath, JSON.stringify({ BFF_BASE: bffBase, API_BASE: apiBase }));
NODE
fi

exec "$@"
