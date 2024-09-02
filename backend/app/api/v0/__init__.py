from app.api_controller import get_routers_info, route
from app.status import ok


@route("get_api", ["GET"])
def _get_api():
    return ok({"api_methods": get_routers_info()})