import jwt
import time
from pathlib import Path
from itertools import count

CERT_DIR = Path(__file__).resolve().parent.parent / "certs"
with open(CERT_DIR / "private.pem", "rb") as f:
    PRIVATE_KEY = f.read()

_next_id = count(start=1)


def generate_token(user_id: int | None = None, expires_in: int = 3600) -> tuple[str, int]:
    if user_id is None:
        user_id = next(_next_id)
    payload = {
        "sub": str(user_id),
        "userId": user_id,
        "iss": "http://auth-service:8080",
        "auth_time": int(time.time()),
        "aud": "api-gateway",
        "iat": int(time.time()),
        "exp": int(time.time()) + expires_in,
    }
    return jwt.encode(payload, PRIVATE_KEY, algorithm="RS256"), user_id


def generate_service_token(group_id: int | None = None, expires_in: int = 3600) -> tuple[str, int]:
    if group_id is None:
        group_id = next(_next_id)
    payload = {
        "sub": str(group_id),
        "groupId": group_id,
        "access_level": 3,
        "aud": "api-gateway",
        "iat": int(time.time()),
        "exp": int(time.time()) + expires_in,
    }
    return jwt.encode(payload, PRIVATE_KEY, algorithm="RS256"), group_id
