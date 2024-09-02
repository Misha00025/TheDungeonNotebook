from app.api_controller import get_routers_info, route, version
from app.status import ok


version("")


@route("get_api", ["GET"])
def _get_api():
    return ok({"api_methods": get_routers_info()})