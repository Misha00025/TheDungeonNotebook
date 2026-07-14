"""
Pipeline обработки запроса в декларативном API Gateway.

Порядок обработки:
1. Auth — проверка JWT (если auth=required)
2. Access — вызов access-хендлера (если указан)
3. Execute — прокси в бэкенд или вызов response-хендлера
"""

from __future__ import annotations

from flask import Response as FlaskResponse
import jwt as pyjwt

from app import PUBLIC_KEY
from app.engine.context import RouteContext
from app.engine.models import ResponseConfig, RouteConfig
from app.engine.registry import (
    access_handler_registry,
    response_handler_registry,
)


def execute_pipeline(
    route: RouteConfig,
    ctx: RouteContext,
) -> FlaskResponse:
    """
    Выполняет полный pipeline обработки запроса.

    Args:
        route: Конфигурация маршрута.
        ctx: Контекст запроса (path_params заполнены, services проинициализирован).

    Returns:
        Flask Response.
    """
    # Step 1: Auth
    if route.auth == "required":
        raw_token = ctx.request.headers.get("Authorization")
        if not raw_token:
            from app.status import unauthorized
            return unauthorized("Authorization header is required")

        ok, payload = _validate_jwt(raw_token)
        if not ok:
            from app.status import unauthorized
            return unauthorized("Invalid or expired token")

        ctx.jwt = payload

    # Step 2: Access
    access_name = route.get_access_handler(ctx.request.method)
    if access_name:
        handler = access_handler_registry.get(access_name)
        if handler is None:
            from app.status import not_implemented
            return not_implemented(f"Unknown access handler: {access_name}")

        result = handler(ctx)
        if not result.allowed:
            return result.response if result.response else _default_forbidden()

    # Step 3: Execute (Proxy or Handler)
    if route.route_type.value == "handler":
        handler = response_handler_registry.get(route.handler)
        if handler is None:
            from app.status import not_implemented
            return not_implemented(f"Unknown response handler: {route.handler}")
        response = handler(ctx)
    else:
        from app.engine.proxy import execute_proxy
        response = execute_proxy(route, ctx)

    # Step 4: Response Transform
    if route.response:
        response = apply_response_transform(route.response, response, ctx)

    return response


def _validate_jwt(raw_token: str) -> tuple[bool, dict | None]:
    """Проверяет JWT локально через RSA public key и возвращает payload.

    Опционально проверяет iss, если OIDC_ISSUER задан.
    """
    token = raw_token
    if token.startswith("Bearer "):
        token = token[7:]

    if not PUBLIC_KEY:
        raise RuntimeError("PUBLIC_KEY is not loaded")

    try:
        options = {"verify_signature": True, "verify_exp": True}

        payload = pyjwt.decode(
            token,
            PUBLIC_KEY,
            algorithms=["RS256"],
            options=options,
        )

        from app import OIDC_ISSUER
        if OIDC_ISSUER and payload.get("iss") and payload["iss"] != OIDC_ISSUER:
            return False, None

        return True, payload
    except pyjwt.PyJWTError:
        return False, None


def _default_forbidden() -> FlaskResponse:
    """Возвращает стандартный 403 Forbidden."""
    from app.status import forbidden
    return forbidden()


def apply_response_transform(
    response_cfg: ResponseConfig,
    response: FlaskResponse,
    ctx: RouteContext,
) -> FlaskResponse:
    from flask import jsonify

    from app.engine.registry import response_transform_registry

    try:
        data = response.get_json()
    except Exception:
        data = None

    if response_cfg.wrap and data is not None:
        data = {response_cfg.wrap: data}

    if response_cfg.handler:
        transform_fn = response_transform_registry.get(response_cfg.handler)
        if transform_fn:
            data = transform_fn(data, ctx)

    if data is not None:
        new_response = jsonify(data)
        new_response.status_code = response.status_code
        for key, value in response.headers.items():
            if key.lower() not in ("content-type", "content-length"):
                new_response.headers[key] = value
        return new_response

    return response
