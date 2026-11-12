from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from app.clients.campaign import CampaignClient
from app.clients.game_systems import GameSystemsClient
from app.core.state import SyncStateStore


@dataclass
class SyncResult:
    system_id: str
    system_name: str
    version_id: str
    version: str
    group_id: int
    created: list[str] = field(default_factory=list)
    updated: list[str] = field(default_factory=list)
    unchanged: list[str] = field(default_factory=list)
    previous_version_id: str | None = None
    errors: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return {
            "system_id": self.system_id,
            "system_name": self.system_name,
            "version_id": self.version_id,
            "version": self.version,
            "group_id": self.group_id,
            "created": self.created,
            "updated": self.updated,
            "unchanged": self.unchanged,
            "previous_version_id": self.previous_version_id,
            "errors": self.errors,
        }


class SyncEngine:
    """Оркестратор-мост между game-systems и campaign.

    Логика (похожа на git, но не обязана быть быстрой):
      1. Берём версию системы из game-systems (контент: items, skills, character_template).
      2. Сравниваем с текущим состоянием группы в campaign по имени.
      3. Обновляем существующие копии, добавляем недостающие. Ничего не удаляем.
      4. Записываем связь с предыдущей синхронизированной версией (для истории).
    """

    def __init__(
        self,
        gs: GameSystemsClient,
        campaign: CampaignClient,
        state: SyncStateStore,
    ):
        self._gs = gs
        self._campaign = campaign
        self._state = state

    async def sync_version_to_group(
        self, system_id: str, version_id: str, group_id: int
    ) -> SyncResult:
        system = await self._gs.get_system(system_id)
        version = await self._gs.get_version(system_id, version_id)
        content = await self._gs.get_content(system_id, version_id)

        result = SyncResult(
            system_id=system_id,
            system_name=system.get("name", system_id),
            version_id=version_id,
            version=version.get("version", version_id),
            group_id=group_id,
        )

        prev = self._state.get_applied(system_id, version_id)
        if prev:
            result.previous_version_id = prev.get("previous_version_id")

        await self._sync_items(group_id, content.get("items", []), result)
        await self._sync_skills(group_id, content.get("skills", []), result)
        await self._sync_template(group_id, content.get("character_template"), result)

        # Связь со старой версией: предыдущая версия этой системы, применённая к группе.
        previous_version_id = self._find_previous_version(system_id, version_id, group_id)
        result.previous_version_id = previous_version_id

        self._state.record(system_id, version_id, group_id, previous_version_id)
        return result

    # --- Предметы ---
    async def _sync_items(self, group_id: int, items: list[dict], result: SyncResult) -> None:
        existing = {i.get("name"): i for i in await self._campaign.list_items(group_id)}
        for item in items:
            name = item.get("name")
            if not name:
                continue
            payload = _item_payload(item)
            if name in existing:
                existing_id = existing[name].get("id")
                if _item_changed(existing[name], item):
                    try:
                        await self._campaign.update_item(group_id, existing_id, payload)
                        result.updated.append(f"item:{name}")
                    except Exception as e:  # noqa: BLE001
                        result.errors.append(f"item:{name}: {e}")
                else:
                    result.unchanged.append(f"item:{name}")
            else:
                try:
                    await self._campaign.create_item(group_id, payload)
                    result.created.append(f"item:{name}")
                except Exception as e:  # noqa: BLE001
                    result.errors.append(f"item:{name}: {e}")

    # --- Навыки ---
    async def _sync_skills(self, group_id: int, skills: list[dict], result: SyncResult) -> None:
        existing = {s.get("name"): s for s in await self._campaign.list_skills(group_id)}
        for skill in skills:
            name = skill.get("name")
            if not name:
                continue
            payload = _skill_payload(skill)
            if name in existing:
                existing_id = existing[name].get("id")
                if _skill_changed(existing[name], skill):
                    try:
                        await self._campaign.update_skill(group_id, existing_id, payload)
                        result.updated.append(f"skill:{name}")
                    except Exception as e:  # noqa: BLE001
                        result.errors.append(f"skill:{name}: {e}")
                else:
                    result.unchanged.append(f"skill:{name}")
            else:
                try:
                    await self._campaign.create_skill(group_id, payload)
                    result.created.append(f"skill:{name}")
                except Exception as e:  # noqa: BLE001
                    result.errors.append(f"skill:{name}: {e}")

    # --- Шаблон персонажа ---
    async def _sync_template(
        self, group_id: int, template: dict | None, result: SyncResult
    ) -> None:
        if not template:
            return
        payload = _template_payload(template)
        existing = await self._campaign.get_template(group_id)
        if existing is None:
            try:
                await self._campaign.create_template(group_id, payload)
                result.created.append("template")
            except Exception as e:  # noqa: BLE001
                result.errors.append(f"template: {e}")
        else:
            if _template_changed(existing, template):
                try:
                    await self._campaign.update_template(group_id, payload)
                    result.updated.append("template")
                except Exception as e:  # noqa: BLE001
                    result.errors.append(f"template: {e}")
            else:
                result.unchanged.append("template")

    def _find_previous_version(
        self, system_id: str, version_id: str, group_id: int
    ) -> str | None:
        """Ищет предыдущую версию этой системы, уже применённую к группе."""
        applied = self._state.get_system(system_id)
        candidates = [
            vid
            for vid, rec in applied.items()
            if vid != version_id and rec.get("group_id") == group_id
        ]
        if not candidates:
            return None
        # Берём самую свежую из ранее применённых.
        return max(candidates, key=lambda vid: applied[vid].get("applied_at", 0))


# --- Преобразование контента снимка в payload campaign ---

def _item_payload(item: dict) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "name": item.get("name", ""),
        "description": item.get("description") or "",
    }
    if item.get("price") is not None:
        payload["price"] = item["price"]
    props = item.get("properties")
    if props:
        payload["attributes"] = [
            {"key": k, "name": k, "value": str(v)} for k, v in props.items()
        ]
    return payload


def _skill_payload(skill: dict) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "name": skill.get("name", ""),
        "description": skill.get("description") or "",
    }
    props = skill.get("properties")
    if props:
        payload["attributes"] = [
            {"key": k, "name": k, "value": str(v)} for k, v in props.items()
        ]
    return payload


def _template_payload(template: dict) -> dict[str, Any]:
    fields: dict[str, Any] = {}
    for f in template.get("fields", []):
        key = f.get("key")
        if not key:
            continue
        field: dict[str, Any] = {
            "name": f.get("label") or key,
            "description": "",
            "value": 0,
        }
        if f.get("formula"):
            field["formula"] = f["formula"]
        fields[key] = field
    return {"name": "system_template", "description": "", "fields": fields}


# --- Сравнение (по значимым полям) ---

def _item_changed(existing: dict, source: dict) -> bool:
    return (
        existing.get("name") != source.get("name")
        or (existing.get("description") or "") != (source.get("description") or "")
        or existing.get("price") != source.get("price")
    )


def _skill_changed(existing: dict, source: dict) -> bool:
    return (
        existing.get("name") != source.get("name")
        or (existing.get("description") or "") != (source.get("description") or "")
    )


def _template_changed(existing: dict, source: dict) -> bool:
    existing_fields = existing.get("fields") or {}
    source_fields = {f.get("key"): f for f in source.get("fields", [])}
    if set(existing_fields.keys()) != set(source_fields.keys()):
        return True
    for key, sf in source_fields.items():
        ef = existing_fields.get(key) or {}
        if (ef.get("name") or key) != (sf.get("label") or key):
            return True
        if (ef.get("formula") or "") != (sf.get("formula") or ""):
            return True
    return False
