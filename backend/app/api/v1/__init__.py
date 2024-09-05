from app.api_controller import route, version


_v = "v1"


version(_v, clear=True)


@route("ping", methods=["GET"])
def _ping():
    from app.status import ok
    return ok()

from . import notes, groups, users, items
