#!/bin/bash
set -euo pipefail

: "${ACCOUNTS_DATABASE:?ACCOUNTS_DATABASE is required}"
: "${MYSQL_USER:?MYSQL_USER is required}"
: "${MYSQL_ROOT_PASSWORD:?MYSQL_ROOT_PASSWORD is required}"

[[ "$ACCOUNTS_DATABASE" =~ ^[A-Za-z0-9_]+$ ]]
sql="CREATE DATABASE IF NOT EXISTS \`$ACCOUNTS_DATABASE\`; GRANT ALL PRIVILEGES ON \`$ACCOUNTS_DATABASE\`.* TO '$MYSQL_USER'@'%';"
mysql -u root -p"$MYSQL_ROOT_PASSWORD" -e "SET SESSION sql_mode = CONCAT_WS(',', @@sql_mode, 'NO_BACKSLASH_ESCAPES'); $sql"
