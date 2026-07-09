# Python Conventions

## Projects
- `backend/api-gateway/` — Flask + Gunicorn (see `api-gateway/rules.md`)
- `admin/` — Flask + Jinja2 (see `admin/rules.md`)

## Flask Setup
- `application` (not `app`) is the Flask instance variable
- Gunicorn entrypoint: `wsgi:application`
- Dev mode: `python main.py` (debug=True)
- `JSON_AS_ASCII = False` for Cyrillic support

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
