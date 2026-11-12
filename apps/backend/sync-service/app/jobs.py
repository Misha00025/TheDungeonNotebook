from __future__ import annotations

import asyncio
import uuid
from typing import Any

from app.core.sync import SyncEngine, SyncResult


class JobManager:
    """Асинхронный запуск синхронизации по явному запросу.

    Каждый запуск создаёт задачу (job) с уникальным id. Задача выполняется в
    фоне; статус и результат доступны по id. Это позволяет эндпоинту
    «Синхронизировать» вернуть управление сразу, а ГМ — опрашивать прогресс.
    """

    def __init__(self, engine: SyncEngine):
        self._engine = engine
        self._jobs: dict[str, dict[str, Any]] = {}

    def start(
        self, system_id: str, version_id: str, group_id: int
    ) -> dict[str, Any]:
        job_id = uuid.uuid4().hex
        self._jobs[job_id] = {
            "id": job_id,
            "status": "running",
            "system_id": system_id,
            "version_id": version_id,
            "group_id": group_id,
            "result": None,
            "error": None,
        }
        asyncio.create_task(self._run(job_id, system_id, version_id, group_id))
        return self._jobs[job_id]

    async def _run(
        self, job_id: str, system_id: str, version_id: str, group_id: int
    ) -> None:
        job = self._jobs[job_id]
        try:
            result: SyncResult = await self._engine.sync_version_to_group(
                system_id, version_id, group_id
            )
            job["status"] = "completed"
            job["result"] = result.to_dict()
        except Exception as e:  # noqa: BLE001
            job["status"] = "failed"
            job["error"] = str(e)

    def get(self, job_id: str) -> dict[str, Any] | None:
        return self._jobs.get(job_id)

    def list(self) -> list[dict[str, Any]]:
        return list(self._jobs.values())
