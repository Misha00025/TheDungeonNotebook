import json
import os
import re

from fastapi import HTTPException
from app.engine.registry import register_auth_strategy
from app.engine.registry import register_pre_request_handler
from app.engine.proxy_request import RequestBuilder
from handlers.trusted import INTERNAL_SERVICE_KEY


def _secret(name):
    value = os.environ.get(name)
    file_name = os.environ.get(name + "_FILE")
    if value is not None and file_name is not None:
        raise ValueError("conflicting secret configuration")
    if file_name is not None:
        with open(file_name, "rb") as source:
            value = source.read().strip().decode("utf-8")
    if value is None or len(value.encode("utf-8")) < 32:
        raise ValueError("secret must contain at least 32 bytes")
    return value


def _timeout():
    raw = os.environ.get("ACCOUNT_SERVICE_TIMEOUT_SECONDS", "10")
    try:
        value = float(raw)
    except ValueError as exc:
        raise ValueError("invalid account service timeout") from exc
    if not 1 <= value <= 60:
        raise ValueError("invalid account service timeout")
    return value


def _identifier(value):
    return type(value) is int and 1 <= value <= 2147483647


def _trusted_secret():
    return INTERNAL_SERVICE_KEY


@register_pre_request_handler("trusted_upstream")
async def trusted_upstream(ctx, req: RequestBuilder):
    sensitive = {"authorization", "cookie", "x-subject", "x-user-id", "x-account-id", "x-account-service-key", "x-internal-service-key"}
    for name in ctx.request.headers:
        if name.lower() in sensitive:
            req.remove_header(name)
    for name in ("Authorization", "Cookie", "X-Subject", "X-User-Id", "X-Account-Id", "X-Account-Service-Key", "X-Internal-Service-Key", "authorization", "cookie", "x-subject", "x-user-id", "x-account-id", "x-account-service-key", "x-internal-service-key"):
        req.remove_header(name)
    subject = ctx.state.get("x_subject")
    if subject:
        req.set_header("X-Subject", subject)
    req.set_header("X-Internal-Service-Key", _trusted_secret())


@register_auth_strategy("account_service")
def account_service_factory(config):
    account_key = _secret("ACCOUNT_SERVICE_KEY")
    timeout = _timeout()

    def validate(ctx):
        authorization = ctx.request.headers.get("Authorization", "")
        match = re.fullmatch(r"(?i:Bearer) ([^\s]+)", authorization)
        if not match or len(match.group(1)) > 16 * 1024:
            return None
        token = match.group(1)
        try:
            response = ctx.services.account.post(
                "/internal/auth/validate",
                headers={"Authorization": "Bearer " + token, "X-Account-Service-Key": account_key},
                timeout=timeout,
            )
            if response.status_code == 403:
                raise HTTPException(status_code=403, detail={"error": "insufficient_scope"})
            if response.status_code != 200:
                raise HTTPException(status_code=503, detail={"error": "authentication_unavailable"})
            payload = response.json()
            if not isinstance(payload, dict) or type(payload.get("valid")) is not bool:
                raise ValueError
            if payload["valid"] is False:
                return None
            account_id = payload.get("accountId")
            group_id = payload.get("groupId")
            if account_id is not None and group_id is not None:
                raise ValueError
            if account_id is not None:
                if not _identifier(account_id) or (group_id is not None):
                    raise ValueError
                ctx.state["x_subject"] = json.dumps({"type": "user", "id": account_id})
                return {"accountId": account_id, "userId": account_id, "sub": str(account_id)}
            if "accountId" in payload or not _identifier(group_id):
                raise ValueError
            level = payload.get("accessLevel")
            if type(level) is not int or not 0 <= level <= 2147483647:
                raise ValueError
            ctx.state["x_subject"] = json.dumps({"type": "group", "id": group_id})
            return {"groupId": group_id, "access_level": level, "sub": str(group_id)}
        except HTTPException:
            raise
        except Exception:
            raise HTTPException(status_code=503, detail={"error": "authentication_unavailable"}) from None

    return validate
