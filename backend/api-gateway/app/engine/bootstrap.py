"""
Bootstrap — загрузка YAML-конфигурации и регистрация маршрутов во Flask.

Создаёт Blueprint с маршрутами из конфига, регистрирует его в Flask-приложении.
Использует префикс /v2/ для параллельной работы со старыми @route-декораторами.
"""

from __future__ import annotations

import os
from typing import Optional

from flask import Blueprint, Flask, request as flask_request

from app.engine.context import RouteContext
from app.engine.loader import load_config
from app.engine.models import GatewayConfig, RouteConfig
from app.engine.pipeline import execute_pipeline
from app.engine.registry import ServiceRegistry


def bootstrap(
    flask_app: Flask,
    config_path: Optional[str] = None,
    import_handlers: bool = True,
) -> GatewayConfig:
    """
    Загружает конфигурацию и регистрирует маршруты в Flask-приложении.

    Args:
        flask_app: Flask-приложение.
        config_path: Путь к YAML-файлу. Если None — ищет routes.yaml в корне сервиса.
        import_handlers: Автоматически импортировать хендлеры.

    Returns:
        GatewayConfig — загруженная конфигурация.
    """
    # Загружаем конфиг
    config = load_config(config_path)
    print(f"[Engine] Loaded {len(config.routes)} routes from config")

    # Импортируем хендлеры (чтобы декораторы сработали)
    if import_handlers:
        try:
            import handlers  # noqa: F401
            print("[Engine] Handlers imported from handlers/ directory")
        except ImportError as e:
            print(f"[Engine] Warning: handlers not available: {e}")

    # Создаём ServiceRegistry
    services_dict = {}
    for name, svc in config.services.items():
        services_dict[name] = {
            "base_url": svc.base_url,
            "timeout": svc.timeout,
        }
    registry = ServiceRegistry(services_dict)
    print(f"[Engine] Registered services: {list(services_dict.keys())}")

    # Создаём Blueprint
    bp_name = "engine_api"
    bp = Blueprint(bp_name, __name__, url_prefix=config.base_path or None)

    # Регистрируем каждый маршрут
    for route in config.routes:
        _register_route(bp, route, registry)

    # Регистрируем Blueprint в приложении
    flask_app.register_blueprint(bp)
    print(f"[Engine] Blueprint '{bp_name}' registered at '{config.base_path or '/'}'")

    return config


def _register_route(
    bp: Blueprint,
    route: RouteConfig,
    registry: ServiceRegistry,
) -> None:
    """Регистрирует один маршрут в Blueprint."""

    def make_view_func(rc: RouteConfig, reg: ServiceRegistry):
        def view_func(**path_params):
            ctx = RouteContext(
                request=flask_request,
                path_params=path_params,
                jwt=None,
                services=reg,
            )
            return execute_pipeline(rc, ctx)
        # Даём функции имя для Flask
        view_func.__name__ = f"engine_{rc.path.replace('/', '_').replace('<', '').replace('>', '')}"
        return view_func

    for method in route.methods:
        view_func = make_view_func(route, registry)
        bp.add_url_rule(
            route.path,
            endpoint=f"{route.path}_{method}",
            view_func=view_func,
            methods=[method],
        )
        print(f"  [Engine] {method:7s} {bp.url_prefix}{route.path}")
