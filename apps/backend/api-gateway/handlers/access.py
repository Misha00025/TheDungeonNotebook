from app.engine.context import RouteContext
from app.engine.registry import register_access_handler
from app.engine.status import forbidden


def get_user_id(jwt_payload: dict | None) -> str | None:
    if jwt_payload is None:
        return None
    return jwt_payload.get("userId") or jwt_payload.get("sub")


@register_access_handler("self_only")
def check_self_only(ctx: RouteContext):
    user_id = ctx.path_params.get("user_id")
    jwt_user_id = get_user_id(ctx.jwt)

    if user_id is None or jwt_user_id is None:
        return ctx.deny(forbidden())

    if int(user_id) != int(jwt_user_id):
        return ctx.deny(forbidden())

    return ctx.allow()
