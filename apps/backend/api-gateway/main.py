import handlers  # noqa: F401 — register custom handlers
from app import create_app
import os
from ingress import IngressIdentitySanitizer

app = create_app(
    config_path=os.environ.get("APP_CONFIG"),
)
app.add_middleware(IngressIdentitySanitizer)
