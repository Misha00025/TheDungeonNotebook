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

# Определяем имена БД (с дефолтами)
AUTH_DB="${AUTH_DATABASE:-tdn_auth}"
USERS_DB="${USERS_DATABASE:-tdn_users}"
CAMPAIGN_DB="${CAMPAIGN_DATABASE:-tdn_campaign}"
DBS="$AUTH_DB $USERS_DB $CAMPAIGN_DB"

# Дамп только данных — для восстановления в новую схему
echo "Backing up data-only dump ..."
docker compose -f "$COMPOSE_FILE" exec -T mysql mysqldump \
    --no-create-info --complete-insert \
    -u root -p"$MYSQL_ROOT_PASSWORD" \
    --routines --triggers \
    --databases $DBS > "$BACKUP_DIR/all_databases.sql"

# Полный дамп со структурой — для восстановления с нуля
echo "Backing up full dump with schema ..."
docker compose -f "$COMPOSE_FILE" exec -T mysql mysqldump \
    -u root -p"$MYSQL_ROOT_PASSWORD" \
    --routines --triggers \
    --databases $DBS > "$BACKUP_DIR/all_databases_with_schema.sql"

echo "Backup saved to $BACKUP_DIR"
ls -lh "$BACKUP_DIR"
