from app.api_controller import route, version


_v = "v1"


version(_v, clear=True)


@route("ping", methods=["GET"])
def _ping():
    return "OK", 200


from .vk_used import *

version(_v, clear=True)

from . import notes
