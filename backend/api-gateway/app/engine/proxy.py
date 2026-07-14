"""
HTTP-прокси для декларативного API Gateway.

Выполняет HTTP-запрос к бэкенд-сервису с подстановкой параметров
из path, query, body и JWT.
"""

from __future__ import annotations

from typing import Any, Optional

from flask import Response as FlaskResponse
import requests as http_requests

from app.engine.context import RouteContext
from app.engine.models import ParamsConfig, ProxyConfig, RouteConfig
from app.security import get_user_id


def execute_proxy(route: RouteConfig, ctx: RouteContext) -> FlaskResponse:
    """
    Выполняет прокси-запрос к бэкенд-сервису.

    1. Подставляет path_params в целевой URL
    2. Подставляет query/body параметры
    3. Делает HTTP-запрос
    4. Возвращает Flask Response с телом и статусом бэкенда

    Args:
        route: Конфигурация маршрута.
        ctx: Контекст запроса с path_params, jwt, services.

    Returns:
        Flask Response.
    """
    proxy_cfg = route.proxy
    if proxy_cfg is None:
        from app.status import not_implemented
        return not_implemented("No proxy config")

    # 1. Подставляем path_params в целевой путь
    target_path = _resolve_path(proxy_cfg.path, ctx.path_params)

    # 2. Получаем клиент сервиса
    client = ctx.services.get_client(proxy_cfg.service)
    if client is None:
        from app.status import not_implemented
        return not_implemented(f"Unknown service: {proxy_cfg.service}")

    # 3. Собираем параметры запроса
    method = ctx.request.method.lower()
    headers = _build_headers(ctx, proxy_cfg)
    params = _build_query_params(route, ctx)
    body = _build_body(route, ctx)

    # 4. Выполняем запрос
    try:
        if proxy_cfg.skip_body or method in ("get", "delete"):
            resp = client.request(
                method.upper(),
                target_path,
                headers=headers,
                params=params,
            )
        else:
            resp = client.request(
                method.upper(),
                target_path,
                headers=headers,
                params=params,
                json=body,
            )
    except http_requests.RequestException as e:
        from app.status import bad_gateway
        return bad_gateway(f"Upstream error: {e}")

    # 5. Возвращаем ответ
    return _to_flask_response(resp)


def _resolve_path(template: str, path_params: dict[str, Any]) -> str:
    """Подставляет {placeholders} из path_params в шаблон пути."""
    result = template
    for key, value in path_params.items():
        placeholder = "{" + key + "}"
        result = result.replace(placeholder, str(value))
    return result


def _build_headers(ctx: RouteContext, proxy_cfg: ProxyConfig) -> dict[str, str]:
    """Собирает заголовки для прокси-запроса."""
    headers = {}
    # Копируем заголовки из оригинального запроса
    for key, value in ctx.request.headers.items():
        if key.lower() not in ("host", "content-length", "content-type"):
            headers[key] = value
    # Добавляем заголовки из конфига
    headers.update(proxy_cfg.headers)
    return headers


def _build_query_params(route: RouteConfig, ctx: RouteContext) -> dict[str, Any]:
    """Собирает query-параметры для прокси-запроса."""
    params_cfg = route.params
    if params_cfg is None or params_cfg.query is None:
        # По умолчанию передаём все query-параметры клиента
        return dict(ctx.request.args)

    if params_cfg.query == "*":
        # Форвард всех входящих + userId из JWT
        result = dict(ctx.request.args)
        if ctx.jwt and get_user_id(ctx.jwt):
            result["userId"] = get_user_id(ctx.jwt)
        return result

    if isinstance(params_cfg.query, dict):
        result = {}
        for dest, source in params_cfg.query.items():
            if source == "*":
                # Остальные параметры
                for k, v in ctx.request.args.items():
                    if k not in result:
                        result[k] = v
            else:
                result[dest] = _resolve_source(source, ctx)
        return result

    return dict(ctx.request.args)


def _build_body(route: RouteConfig, ctx: RouteContext) -> Optional[dict]:
    """Собирает тело для прокси-запроса (body injection)."""
    params_cfg = route.params
    if params_cfg is None or params_cfg.body is None:
        # Передаём тело как есть
        return ctx.request.get_json(silent=True)

    # Body injection
    body = ctx.request.get_json(silent=True) or {}
    for dest, source in params_cfg.body.items():
        body[dest] = _resolve_source(source, ctx)
    return body


def _resolve_source(expr: str, ctx: RouteContext) -> Any:
    """
    Разрешает source-выражение в значение.

    Поддерживаемые форматы:
    - "{jwt.field}" — из payload JWT
    - "{path.field}" — из path-параметров
    - "{query.field}" — из query-параметров запроса
    - "литерал" — возвращается как есть
    """
    if expr.startswith("{") and expr.endswith("}"):
        inner = expr[1:-1]
        if "." in inner:
            source, key = inner.split(".", 1)
            if source == "jwt":
                raw = ctx.jwt.get(key) if ctx.jwt else None
                if raw is None and key == "userId":
                    raw = ctx.jwt.get("sub") if ctx.jwt else None
                return raw
            elif source == "path":
                return ctx.path_params.get(key)
            elif source == "query":
                return ctx.request.args.get(key)
    return expr


def _to_flask_response(resp: http_requests.Response) -> FlaskResponse:
    """Конвертирует requests.Response в Flask Response."""
    content_type = resp.headers.get("Content-Type", "application/json")
    
    try:
        data = resp.json()
        from flask import jsonify
        response = jsonify(data)
        response.status_code = resp.status_code
        return response
    except (ValueError, TypeError):
        return FlaskResponse(
            response=resp.content,
            status=resp.status_code,
            content_type=content_type,
        )
