#!/bin/bash
# Init script for users-service database
mysql -u root -p"$MYSQL_ROOT_PASSWORD" \
  -e "CREATE DATABASE IF NOT EXISTS \`${USERS_DATABASE}\`; GRANT ALL PRIVILEGES ON \`${USERS_DATABASE}\`.* TO '${MYSQL_USER}'@'%';"
