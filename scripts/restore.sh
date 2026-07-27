#!/usr/bin/env bash
set -euo pipefail

# Restore MySQL databases from a single dump file.
# Usage: cd backend && ../scripts/restore.sh -f docker-compose.yaml -d ./backups/20250724_120000/all_databases.sql

COMPOSE_FILE=""
DUMP=""

while getopts "f:d:" opt; do
    case "$opt" in
        f) COMPOSE_FILE="$OPTARG" ;;
        d) DUMP="$OPTARG" ;;
        *) echo "Usage: $0 -f <compose-file> -d <dump-file>" >&2; exit 1 ;;
    esac
done

if [[ -z "$COMPOSE_FILE" || -z "$DUMP" ]]; then
    echo "ERROR: -f and -d are required" >&2
    exit 1
fi

if [[ ! -f "$DUMP" ]]; then
    echo "ERROR: File not found: $DUMP" >&2
    exit 1
fi

# Source .env
ENV_FILE="$(dirname "$COMPOSE_FILE")/.env"
if [[ -f "$ENV_FILE" ]]; then
    set -a; source "$ENV_FILE"; set +a
fi

echo "=== Restoring from $DUMP ==="
docker compose -f "$COMPOSE_FILE" exec -T mysql \
    mysql -u root -p"$MYSQL_ROOT_PASSWORD" < "$DUMP"
echo "=== Restore complete ==="
