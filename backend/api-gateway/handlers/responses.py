from app.engine.context import RouteContext
from app.engine.registry import register_response_handler
from app.engine.status import ok, unauthorized, forbidden, not_found
from starlette.responses import Response


def get_user_id(jwt_payload: dict | None) -> str | None:
    if jwt_payload is None:
        return None
    return jwt_payload.get("userId") or jwt_payload.get("sub")


@register_response_handler("get_api")
async def handle_get_api(ctx: RouteContext):
    return ok({
        "message": "PyApiGate",
        "api_methods": []
    })


@register_response_handler("whoami")
async def handle_whoami(ctx: RouteContext):
    jwt_payload = ctx.jwt or {}
    gid = jwt_payload.get("groupId")

    # Service token: есть groupId, нет userId
    if gid is not None:
        return ok({
            "id": int(gid),
            "type": "group",
            "userId": None,
            "sub": jwt_payload.get("sub"),
            "groupId": gid,
        })

    # User token
    uid = get_user_id(jwt_payload)
    if uid is not None:
        return ok({
            "id": int(uid),
            "type": "user",
            "userId": uid,
            "sub": jwt_payload.get("sub"),
            "groupId": None,
        })

    # Anonymous
    return ok({
        "id": None,
        "type": "anonymous",
        "userId": None,
        "sub": None,
        "groupId": None,
    })


@register_response_handler("group_users")
async def handle_group_users(ctx: RouteContext):
    group_id = ctx.path_params["group_id"]

    pres = ctx.services.campaign.get(
        "/polices/groups",
        params={"groupId": group_id}
    )
    if not pres.ok:
        return not_found({"error": "Not found"})

    group_users = []
    for entry in pres.json().get("users", []):
        user_resp = ctx.services.users.get(f"/users/{entry['userId']}")
        if user_resp.ok:
            group_users.append({
                "user": user_resp.json(),
                "isAdmin": entry.get("isAdmin"),
            })

    return ok({"users": group_users})


@register_response_handler("character_users")
async def handle_character_users(ctx: RouteContext):
    group_id = ctx.path_params["group_id"]
    character_id = ctx.path_params["character_id"]

    pres = ctx.services.campaign.get(
        "/polices/groups/characters",
        params={
            "groupId": group_id,
            "characterId": character_id,
        }
    )
    if not pres.ok:
        return not_found({"error": "Not found"})

    character_users = []
    for entry in pres.json().get("users", []):
        user_resp = ctx.services.users.get(f"/users/{entry['userId']}")
        if user_resp.ok:
            character_users.append({
                "user": user_resp.json(),
                "canWrite": entry.get("canWrite"),
            })

    return ok({"users": character_users})


@register_response_handler("group_export")
async def handle_group_export(ctx: RouteContext):
    group_id = ctx.path_params["group_id"]
    include = ctx.request.query_params.get("include", "templates,characters,items,skills")
    uid = get_user_id(ctx.jwt)

    params = {"include": include}
    if uid:
        params["userId"] = str(uid)

    result = ctx.services.campaign.get(
        f"/groups/{group_id}/export",
        params=params,
    )

    resp = ok(result.json() if result.ok else {})
    try:
        return Response(content=result.content, status_code=result.status_code, media_type="application/json")
    except Exception:
        return Response(content=result.content, status_code=result.status_code)


@register_response_handler("group_import")
async def handle_group_import(ctx: RouteContext):
    group_id = ctx.path_params["group_id"]
    include = ctx.request.query_params.get("include", "templates,characters,items,skills")
    uid = get_user_id(ctx.jwt)

    params = {"include": include}
    if uid:
        params["userId"] = str(uid)

    try:
        body_data = await ctx.request.json()
    except Exception:
        body_data = {}

    result = ctx.services.campaign.post(
        f"/groups/{group_id}/import",
        json=body_data,
        params=params,
    )

    return Response(content=result.content, status_code=result.status_code, media_type="application/json")


@register_response_handler("user_create")
async def handle_user_create(ctx: RouteContext):
    uid = get_user_id(ctx.jwt)
    if uid is None:
        return forbidden()

    try:
        data = await ctx.request.json()
    except Exception:
        data = {}
    data["id"] = int(uid)

    result = ctx.services.users.post("/users", json=data)

    return Response(content=result.content, status_code=result.status_code, media_type="application/json")


@register_response_handler("quest_create_for_character")
async def handle_quest_create_for_character(ctx: RouteContext):
    group_id = ctx.path_params.get("group_id")
    character_id = ctx.path_params.get("character_id")

    if group_id is None or character_id is None:
        return forbidden()

    try:
        data = await ctx.request.json()
    except Exception:
        data = {}
    data["assignedCharacters"] = [int(character_id)]

    result = ctx.services.campaign.post(
        f"/groups/{group_id}/quests",
        json=data,
        params={"userId": get_user_id(ctx.jwt)},
    )

    return Response(content=result.content, status_code=result.status_code, media_type="application/json")
