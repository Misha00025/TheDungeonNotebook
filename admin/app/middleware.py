import jwt
from datetime import datetime, timedelta, timezone
from functools import wraps
from flask import request, redirect, url_for, current_app


def create_token(username: str, secret: str) -> str:
    payload = {
        "username": username,
        "exp": datetime.now(timezone.utc) + timedelta(hours=24),
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, secret, algorithm="HS256")


def verify_token(token: str, secret: str) -> dict | None:
    try:
        return jwt.decode(token, secret, algorithms=["HS256"])
    except jwt.PyJWTError:
        return None


def login_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = request.cookies.get("admin_token")
        if not token:
            return redirect(url_for("auth.login"))
        payload = verify_token(token, current_app.config["JWT_SECRET"])
        if not payload:
            return redirect(url_for("auth.login"))
        return f(*args, **kwargs)
    return decorated


def setup_middleware(app):
    pass
