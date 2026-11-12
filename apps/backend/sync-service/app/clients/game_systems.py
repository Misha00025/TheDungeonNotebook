from __future__ import annotations

from typing import Any

import httpx

from app.config import settings


class GameSystemsClient:
    """HTTP-клиент к game-systems-service (прямые вызовы, заголовок X-Subject)."""

    def __init__(self, base_url: str):
        self._base = base_url.rstrip("/")
        self._client = httpx.AsyncClient(
            base_url=self._base,
            headers={"X-Subject": settings.x_subject},
            timeout=30.0,
        )

    async def aclose(self) -> None:
        await self._client.aclose()

    async def list_systems(self) -> list[dict[str, Any]]:
        resp = await self._client.get("/systems")
        resp.raise_for_status()
        return resp.json()

    async def get_system(self, system_id: str) -> dict[str, Any]:
        resp = await self._client.get(f"/systems/{system_id}")
        resp.raise_for_status()
        return resp.json()

    async def list_versions(self, system_id: str) -> list[dict[str, Any]]:
        resp = await self._client.get(f"/systems/{system_id}/versions")
        resp.raise_for_status()
        return resp.json()

    async def get_version(self, system_id: str, version_id: str) -> dict[str, Any]:
        resp = await self._client.get(f"/systems/{system_id}/versions/{version_id}")
        resp.raise_for_status()
        return resp.json()

    async def get_content(self, system_id: str, version_id: str) -> dict[str, Any]:
        """Контент версии: {items, skills, character_template}."""
        resp = await self._client.get(
            f"/systems/{system_id}/versions/{version_id}/content"
        )
        resp.raise_for_status()
        return resp.json()
