import jwt
import time
from pathlib import Path

CERT_DIR = Path(__file__).resolve().parent.parent / "certs"
with open(CERT_DIR / "private.pem", "rb") as f:
    PRIVATE_KEY = f.read()


def generate_token(user_id: int, expires_in: int = 3600) -> str:
    payload = {
        "userId": user_id,
        "iat": int(time.time()),
        "exp": int(time.time()) + expires_in,
    }
    return jwt.encode(payload, PRIVATE_KEY, algorithm="RS256")
