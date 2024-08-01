from app.api_controller import route, version


version("v1", clear=True)


@route("ping", methods=["GET"])
def _ping():
    return "OK", 200


from .vk_used import *
from . import notes
