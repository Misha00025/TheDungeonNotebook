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

from app.engine.context import RouteContext
from app.engine.models import RouteConfig
from app.engine.registry import (
    ServiceRegistry,
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

        ok, payload = _validate_jwt(raw_token, ctx.services)
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
        return handler(ctx)

    from app.engine.proxy import execute_proxy
    return execute_proxy(route, ctx)


def _validate_jwt(
    raw_token: str,
    services: ServiceRegistry,
) -> tuple[bool, dict | None]:
    """
    Проверяет JWT через auth-service и возвращает payload.

    Args:
        raw_token: Значение заголовка Authorization (с "Bearer " или без).
        services: Реестр сервисов.

    Returns:
        (True, payload) если токен валиден, (False, None) если нет.
    """
    token = raw_token
    if token.startswith("Bearer "):
        token = token[7:]

    # Проверяем токен через auth-service
    auth_client = services.get_client("auth")
    if auth_client is None:
        return False, None

    try:
        resp = auth_client.get("/auth/check", params={"accessToken": token})
        if not resp.ok:
            return False, None
    except Exception:
        return False, None

    # Декодируем payload без проверки подписи
    # (auth-service уже подтвердил валидность токена)
    try:
        payload = pyjwt.decode(token, options={"verify_signature": False})
        return True, payload
    except pyjwt.PyJWTError:
        return False, None


def _default_forbidden() -> FlaskResponse:
    """Возвращает стандартный 403 Forbidden."""
    from app.status import forbidden
    return forbidden()
