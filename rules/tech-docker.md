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

## Uploads Service
- Runs **separately**: `cd backend/uploads-service && docker compose up -d`
- Own docker-compose.yaml

## Environment Variables (shared .env)
| Variable | Purpose |
|----------|---------|
| `MONGO_INITDB_ROOT_USERNAME` | MongoDB user |
| `MONGO_INITDB_ROOT_PASSWORD` | MongoDB password |
| `MYSQL_ROOT_PASSWORD` | MySQL root |
| `MYSQL_DATABASE` | MySQL database name |
| `MYSQL_USER` | MySQL app user |
| `MYSQL_PASSWORD` | MySQL app password |
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
