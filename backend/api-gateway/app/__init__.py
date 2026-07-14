import os
from flask import Flask
from prometheus_flask_exporter import PrometheusMetrics 

application = Flask(__name__)
application.config['JSON_AS_ASCII'] = False
metrics = PrometheusMetrics(application)


from flask import json
json.provider.DefaultJSONProvider.ensure_ascii = False

PUBLIC_KEY_PATH = os.environ.get("PUBLIC_KEY_PATH", "certs/public.pem")
try:
    with open(PUBLIC_KEY_PATH, "rb") as f:
        PUBLIC_KEY = f.read()
except FileNotFoundError:
    raise RuntimeError(f"Public key not found at {PUBLIC_KEY_PATH}")

OIDC_ISSUER = os.environ.get("OIDC_ISSUER")

# import app.api  # заблокировано: engine управляет всеми маршрутами

from flask import request as _flask_request

@application.before_request
def _sanitize_user_params():
    """Remove userId and access from incoming client request params.
    These should only be set by the gateway itself from JWT tokens."""
    if _flask_request.args:
        poisoned = False
        args = _flask_request.args.copy()
        if "userId" in args:
            del args["userId"]
            poisoned = True
        if "access" in args:
            del args["access"]
            poisoned = True
        if poisoned:
            _flask_request.args = args


# ============================================================
# Bootstrap декларативного engine
# ============================================================
# Загружает routes.yaml из корня сервиса и регистрирует маршруты.
# base_path задаётся в YAML (секция base_path).
# ============================================================
from app.engine.bootstrap import bootstrap
_config = bootstrap(
    application,
    import_handlers=True,
)


