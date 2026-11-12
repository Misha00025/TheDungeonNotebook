#!/bin/bash
# Init script for campaign-service database
mysql -u root -p"$MYSQL_ROOT_PASSWORD" \
  -e "CREATE DATABASE IF NOT EXISTS \`${CAMPAIGN_DATABASE}\`; GRANT ALL PRIVILEGES ON \`${CAMPAIGN_DATABASE}\`.* TO '${MYSQL_USER}'@'%';"
