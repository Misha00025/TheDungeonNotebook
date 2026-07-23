import jwt
import time
from pathlib import Path
from itertools import count

CERT_DIR = Path(__file__).resolve().parent.parent / "certs"
with open(CERT_DIR / "private.pem", "rb") as f:
    PRIVATE_KEY = f.read()

_next_id = count(start=1)


def generate_token(user_id: int | None = None, expires_in: int = 3600, oidc: bool = False) -> tuple[str, int]:
    if user_id is None:
        user_id = next(_next_id)
    payload = {
        "userId": user_id,
        "aud": "api-gateway",
        "iat": int(time.time()),
        "exp": int(time.time()) + expires_in,
    }
    if oidc:
        payload["sub"] = str(user_id)
        payload["iss"] = "http://auth-service:8080"
        payload["auth_time"] = int(time.time())
    return jwt.encode(payload, PRIVATE_KEY, algorithm="RS256"), user_id
