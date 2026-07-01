"""
Контекст запроса для декларативного API Gateway.

Содержит RouteContext — объект, передаваемый через pipeline
и доступный всем хендлерам (access и response).
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Optional

from flask import Request


class AccessResult:
    """Результат проверки access-хендлера."""

    def __init__(self, allowed: bool, response=None):
        self.allowed = allowed
        self.response = response


@dataclass
class RouteContext:
    """
    Контекст запроса, пробрасываемый через весь pipeline.

    Предоставляет хендлерам:
    - request: оригинальный Flask Request
    - path_params: параметры из URL (group_id, character_id, ...)
    - jwt: декодированный payload JWT (или None)
    - services: реестр HTTP-клиентов для бэкенд-сервисов
    - state: mutable dict для передачи данных между этапами pipeline

    Хендлеры используют ctx.allow() и ctx.deny() для возврата результата.
    """
    request: Request
    """Оригинальный Flask Request."""
    path_params: dict[str, Any]
    """Параметры из URL (group_id, character_id, ...)."""
    jwt: Optional[dict[str, Any]] = None
    """Декодированный payload JWT (или None, если auth=none)."""
    services: Any = None
    """ServiceRegistry с HTTP-клиентами для бэкендов."""
    state: dict[str, Any] = field(default_factory=dict)
    """Mutable storage для передачи данных между этапами pipeline."""
    params: dict[str, Any] = field(default_factory=dict)
    """Собранные query + body параметры после injection."""

    def allow(self) -> AccessResult:
        """Возвращает положительный результат проверки доступа."""
        return AccessResult(allowed=True)

    def deny(self, response=None) -> AccessResult:
        """
        Возвращает отрицательный результат проверки доступа.

        Если response не указан, будет использован стандартный 403 Forbidden.
        """
        if response is None:
            from app.status import forbidden
            response = forbidden()
        return AccessResult(allowed=False, response=response)
