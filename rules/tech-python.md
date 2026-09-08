# Python Conventions

## Projects
- `backend/api-gateway/` — FastAPI + Uvicorn (PyApiGate engine, см. `api-gateway/rules.md`)
- `backend/sync-service/` — FastAPI + Uvicorn (async orchestrator, см. `sync-service/README.md`)
- `admin/` — Flask + Jinja2 (см. `admin/rules.md`)

## Flask Setup (admin-panel)
- `application` (not `app`) is the Flask instance variable
- Gunicorn entrypoint: `wsgi:application`
- Dev mode: `python main.py` (debug=True)
- `JSON_AS_ASCII = False` for Cyrillic support

## FastAPI Setup (api-gateway, sync-service)
- Uvicorn entrypoint: `uvicorn main:app --host 0.0.0.0 --port <port>`
- api-gateway: `main.py` calls `create_app()` from the PyApiGate engine (in the image)
- sync-service: FastAPI app with lifespan (initializes clients/engine)

## Docker
```dockerfile
FROM python:3.13
WORKDIR /app
COPY ./req.txt ./req.txt
RUN pip install -r req.txt && pip install gunicorn
COPY . .
EXPOSE 5000
CMD ["gunicorn", "--bind", "0.0.0.0:5000", "-w", "4", "wsgi:application"]
```

## Import Style
```python
from __future__ import annotations
from typing import Optional, Any, Callable
```

## Prometheus
- Package: `prometheus-flask-exporter`
- Initialized at module level in `__init__.py`: `metrics = PrometheusMetrics(application)`
