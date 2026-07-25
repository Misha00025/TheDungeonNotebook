#!/bin/bash
# Init script for auth-service database
mysql -u root -p"$MYSQL_ROOT_PASSWORD" \
  -e "CREATE DATABASE IF NOT EXISTS \`${AUTH_DATABASE}\`; GRANT ALL PRIVILEGES ON \`${AUTH_DATABASE}\`.* TO '${MYSQL_USER}'@'%';"
