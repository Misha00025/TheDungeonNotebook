#!/bin/bash
# Init script for game-systems-service database
mysql -u root -p"$MYSQL_ROOT_PASSWORD" \
  -e "CREATE DATABASE IF NOT EXISTS \`${GAME_SYSTEMS_DATABASE}\`; GRANT ALL PRIVILEGES ON \`${GAME_SYSTEMS_DATABASE}\`.* TO '${MYSQL_USER}'@'%';"
