#!/usr/bin/env bash
set -euo pipefail

# Restore per-service databases from split dump files.
# Usage: cd backend && ../scripts/restore.sh -f docker-compose.yaml -d ./split_dump/20250724_120000

COMPOSE_FILE=""
DUMP_DIR=""

while getopts "f:d:" opt; do
    case "$opt" in
        f) COMPOSE_FILE="$OPTARG" ;;
        d) DUMP_DIR="$OPTARG" ;;
        *) echo "Usage: $0 -f <compose-file> -d <dump-dir>" >&2; exit 1 ;;
    esac
done

if [[ -z "$COMPOSE_FILE" || -z "$DUMP_DIR" ]]; then
    echo "ERROR: -f and -d are required" >&2
    exit 1
fi

if [[ ! -d "$DUMP_DIR" ]]; then
    echo "ERROR: Directory not found: $DUMP_DIR" >&2
    exit 1
fi

# Source .env
ENV_FILE="$(dirname "$COMPOSE_FILE")/.env"
if [[ -f "$ENV_FILE" ]]; then
    set -a; source "$ENV_FILE"; set +a
fi

AUTH_DB="${AUTH_DATABASE:-tdn_auth}"
USERS_DB="${USERS_DATABASE:-tdn_users}"
CAMPAIGN_DB="${CAMPAIGN_DATABASE:-tdn_campaign}"

restore_service() {
    local db_name="$1"
    local sql_file="$2"

    if [[ ! -f "$sql_file" ]]; then
        echo "WARNING: File not found: $sql_file — skipping $db_name"
        return
    fi

    echo "Creating database $db_name (if not exists) ..."
    docker compose -f "$COMPOSE_FILE" exec -T mysql \
        mysql -u root -p"$MYSQL_ROOT_PASSWORD" \
        -e "CREATE DATABASE IF NOT EXISTS \`$db_name\`"

    echo "Restoring $sql_file -> $db_name ..."
    docker compose -f "$COMPOSE_FILE" exec -T mysql \
        mysql -u root -p"$MYSQL_ROOT_PASSWORD" "$db_name" \
        < "$sql_file"

    echo "Done: $db_name"
}

echo "=== Restoring databases ==="
restore_service "$AUTH_DB" "$DUMP_DIR/auth.sql"
restore_service "$USERS_DB" "$DUMP_DIR/users.sql"
restore_service "$CAMPAIGN_DB" "$DUMP_DIR/campaign.sql"
echo "=== Restore complete ==="
