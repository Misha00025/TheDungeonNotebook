from __future__ import annotations

from typing import Any

import httpx

from app.config import settings


class CampaignClient:
    """HTTP-клиент к campaign-service (прямые вызовы, заголовок X-Subject).

    Синхронизация работает на уровне группы (campaign): предметы, навыки и
    шаблон персонажа группы. Все мутации — идемпотентные (сравнение по имени),
    удаления не выполняются.
    """

    def __init__(self, base_url: str):
        self._base = base_url.rstrip("/")
        self._client = httpx.AsyncClient(
            base_url=self._base,
            headers={"X-Subject": settings.x_subject},
            timeout=30.0,
        )

    async def aclose(self) -> None:
        await self._client.aclose()

    # --- Предметы группы ---
    async def list_items(self, group_id: int) -> list[dict[str, Any]]:
        resp = await self._client.get(f"/groups/{group_id}/items")
        resp.raise_for_status()
        return resp.json().get("items", [])

    async def create_item(self, group_id: int, payload: dict[str, Any]) -> dict[str, Any]:
        resp = await self._client.post(f"/groups/{group_id}/items", json=payload)
        resp.raise_for_status()
        return resp.json()

    async def update_item(
        self, group_id: int, item_id: int, payload: dict[str, Any]
    ) -> dict[str, Any]:
        resp = await self._client.put(f"/groups/{group_id}/items/{item_id}", json=payload)
        resp.raise_for_status()
        return resp.json()

    # --- Навыки группы ---
    async def list_skills(self, group_id: int) -> list[dict[str, Any]]:
        resp = await self._client.get(f"/groups/{group_id}/skills")
        resp.raise_for_status()
        return resp.json().get("skills", [])

    async def create_skill(self, group_id: int, payload: dict[str, Any]) -> dict[str, Any]:
        resp = await self._client.post(f"/groups/{group_id}/skills", json=payload)
        resp.raise_for_status()
        return resp.json()

    async def update_skill(
        self, group_id: int, skill_id: int, payload: dict[str, Any]
    ) -> dict[str, Any]:
        resp = await self._client.put(f"/groups/{group_id}/skills/{skill_id}", json=payload)
        resp.raise_for_status()
        return resp.json()

    # --- Шаблон персонажа группы ---
    async def get_template(self, group_id: int) -> dict[str, Any] | None:
        resp = await self._client.get(f"/groups/{group_id}/characters/templates")
        resp.raise_for_status()
        templates = resp.json().get("templates", [])
        return templates[0] if templates else None

    async def create_template(self, group_id: int, payload: dict[str, Any]) -> dict[str, Any]:
        resp = await self._client.post(
            f"/groups/{group_id}/characters/templates", json=payload
        )
        resp.raise_for_status()
        return resp.json()

    async def update_template(self, group_id: int, payload: dict[str, Any]) -> dict[str, Any]:
        resp = await self._client.put(
            f"/groups/{group_id}/characters/templates", json=payload
        )
        resp.raise_for_status()
        return resp.json()
