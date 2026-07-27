#!/bin/bash
set -euo pipefail

# Backup MySQL databases via docker compose
# Usage: backup.sh -f <compose-file> [-o <backup-dir>]

COMPOSE_FILE=""
BACKUP_DIR=""

while [[ $# -gt 0 ]]; do
    case $1 in
        -f) COMPOSE_FILE="$2"; shift 2 ;;
        -o) BACKUP_DIR="$2"; shift 2 ;;
        *) echo "Usage: $0 -f <compose-file> [-o <backup-dir>]"; exit 1 ;;
    esac
done

if [ -z "$COMPOSE_FILE" ]; then
    echo "Error: -f <compose-file> is required"
    exit 1
fi

BACKUP_DIR="${BACKUP_DIR:-./backups/$(date +%Y%m%d_%H%M%S)}"
mkdir -p "$BACKUP_DIR"

# source .env from current directory
if [ -f .env ]; then
    set -a; source .env; set +a
fi

# Дамп каждой БД из env-переменных
for db_var in AUTH_DATABASE USERS_DATABASE CAMPAIGN_DATABASE; do
    db="${!db_var:-}"
    if [ -n "$db" ]; then
        # Проверяем, существует ли БД
        exists=$(docker compose -f "$COMPOSE_FILE" exec -T mysql mysql -u root -p"$MYSQL_ROOT_PASSWORD" \
            -sse "SELECT COUNT(*) FROM information_schema.schemata WHERE schema_name='$db'")
        if [ "$exists" -eq 0 ]; then
            echo "Skipping $db_var=$db — database does not exist"
            continue
        fi
        echo "Backing up $db_var=$db ..."
        docker compose -f "$COMPOSE_FILE" exec -T mysql mysqldump --no-create-info -u root -p"$MYSQL_ROOT_PASSWORD" \
            --routines --triggers "$db" > "$BACKUP_DIR/$(echo "$db_var" | tr '[:upper:]' '[:lower:]').sql"
    fi
done

# Полный дамп всего инстанса — всегда
echo "Backing up all databases ..."
docker compose -f "$COMPOSE_FILE" exec -T mysql mysqldump --no-create-info -u root -p"$MYSQL_ROOT_PASSWORD" \
    --all-databases --routines --triggers > "$BACKUP_DIR/all_databases.sql"

echo "Backup saved to $BACKUP_DIR"
