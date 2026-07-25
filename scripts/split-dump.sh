#!/usr/bin/env bash
set -euo pipefail

COMPOSE_FILE=""
OUTPUT_DIR=""

while getopts "f:o:" opt; do
    case "$opt" in
        f) COMPOSE_FILE="$OPTARG" ;;
        o) OUTPUT_DIR="$OPTARG" ;;
        *) echo "Usage: $0 -f <compose-file> [-o <output-dir>]" >&2; exit 1 ;;
    esac
done

if [[ -z "$COMPOSE_FILE" ]]; then
    echo "ERROR: -f <compose-file> is required" >&2
    exit 1
fi

if [[ ! -f "$COMPOSE_FILE" ]]; then
    echo "ERROR: Compose file not found: $COMPOSE_FILE" >&2
    exit 1
fi

# Source environment
ENV_FILE="$(dirname "$COMPOSE_FILE")/.env"
if [[ -f "$ENV_FILE" ]]; then
    set -a
    source "$ENV_FILE"
    set +a
fi

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
OUTPUT_DIR="${OUTPUT_DIR:-./split_dump/$TIMESTAMP}"
mkdir -p "$OUTPUT_DIR"

# Determine database names (with defaults)
AUTH_DB="${AUTH_DATABASE:-tdn_auth}"
USERS_DB="${USERS_DATABASE:-tdn_users}"
CAMPAIGN_DB="${CAMPAIGN_DATABASE:-tdn_campaign}"

DUMP_FILE=$(mktemp)

trap 'rm -f "$DUMP_FILE"' EXIT

echo "=== Taking full MySQL dump ==="
# Check if the MySQL container is running
if ! docker compose -f "$COMPOSE_FILE" ps --status running mysql 2>/dev/null | grep -q "mysql"; then
    echo "ERROR: MySQL container is not running" >&2
    exit 1
fi

docker compose -f "$COMPOSE_FILE" exec -T mysql mysqldump \
    --user=root --password="$MYSQL_ROOT_PASSWORD" \
    --all-databases --skip-lock-tables --skip-add-drop-database \
    --routines --triggers --events --hex-blob \
    > "$DUMP_FILE"

echo "=== Splitting dump by service ==="

# Table-to-service mapping
declare -A TABLE_MAP
TABLE_MAP["auth_data"]="auth"
TABLE_MAP["user"]="users"
TABLE_MAP["linked_services"]="users"
TABLE_MAP["group"]="campaign"
TABLE_MAP["charlist_template"]="campaign"
TABLE_MAP["character"]="campaign"
TABLE_MAP["item"]="campaign"
TABLE_MAP["character_item"]="campaign"
TABLE_MAP["skill"]="campaign"
TABLE_MAP["character_skill"]="campaign"
TABLE_MAP["note"]="campaign"
TABLE_MAP["note_keyword"]="campaign"
TABLE_MAP["user_group"]="campaign"
TABLE_MAP["user_character"]="campaign"
TABLE_MAP["quest"]="campaign"
TABLE_MAP["quest_assignment"]="campaign"

awk_script='
BEGIN {
    header = ""
    in_header = 1
    current_table = ""
    current_block = ""
}

# Detect CREATE DATABASE or USE lines in header — skip them
in_header == 1 && /^-- Table structure for table/ {
    in_header = 0
    # fall through to normal processing
}

in_header == 1 {
    # Skip CREATE DATABASE and USE lines in header
    if ($0 ~ /^CREATE DATABASE/ || $0 ~ /^USE /) {
        next
    }
    header = header $0 "\n"
    next
}

# Detect table start
/^-- Table structure for table/ {
    # Flush previous table
    if (current_table != "") {
        print current_block > (dir "/table-" current_table ".tmp")
    }
    # Extract name between backticks in table structure line
    # Line format: -- Table structure for table `auth_data`
    start = index($0, "`")
    if (start > 0) {
        end = index(substr($0, start + 1), "`")
        if (end > 0) {
            current_table = substr($0, start + 1, end - 1)
        }
    }
    current_block = $0 "\n"
    next
}

# End of file
END {
    if (current_table != "") {
        print current_block > (dir "/table-" current_table ".tmp")
    }
}

# Inside a table block
{
    current_block = current_block $0 "\n"
}
'

awk -v dir="$OUTPUT_DIR" "$awk_script" "$DUMP_FILE"

# Сохранить полный дамп для верификации
echo "=== Saving full dump ==="
cp "$DUMP_FILE" "$OUTPUT_DIR/full_dump.sql"

# Check if output dir has table-*.tmp files
shopt -s nullglob
TABLE_FILES=("$OUTPUT_DIR"/table-*.tmp)
if [[ ${#TABLE_FILES[@]} -eq 0 ]]; then
    echo "ERROR: No table files were extracted from the dump" >&2
    exit 1
fi

# Function to assemble output file
assemble_output() {
    local service="$1"
    local db_var="$2"
    local db_name="${!db_var}"
    local output_file="$OUTPUT_DIR/${service}.sql"

    {
        echo "$HEADER"
        echo ""
        for tmp_file in "$OUTPUT_DIR"/table-*.tmp; do
            table_name="${tmp_file##*/table-}"
            table_name="${table_name%.tmp}"
            if [[ "${TABLE_MAP[$table_name]:-}" == "$service" ]]; then
                cat "$tmp_file"
                echo ""
            fi
        done
    } > "$output_file"
}

echo "=== Extracting header ==="
HEADER=$(awk '
BEGIN { in_header = 1 }
in_header == 1 && /^-- Table structure for table/ { in_header = 0 }
in_header == 1 { 
    if ($0 !~ /^CREATE DATABASE/ && $0 !~ /^USE /) 
        print 
}
' "$DUMP_FILE")

echo "=== Assembling output files ==="
assemble_output "auth" "AUTH_DB"
assemble_output "users" "USERS_DB"
assemble_output "campaign" "CAMPAIGN_DB"

# Remove table temp files
rm -f "$OUTPUT_DIR"/table-*.tmp

echo ""
echo "=== Done! Files in $OUTPUT_DIR: ==="
ls -lh "$OUTPUT_DIR"
