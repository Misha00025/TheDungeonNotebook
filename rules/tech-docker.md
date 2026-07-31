# Docker Conventions

## Main Stack
- File: `backend/docker-compose.yaml`
- Network: `backend-network` (bridge, shared)
- Only api-gateway exposes port to host: `5000:5000`

## Services

### mongo
- Image: `mongo:latest`
- Volumes: `./mongo_data:/data/db`
- Healthcheck: `mongosh` ping

### mysql
- Image: `mysql:8.0`
- Volumes: `./mysql_data:/var/lib/mysql`
- Init SQL: numbered scripts mounted into `/docker-entrypoint-initdb.d/`
  - `0_auth.sql` (auth-service)
  - `2_users.sql` (users-service)
  - `3_campaign.sql` (campaign-service)
- Healthcheck: `mysqladmin ping`

### C# services
- Build context: `./<service>`
- `depends_on` DB with `condition: service_healthy`
- Environment: `MYSQL_CONNECTION_STRING`, optional `MONGO_*`, key paths
- auth-service mounts `./certs:/certs` for RSA keys

### api-gateway
- Build context: `./api-gateway`
- Depends on all C# services (`condition: service_started`)
- Ports: `"5000:5000"`
- Env: `AUTH_SERVICE_URL`, `USERS_SERVICE_URL`, `CAMPAIGN_SERVICE_URL`



## Environment Variables (shared .env)
| Variable | Purpose |
|----------|---------|
| `MONGO_INITDB_ROOT_USERNAME` | MongoDB user |
| `MONGO_INITDB_ROOT_PASSWORD` | MongoDB password |
| `MYSQL_ROOT_PASSWORD` | MySQL root |
| `MYSQL_USER` | MySQL app user |
| `MYSQL_PASSWORD` | MySQL app password |
| `AUTH_DATABASE` | MySQL database name for auth-service |
| `USERS_DATABASE` | MySQL database name for users-service |
| `CAMPAIGN_DATABASE` | MySQL database name for campaign-service |
| `SERVICE_TOKEN` | Internal service auth token |

## Certificates
- RSA key pair at `backend/certs/private.pem` and `backend/certs/public.pem`
- Mounted into auth-service at `/certs`

## Dockerfiles

### Python
```dockerfile
FROM python:3.13
WORKDIR /app
COPY ./req.txt ./req.txt
RUN pip install -r req.txt && pip install gunicorn
COPY . .
EXPOSE 5000
CMD ["gunicorn", "--bind", "0.0.0.0:5000", "-w", "4", "wsgi:application"]
```

### C#
Multi-stage build with `dotnet publish`.

## Monitoring Stack
- Separate compose: `monitoring/docker-compose.yaml`
- Network: `backend_backend-network` (external: true)
- Prometheus :9090, Grafana :3000

## Backup & Migration Scripts

### backup.sh
- File: `scripts/backup.sh`
- Usage: `cd backend && ../scripts/backup.sh -f docker-compose.yaml [-o <backup-dir>]`
- Creates dumps per-service (AUTH_DATABASE, USERS_DATABASE, CAMPAIGN_DATABASE — if they exist) + full dump of all databases
- Creates `mongo.archive` via `mongodump --archive` for MongoDB backup
- Skips databases that don't exist yet (works both before and after migration)
- Requires `.env` in the current directory

### split-dump.sh
- File: `scripts/split-dump.sh`
- Usage: `cd backend && ../scripts/split-dump.sh -f docker-compose.yaml [-o <output-dir>]`
- Takes a full MySQL dump (via docker compose exec mysqldump) and splits it into three SQL files:
  - `auth.sql` (table: auth_data)
  - `users.sql` (tables: user, linked_services)
  - `campaign.sql` (tables: group, charlist_template, character, item, character_item, skill, character_skill, note, note_keyword, user_group, user_character, quest, quest_assignment)
- Output files contain table schemas and data only (no CREATE DATABASE / USE — use restore.sh)
- Designed for migrating from a single shared database to per-service databases
- Requires `.env` in the current directory
- Also saves `full_dump.sql` — raw full MySQL dump for verification purposes

### restore.sh
- File: `scripts/restore.sh`
- Usage: `cd backend && ../scripts/restore.sh -f docker-compose.yaml -d <dump-file>`
- Usage (full backup): `cd backend && ../scripts/restore.sh -f docker-compose.yaml -b <backup-dir>`
- `-d <dump-file>`: restores a single MySQL SQL dump file (legacy mode)
- `-b <backup-dir>`: restores both MySQL (`all_databases.sql`) and MongoDB (`mongo.archive`) from a backup directory
- Uses `.env` variables for database names and credentials
- Requires `.env` in the current directory
