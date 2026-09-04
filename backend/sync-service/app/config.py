from __future__ import annotations

import os
from dataclasses import dataclass, field


@dataclass(frozen=True)
class Settings:
    """Конфигурация sync-service из переменных окружения."""

    game_systems_url: str = field(
        default_factory=lambda: os.environ.get(
            "GAME_SYSTEMS_SERVICE_URL", "http://game-systems-service:8080"
        )
    )
    campaign_url: str = field(
        default_factory=lambda: os.environ.get(
            "CAMPAIGN_SERVICE_URL", "http://campaign-service:8080"
        )
    )
    # Субъект, от имени которого sync-service обращается к сервисам.
    # По умолчанию — глобальный админ (имеет доступ ко всем системам и группам).
    x_subject: str = field(
        default_factory=lambda: os.environ.get(
            "SYNC_X_SUBJECT", '{"type":"admin","id":0}'
        )
    )
    # Файл состояния: какие версии систем уже синхронизированы в какие группы.
    state_file: str = field(
        default_factory=lambda: os.environ.get("SYNC_STATE_FILE", "/data/sync_state.json")
    )


settings = Settings()
