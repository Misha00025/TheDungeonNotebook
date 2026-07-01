import os
from flask import Flask
from prometheus_flask_exporter import PrometheusMetrics 

application = Flask(__name__)
application.config['JSON_AS_ASCII'] = False
metrics = PrometheusMetrics(application)


from flask import json
json.provider.DefaultJSONProvider.ensure_ascii = False

AUTH_SERVICE_URL = os.environ.get("AUTH_SERVICE_URL")
USERS_SERVICE_URL = os.environ.get("USERS_SERVICE_URL")
CAMPAIGN_SERVICE_URL = os.environ.get("CAMPAIGN_SERVICE_URL")
NOTES_SERVICE_URL = os.environ.get("NOTES_SERVICE_URL")

import app.api

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
# Регистрирует маршруты из config/routes.yaml на /v2/
# Параллельно с существующими @route-декораторами на /
# Потом можно будет переключить url_prefix на "/"
# для полной замены.
# ============================================================
from app.engine.bootstrap import bootstrap
_config = bootstrap(
    application,
    url_prefix="/v2",  # ← временно, для параллельной работы
    import_handlers=True,
)


