"""
Парсинг YAML-конфигурации в модели GatewayConfig.

Поддерживает:
- Секцию services
- Секцию routes с нормализацией single-method и multi-method форматов
- ProxyConfig, ParamsConfig, RouteConfig
"""

from __future__ import annotations

import os
import re
from typing import Any, Optional

import yaml

from app.engine.models import (
    GatewayConfig,
    ParamsConfig,
    ProxyConfig,
    RouteConfig,
    ServiceConfig,
)


def load_config(path: Optional[str] = None) -> GatewayConfig:
    """
    Загружает и парсит YAML-конфигурацию маршрутов.

    Args:
        path: Путь к YAML-файлу. Если None — ищет routes.yaml в корне сервиса.

    Returns:
        GatewayConfig с распарсенными сервисами и маршрутами.
    """
    if path is None:
        # Дефолтный путь — routes.yaml в корне сервиса,
        # работает из CWD (WORKDIR /app в Dockerfile, или корень
        # api-gateway при локальной разработке).
        path = "routes.yaml"

    with open(path) as f:
        raw = yaml.safe_load(f)

    return _parse_config(raw)


def _resolve_env_vars(value: str) -> str:
    """Подставляет переменные окружения формата ${VAR} или ${VAR:-default}."""
    def _replace(match):
        var_name = match.group(1)
        raw_default = match.group(2)
        default = raw_default.lstrip("-") if raw_default else None
        val = os.environ.get(var_name)
        if val is None:
            if default is not None:
                return default
            raise ValueError(
                f"Environment variable '{var_name}' is required "
                f"but not set (in routes.yaml service base_url)"
            )
        return val
    return re.sub(r'\$\{([^:}]+)(?::([^}]*))?\}', _replace, value)


def _parse_config(raw: dict) -> GatewayConfig:
    """Парсит сырой YAML-словарь в GatewayConfig."""
    base_path = raw.get("base_path", "/v2") or ""
    services_raw = raw.get("services", {}) or {}
    routes_raw = raw.get("routes", []) or []

    services = {}
    for name, cfg in services_raw.items():
        services[name] = ServiceConfig(
            base_url=_resolve_env_vars(cfg["base_url"]),
            timeout=cfg.get("timeout", 30),
        )

    routes = []
    for route_def in routes_raw:
        parsed_routes = _parse_route(route_def)
        routes.extend(parsed_routes)

    return GatewayConfig(base_path=base_path, services=services, routes=routes)


def _parse_route(route_def: dict) -> list[RouteConfig]:
    """
    Парсит один YAML-блок маршрута в один или несколько RouteConfig.

    Поддерживает:
    - Простой формат: method + proxy/handler
    - Multi-method формат: methods: {GET: ..., POST: ...}
    - Список methods: [GET, POST] с общим access/proxy
    """
    path = route_def["path"]

    # Multi-method формат (methods — словарь)
    if "methods" in route_def and isinstance(route_def["methods"], dict):
        result = []
        for method, method_cfg in route_def["methods"].items():
            # Наследуем общие поля, переопределяем method-специфичными
            merged = dict(route_def)
            merged.pop("methods", None)
            merged.update(method_cfg)
            merged["method"] = method
            # Убираем method из словаря, т.к. будем передавать как список
            result.extend(_parse_single_route(path, merged))
        return result

    # Список methods: [GET, POST] — один конфиг на все
    methods = route_def.get("methods")
    if isinstance(methods, list):
        result = []
        for method in methods:
            single_def = dict(route_def)
            single_def["method"] = method
            result.extend(_parse_single_route(path, single_def))
        return result

    # Одиночный method
    return _parse_single_route(path, route_def)


def _parse_single_route(path: str, route_def: dict) -> list[RouteConfig]:
    """Парсит один маршрут с одним HTTP-методом."""
    methods = [route_def.pop("method", "GET")]

    auth = route_def.get("auth", "required")
    access = route_def.get("access")
    description = route_def.get("description")

    # Proxy
    proxy = None
    if "proxy" in route_def:
        proxy_raw = route_def["proxy"]
        proxy = ProxyConfig(
            service=proxy_raw["service"],
            path=proxy_raw.get("path", path),
            skip_body=proxy_raw.get("skip_body", False),
            headers=proxy_raw.get("headers", {}),
        )

    # Handler
    handler = route_def.get("handler")

    # Params
    params = None
    if "params" in route_def:
        params_raw = route_def["params"]
        params = ParamsConfig(
            query=params_raw.get("query"),
            body=params_raw.get("body"),
        )

    # Response transform
    response = None
    if "response" in route_def:
        from app.engine.models import ResponseConfig
        response_raw = route_def["response"]
        response = ResponseConfig(
            wrap=response_raw.get("wrap"),
            handler=response_raw.get("handler"),
        )

    return [
        RouteConfig(
            path=path,
            methods=methods,
            auth=auth,
            access=access,
            proxy=proxy,
            handler=handler,
            params=params,
            response=response,
            description=description,
        )
    ]
