from app.engine.context import RouteContext
from app.engine.registry import register_access_handler
from app.engine.status import forbidden


def get_user_id(jwt_payload: dict | None) -> str | None:
    if jwt_payload is None:
        return None
    return jwt_payload.get("userId") or jwt_payload.get("sub")


def get_group_id(jwt_payload: dict | None) -> str | None:
    if jwt_payload is None:
        return None
    return jwt_payload.get("groupId")


def get_user_accesses(ctx: RouteContext, user_id) -> list[dict] | None:
    pres = ctx.services.campaign.get("/polices/groups", params={"userId": user_id})
    if not pres.ok:
        return None
    return pres.json().get("users", [])


def check_access_to_group_by_jwt(
    ctx: RouteContext,
    group_id: int,
    jwt_payload: dict | None,
    characters: list | None = None,
) -> tuple[bool, bool, object]:
    from app.engine.status import unauthorized, forbidden

    uid = get_user_id(jwt_payload)
    gid = get_group_id(jwt_payload)

    if uid is None and gid is None:
        return False, False, unauthorized()

    is_admin = False
    if gid is not None:
        if int(gid) != group_id:
            return False, False, forbidden()
        is_admin = True
    elif uid is not None:
        accesses = get_user_accesses(ctx, uid)
        if accesses is None:
            return False, False, forbidden()
        group_access = None
        for access in accesses:
            if access["groupId"] == int(group_id):
                group_access = access
                break
        if group_access is None:
            return False, False, forbidden()
        if characters is not None:
            characters.extend(group_access.get("characters", []))
        is_admin = bool(group_access.get("isAdmin", False))

    return True, is_admin, None


def check_access_to_character_by_jwt(
    ctx: RouteContext,
    group_id: int,
    character_id: int,
    jwt_payload: dict | None,
) -> tuple[bool, bool, bool, object]:
    from app.engine.status import forbidden

    characters = []
    ok, is_admin, response = check_access_to_group_by_jwt(
        ctx, group_id, jwt_payload, characters
    )
    if not ok:
        return ok, False, False, response
    if is_admin:
        return True, True, True, None

    character_access = None
    for access in characters:
        if int(access["characterId"]) == int(character_id):
            character_access = access
            break

    if character_access is None:
        return False, False, False, forbidden()
    else:
        return True, False, bool(character_access["canWrite"]), None


@register_access_handler("group_member")
def check_group_member(ctx: RouteContext):
    group_id = ctx.path_params.get("group_id")
    if group_id is None:
        return ctx.deny(forbidden())
    group_id = int(group_id)

    ok, is_admin, response = check_access_to_group_by_jwt(ctx, group_id, ctx.jwt)
    if not ok:
        return ctx.deny(response)

    ctx.state["is_admin"] = is_admin
    return ctx.allow()


@register_access_handler("group_admin")
def check_group_admin(ctx: RouteContext):
    group_id = ctx.path_params.get("group_id")
    if group_id is None:
        return ctx.deny(forbidden())
    group_id = int(group_id)

    ok, is_admin, response = check_access_to_group_by_jwt(ctx, group_id, ctx.jwt)
    if not ok or not is_admin:
        return ctx.deny(response or forbidden())

    return ctx.allow()


@register_access_handler("character_viewer")
def check_character_viewer(ctx: RouteContext):
    group_id = ctx.path_params.get("group_id")
    character_id = ctx.path_params.get("character_id")
    if group_id is None or character_id is None:
        return ctx.deny(forbidden())
    group_id = int(group_id)
    character_id = int(character_id)

    ok, is_admin, can_write, response = check_access_to_character_by_jwt(
        ctx, group_id, character_id, ctx.jwt
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
    group_id = int(group_id)
    character_id = int(character_id)

    ok, is_admin, can_write, response = check_access_to_character_by_jwt(
        ctx, group_id, character_id, ctx.jwt
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
    group_id = int(group_id)
    character_id = int(character_id)

    ok, is_admin, _, response = check_access_to_character_by_jwt(
        ctx, group_id, character_id, ctx.jwt
    )
    if not ok or not is_admin:
        return ctx.deny(response or forbidden())

    return ctx.allow()


@register_access_handler("self_only")
def check_self_only(ctx: RouteContext):
    user_id = ctx.path_params.get("user_id")
    jwt_user_id = get_user_id(ctx.jwt)

    if user_id is None or jwt_user_id is None:
        return ctx.deny(forbidden())

    if int(user_id) != int(jwt_user_id):
        return ctx.deny(forbidden())

    return ctx.allow()


@register_access_handler("quest_writer")
def check_quest_writer(ctx: RouteContext):
    group_id = ctx.path_params.get("group_id")
    quest_id = ctx.path_params.get("quest_id")

    if group_id is None or quest_id is None:
        return ctx.deny(forbidden())
    group_id = int(group_id)

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
        ok, is_admin, response = check_access_to_group_by_jwt(ctx, group_id, ctx.jwt)
        if not ok or not is_admin:
            return ctx.deny(response or forbidden())
        return ctx.allow()

    characters = []
    ok, is_admin, response = check_access_to_group_by_jwt(ctx, group_id, ctx.jwt, characters)
    if not ok:
        return ctx.deny(response)

    if is_admin:
        return ctx.allow()

    # Non-admin can't change assignedCharacters via PATCH
    if ctx.request.method == "PATCH":
        body = ctx.state.get("body", {}) or {}
        if "assignedCharacters" in body:
            return ctx.deny(forbidden())

    assigned_set = set(int(c) for c in assigned_characters)
    for char_access in characters:
        if int(char_access["characterId"]) in assigned_set and char_access.get("canWrite"):
            return ctx.allow()

    return ctx.deny(forbidden())
