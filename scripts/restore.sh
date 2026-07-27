#!/usr/bin/env bash
set -euo pipefail

# Restore MySQL databases from a single dump file or full backup directory (MySQL + MongoDB).
# Usage: cd backend && ../scripts/restore.sh -f docker-compose.yaml -d <dump-file>
#        cd backend && ../scripts/restore.sh -f docker-compose.yaml -b <backup-dir>

COMPOSE_FILE=""
DUMP=""
BACKUP_DIR=""

while getopts "f:d:b:" opt; do
    case "$opt" in
        f) COMPOSE_FILE="$OPTARG" ;;
        d) DUMP="$OPTARG" ;;
        b) BACKUP_DIR="$OPTARG" ;;
        *) echo "Usage: $0 -f <compose-file> -d <dump-file> | -b <backup-dir>" >&2; exit 1 ;;
    esac
done

if [[ -z "$COMPOSE_FILE" ]]; then
    echo "ERROR: -f <compose-file> is required" >&2
    exit 1
fi

if [[ -n "$BACKUP_DIR" && -n "$DUMP" ]]; then
    echo "ERROR: Use either -d or -b, not both" >&2
    exit 1
fi

if [[ -z "$BACKUP_DIR" && -z "$DUMP" ]]; then
    echo "ERROR: Either -d <dump-file> or -b <backup-dir> is required" >&2
    exit 1
fi

# Source .env
ENV_FILE="$(dirname "$COMPOSE_FILE")/.env"
if [[ -f "$ENV_FILE" ]]; then
    set -a; source "$ENV_FILE"; set +a
fi

MONGO_USER="${MONGO_INITDB_ROOT_USERNAME:-root}"
MONGO_PASS="${MONGO_INITDB_ROOT_PASSWORD:-}"

restore_mysql() {
    local sql_file="$1"
    echo "=== Restoring MySQL from $sql_file ==="
    docker compose -f "$COMPOSE_FILE" exec -T mysql \
        mysql -u root -p"$MYSQL_ROOT_PASSWORD" < "$sql_file"
    echo "=== MySQL restore complete ==="
}

restore_mongo() {
    local archive_file="$1"
    echo "=== Restoring MongoDB from $archive_file ==="
    docker compose -f "$COMPOSE_FILE" exec -T mongo mongorestore \
        --username="$MONGO_USER" \
        --password="$MONGO_PASS" \
        --authenticationDatabase=admin \
        --archive < "$archive_file"
    echo "=== MongoDB restore complete ==="
}

# Restore from backup directory
if [[ -n "$BACKUP_DIR" ]]; then
    if [[ ! -d "$BACKUP_DIR" ]]; then
        echo "ERROR: Directory not found: $BACKUP_DIR" >&2
        exit 1
    fi

    mysql_file="$BACKUP_DIR/all_databases.sql"
    mongo_file="$BACKUP_DIR/mongo.archive"

    if [[ ! -f "$mysql_file" && ! -f "$mongo_file" ]]; then
        echo "ERROR: No backup files found in $BACKUP_DIR (expected all_databases.sql and/or mongo.archive)" >&2
        exit 1
    fi

    if [[ -f "$mysql_file" ]]; then
        restore_mysql "$mysql_file"
    fi

    if [[ -f "$mongo_file" ]]; then
        restore_mongo "$mongo_file"
    fi

    echo "=== Full restore from $BACKUP_DIR complete ==="
    exit 0
fi

# Restore single MySQL dump file (legacy -d flag)
if [[ -n "$DUMP" ]]; then
    if [[ ! -f "$DUMP" ]]; then
        echo "ERROR: File not found: $DUMP" >&2
        exit 1
    fi
    restore_mysql "$DUMP"
fi
