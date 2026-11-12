from __future__ import annotations

import json
import os
import threading
from typing import Any


class SyncStateStore:
    """Хранит состояние синхронизации: какие версии систем уже применены к каким группам.

    Формат:
    {
      "<system_id>": {
        "<version_id>": {
          "group_id": <int>,
          "applied_at": <unix_ts>,
          "previous_version_id": <str | null>
        }
      }
    }

    Файл защищён блокировкой (threading.Lock), т.к. фоновые задачи и HTTP-хендлеры
    могут обращаться к нему из разных потоков.
    """

    def __init__(self, path: str):
        self._path = path
        self._lock = threading.Lock()
        self._data: dict[str, Any] = {}
        self._load()

    def _load(self) -> None:
        if not self._path or not os.path.exists(self._path):
            return
        try:
            with open(self._path, "r", encoding="utf-8") as f:
                self._data = json.load(f)
        except (OSError, ValueError):
            self._data = {}

    def _save(self) -> None:
        if not self._path:
            return
        os.makedirs(os.path.dirname(self._path) or ".", exist_ok=True)
        tmp = self._path + ".tmp"
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(self._data, f, ensure_ascii=False, indent=2)
        os.replace(tmp, self._path)

    def get_applied(self, system_id: str, version_id: str) -> dict[str, Any] | None:
        with self._lock:
            return self._data.get(system_id, {}).get(version_id)

    def get_system(self, system_id: str) -> dict[str, Any]:
        with self._lock:
            return dict(self._data.get(system_id, {}))

    def record(
        self,
        system_id: str,
        version_id: str,
        group_id: int,
        previous_version_id: str | None,
    ) -> None:
        with self._lock:
            self._data.setdefault(system_id, {})[version_id] = {
                "group_id": group_id,
                "applied_at": _now(),
                "previous_version_id": previous_version_id,
            }
            self._save()


def _now() -> int:
    import time

    return int(time.time())
