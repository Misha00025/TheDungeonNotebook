import json
from app.engine.context import RouteContext
from app.engine.registry import register_access_handler


def inject_subject_to_state(ctx: RouteContext) -> None:
    if ctx.jwt is None:
        return

    uid = ctx.jwt.get("userId") or ctx.jwt.get("sub")
    gid = ctx.jwt.get("groupId")

    if uid is not None:
        ctx.state["x_subject"] = json.dumps({"type": "user", "id": int(uid)})
    elif gid is not None:
        ctx.state["x_subject"] = json.dumps({"type": "group", "id": int(gid)})


@register_access_handler("inject_x_subject")
def inject_x_subject(ctx: RouteContext):
    inject_subject_to_state(ctx)
    return ctx.allow()
