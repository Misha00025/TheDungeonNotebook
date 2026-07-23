"""
Кастомные access-хендлеры для проверки прав доступа.

Это бизнес-логика проекта. Движок не знает про группы, персонажи,
isAdmin, canWrite — всё это определено здесь.

Каждый хендлер регистрируется через @register_access_handler("name")
и может быть использован в routes.yaml по имени.
"""

from app.engine.context import RouteContext
from app.engine.registry import register_access_handler
from app.security import check_access_to_group_by_jwt, check_access_to_character_by_jwt, get_user_id
from app.status import forbidden


# ============================================================
# Built-in: authenticated — проверка валидности JWT
# ============================================================
# Этот хендлер встроен в pipeline (если auth=required и нет access).
# Он проверяет, что токен есть и валиден через auth-service.
# Регистрируем явно для возможности переопределения.


# ============================================================
# Доступ к группе
# ============================================================

@register_access_handler("group_member")
def check_group_member(ctx: RouteContext):
    group_id = ctx.path_params.get("group_id")
    if group_id is None:
        return ctx.deny(forbidden())

    ok, is_admin, response = check_access_to_group_by_jwt(group_id, ctx.jwt)
    if not ok:
        return ctx.deny(response)

    ctx.state["is_admin"] = is_admin
    return ctx.allow()


@register_access_handler("group_admin")
def check_group_admin(ctx: RouteContext):
    group_id = ctx.path_params.get("group_id")
    if group_id is None:
        return ctx.deny(forbidden())

    ok, is_admin, response = check_access_to_group_by_jwt(group_id, ctx.jwt)
    if not ok or not is_admin:
        return ctx.deny(response or forbidden())

    return ctx.allow()


# ============================================================
# Доступ к персонажу
# ============================================================

@register_access_handler("character_viewer")
def check_character_viewer(ctx: RouteContext):
    group_id = ctx.path_params.get("group_id")
    character_id = ctx.path_params.get("character_id")
    if group_id is None or character_id is None:
        return ctx.deny(forbidden())

    ok, is_admin, can_write, response = check_access_to_character_by_jwt(
        group_id, character_id, ctx.jwt
    )
    if not ok:
        return ctx.deny(response)

    ctx.state["is_admin"] = is_admin
    ctx.state["can_write"] = can_write
    return ctx.allow()


@register_access_handler("character_writer")
def check_character_writer(ctx: RouteContext):
    group_id = ctx.path_params.get("group_id")
    character_id = ctx.path_params.get("character_id")
    if group_id is None or character_id is None:
        return ctx.deny(forbidden())

    ok, is_admin, can_write, response = check_access_to_character_by_jwt(
        group_id, character_id, ctx.jwt
    )
    if not ok or not (is_admin or can_write):
        return ctx.deny(response or forbidden())

    ctx.state["is_admin"] = is_admin
    ctx.state["can_write"] = can_write
    return ctx.allow()


@register_access_handler("character_admin")
def check_character_admin(ctx: RouteContext):
    group_id = ctx.path_params.get("group_id")
    character_id = ctx.path_params.get("character_id")
    if group_id is None or character_id is None:
        return ctx.deny(forbidden())

    ok, is_admin, _, response = check_access_to_character_by_jwt(
        group_id, character_id, ctx.jwt
    )
    if not ok or not is_admin:
        return ctx.deny(response or forbidden())

    return ctx.allow()


# ============================================================
# Специальные проверки
# ============================================================

@register_access_handler("self_only")
def check_self_only(ctx: RouteContext):
    """
    Проверяет, что пользователь редактирует свой собственный профиль.
    Используется для PATCH /users/{user_id}.
    """
    user_id = ctx.path_params.get("user_id")
    jwt_user_id = get_user_id(ctx.jwt)

    if user_id is None or jwt_user_id is None:
        return ctx.deny(forbidden())

    if int(user_id) != int(jwt_user_id):
        return ctx.deny(forbidden())

    return ctx.allow()


# ============================================================
# Доступ к квесту
# ============================================================

@register_access_handler("quest_writer")
def check_quest_writer(ctx: RouteContext):
    """
    Проверяет, что пользователь может редактировать квест.

    Разрешено если:
    - пользователь — админ группы, ИЛИ
    - пользователь имеет write-доступ хотя бы к одному персонажу, назначенному на квест
    """
    group_id = ctx.path_params.get("group_id")
    quest_id = ctx.path_params.get("quest_id")

    if group_id is None or quest_id is None:
        return ctx.deny(forbidden())

    user_id = get_user_id(ctx.jwt)
    if user_id is None:
        return ctx.deny(forbidden())

    try:
        quest_resp = ctx.services.campaign.get(f"/groups/{group_id}/quests/{quest_id}")
        if not quest_resp.ok:
            return ctx.deny(forbidden())
        quest_data = quest_resp.json()
        assigned_characters = quest_data.get("assignedCharacters", [])
    except Exception:
        return ctx.deny(forbidden())

    if not assigned_characters:
        ok, is_admin, response = check_access_to_group_by_jwt(group_id, ctx.jwt)
        if not ok or not is_admin:
            return ctx.deny(response or forbidden())
        return ctx.allow()

    characters = []
    ok, is_admin, response = check_access_to_group_by_jwt(group_id, ctx.jwt, characters)
    if not ok:
        return ctx.deny(response)

    if is_admin:
        return ctx.allow()

    assigned_set = set(int(c) for c in assigned_characters)
    for char_access in characters:
        if int(char_access["characterId"]) in assigned_set and char_access.get("canWrite"):
            return ctx.allow()

    return ctx.deny(forbidden())
