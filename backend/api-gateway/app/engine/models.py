"""
Модели данных для декларативного API Gateway.

Содержит dataclass'ы для представления маршрутов, прокси-конфигурации,
параметров и сервисов.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Optional


class RouteType(Enum):
    """Тип маршрута: прокси в бэкенд или кастомный response-хендлер."""
    PROXY = "proxy"
    HANDLER = "handler"


@dataclass
class ProxyConfig:
    """Настройки проксирования запроса в бэкенд-сервис."""
    service: str
    """Имя сервиса из секции services."""
    path: str
    """Целевой путь в бэкенд-сервисе (может содержать {placeholders})."""
    skip_body: bool = False
    """Не передавать тело запроса (например, для PUT без тела)."""
    headers: dict[str, str] = field(default_factory=dict)
    """Дополнительные заголовки для прокси-запроса."""


@dataclass
class ParamsConfig:
    """Настройки подстановки параметров в запрос к бэкенду."""
    query: Optional[dict[str, str] | str] = None
    """
    Параметры для query-строки.
    Может быть:
    - "*" — форвард всех входящих query-параметров + userId из JWT
    - {"dest": "source"} — маппинг параметров
      source формата: "{jwt.field}", "{path.field}", "{query.field}" или литерал
    """
    body: Optional[dict[str, str]] = None
    """
    Параметры для JSON-тела запроса (body injection).
    {"dest": "{jwt.userId}"} — вставит userId из JWT в тело.
    """


@dataclass
class RouteConfig:
    """Конфигурация одного маршрута."""
    path: str
    """Flask-совместимый путь (например, /groups/<int:group_id>/items)."""
    methods: list[str] = field(default_factory=lambda: ["GET"])
    """HTTP-методы, которые обслуживает этот маршрут."""
    auth: str = "required"
    """Требование авторизации: "none" или "required"."""
    access: Optional[str | dict[str, str]] = None
    """
    Имя access-хендлера для проверки прав доступа.
    Может быть строкой (для всех методов) или словарём {method: handler_name}.
    """
    proxy: Optional[ProxyConfig] = None
    """Конфигурация прокси (если тип маршрута — PROXY)."""
    handler: Optional[str] = None
    """Имя response-хендлера (если тип маршрута — HANDLER)."""
    params: Optional[ParamsConfig] = None
    """Настройки подстановки параметров."""
    description: Optional[str] = None
    """Описание маршрута (для документации)."""

    @property
    def route_type(self) -> RouteType:
        """Определяет тип маршрута на основе настроек."""
        if self.handler:
            return RouteType.HANDLER
        return RouteType.PROXY

    def get_access_handler(self, method: str) -> Optional[str]:
        """Возвращает имя access-хендлера для указанного HTTP-метода."""
        if self.access is None:
            return None
        if isinstance(self.access, str):
            return self.access
        return self.access.get(method)


@dataclass
class ServiceConfig:
    """Конфигурация бэкенд-сервиса."""
    base_url: str
    """Базовый URL сервиса (например, http://campaign-service:8080)."""
    timeout: int = 30
    """Таймаут HTTP-запроса в секундах."""


@dataclass
class GatewayConfig:
    """Корневая конфигурация API Gateway."""
    services: dict[str, ServiceConfig] = field(default_factory=dict)
    """Словарь бэкенд-сервисов {имя: конфиг}."""
    routes: list[RouteConfig] = field(default_factory=list)
    """Список маршрутов."""
