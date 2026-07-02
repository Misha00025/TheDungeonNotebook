"""
Реестры для декларативного API Gateway.

Содержит:
- ServiceRegistry и ServiceClient — HTTP-клиенты для бэкенд-сервисов
- AccessHandlerRegistry — реестр access-хендлеров (проверка прав)
- ResponseHandlerRegistry — реестр response-хендлеров (кастомные ответы)
"""

from __future__ import annotations

from typing import Callable, Optional
import requests


class ServiceClient:
    """HTTP-клиент для одного бэкенд-сервиса."""

    def __init__(self, base_url: str, timeout: int = 30):
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout

    def _build_url(self, path: str) -> str:
        path = path.lstrip("/")
        return f"{self.base_url}/{path}"

    def request(self, method: str, path: str, **kwargs) -> requests.Response:
        url = self._build_url(path)
        kwargs.setdefault("timeout", self.timeout)
        return requests.request(method, url, **kwargs)

    def get(self, path: str, **kwargs) -> requests.Response:
        return self.request("GET", path, **kwargs)

    def post(self, path: str, **kwargs) -> requests.Response:
        return self.request("POST", path, **kwargs)

    def put(self, path: str, **kwargs) -> requests.Response:
        return self.request("PUT", path, **kwargs)

    def patch(self, path: str, **kwargs) -> requests.Response:
        return self.request("PATCH", path, **kwargs)

    def delete(self, path: str, **kwargs) -> requests.Response:
        return self.request("DELETE", path, **kwargs)


class ServiceRegistry:
    """
    Реестр HTTP-клиентов для бэкенд-сервисов.

    Позволяет обращаться к сервисам через атрибуты:
    ctx.services.campaign.get("/groups/1")
    """

    def __init__(self, services: dict[str, dict]):
        self._services: dict[str, ServiceClient] = {}
        for name, cfg in services.items():
            self._services[name] = ServiceClient(
                cfg["base_url"],
                cfg.get("timeout", 30)
            )

    def __getattr__(self, name: str) -> ServiceClient:
        if name.startswith("_"):
            raise AttributeError(name)
        if name not in self._services:
            raise KeyError(f"Unknown service: {name}")
        return self._services[name]

    def get_client(self, name: str) -> Optional[ServiceClient]:
        """Получить клиент сервиса по имени (без исключения)."""
        return self._services.get(name)


class AccessHandlerRegistry:
    """
    Реестр access-хендлеров.

    Хендлеры регистрируются через декоратор @register_access_handler("name").
    """

    def __init__(self):
        self._handlers: dict[str, Callable] = {}

    def register(self, name: str):
        """Декоратор для регистрации access-хендлера."""
        def decorator(fn):
            self._handlers[name] = fn
            return fn
        return decorator

    def get(self, name: str) -> Optional[Callable]:
        """Получить access-хендлер по имени."""
        return self._handlers.get(name)

    def has(self, name: str) -> bool:
        """Проверить, зарегистрирован ли хендлер с таким именем."""
        return name in self._handlers


class ResponseHandlerRegistry:
    """
    Реестр response-хендлеров (кастомные обработчики, не прокси).

    Хендлеры регистрируются через декоратор @register_response_handler("name").
    """

    def __init__(self):
        self._handlers: dict[str, Callable] = {}

    def register(self, name: str):
        """Декоратор для регистрации response-хендлера."""
        def decorator(fn):
            self._handlers[name] = fn
            return fn
        return decorator

    def get(self, name: str) -> Optional[Callable]:
        """Получить response-хендлер по имени."""
        return self._handlers.get(name)


class ResponseTransformRegistry:
    """
    Реестр response-трансформеров.

    Трансформер получает данные ответа от бэкенда и возвращает
    трансформированные данные. Может также использовать ctx
    для доступа к JWT, параметрам запроса и т.д.

    Сигнатура: transform(data: Any, ctx: RouteContext) -> Any
    """

    def __init__(self):
        self._transforms: dict[str, Callable] = {}

    def register(self, name: str):
        """Декоратор для регистрации response-трансформера."""
        def decorator(fn):
            self._transforms[name] = fn
            return fn
        return decorator

    def get(self, name: str) -> Optional[Callable]:
        """Получить трансформер по имени."""
        return self._transforms.get(name)


# Глобальные экземпляры реестров
access_handler_registry = AccessHandlerRegistry()
response_handler_registry = ResponseHandlerRegistry()
response_transform_registry = ResponseTransformRegistry()

# Декораторы для удобного импорта
register_access_handler = access_handler_registry.register
register_response_handler = response_handler_registry.register
register_response_transform = response_transform_registry.register
