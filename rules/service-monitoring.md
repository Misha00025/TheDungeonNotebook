# Monitoring Conventions

## Stack
- Prometheus + Grafana
- Location: `monitoring/`
- Start: `cd monitoring && docker compose up -d`

## Docker Compose
- Network: `backend_backend-network` (external: true) — connects to main backend stack
- Prometheus: port 9090, retention 200h, web lifecycle enabled
- Grafana: port 3000, default admin/admin, provisioning from `./grafana/provisioning/`

## Prometheus Config
File: `monitoring/prometheus.yml`

Currently scraped targets:
| Job | Target |
|-----|--------|
| api-gateway | `api-gateway:5000` |
| campaign-service | `campaign-service:8080` |
| users-service | `users-service:8080` |
| auth-service | `auth-service:8080` |

All targets use `/metrics` path with HTTP scheme. Scrape interval: 15s.

## Adding a New Service to Monitoring
1. Add a new `job_name` entry to `scrape_configs` in `prometheus.yml`
2. The C# service must have `app.UseHttpMetrics()` and `app.MapMetrics()` in its `Program.cs`
3. The Python service uses `prometheus_flask_exporter` (initialized in `app/__init__.py`)

## Grafana Provisioning
- Datasources: `monitoring/grafana/provisioning/datasources/datasources.yml`
- Auto-adds Prometheus datasource on startup
