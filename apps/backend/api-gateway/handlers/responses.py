from app.engine.context import RouteContext
from app.engine.registry import register_response_handler
from app.engine.status import ok, forbidden
from starlette.responses import Response
from handlers.trusted import trusted_headers


def get_user_id(jwt_payload: dict | None) -> str | None:
    if jwt_payload is None:
        return None
    if jwt_payload.get("groupId") is not None:
        return None
    return jwt_payload.get("accountId") or jwt_payload.get("userId")


@register_response_handler("get_api")
async def handle_get_api(ctx: RouteContext):
    return ok({
        "message": "PyApiGate",
        "api_methods": []
    })


@register_response_handler("legacy_auth_unavailable")
async def handle_legacy_auth_unavailable(ctx: RouteContext):
    return Response(content='{"error":"external_identity_required"}', status_code=410, media_type="application/json")


@register_response_handler("whoami")
async def handle_whoami(ctx: RouteContext):
    jwt_payload = ctx.jwt or {}
    gid = jwt_payload.get("groupId")

    if gid is not None:
        return ok({
            "id": int(gid),
            "type": "group",
            "userId": None,
            "sub": jwt_payload.get("sub"),
            "accountId": None,
            "groupId": gid,
        })

    uid = get_user_id(jwt_payload)
    if uid is not None:
        return ok({
            "id": int(uid),
            "type": "user",
            "userId": uid,
            "accountId": jwt_payload.get("accountId"),
            "sub": jwt_payload.get("sub"),
            "groupId": None,
        })

    return ok({
        "id": None,
        "type": "anonymous",
        "userId": None,
        "sub": None,
        "groupId": None,
    })


@register_response_handler("user_create")
async def handle_user_create(ctx: RouteContext):
    uid = get_user_id(ctx.jwt)
    if uid is None:
        return forbidden()

    data = ctx.request.json or {}
    data["id"] = int(uid)

    result = ctx.services.users.post("/users", json=data, headers=trusted_headers(ctx))

    return Response(content=result.content, status_code=result.status_code, media_type="application/json")


@register_response_handler("campaign_response")
async def handle_campaign_response(ctx: RouteContext):
    ctx.response.passthrough()
