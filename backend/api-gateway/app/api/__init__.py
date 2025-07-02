from app.api_controller import get_routers_info, route, version
from app.status import ok


version("")


@route("get_api", ["GET"])
def _get_api():
    return ok({"api_methods": get_routers_info()})


@route("auth/register", ["POST"])
def _register():
    raise NotImplementedError()


@route("auth/login", ["POST"])
def _login():
    raise NotImplementedError()


@route("auth/refresh", ["POST"])
def _refresh():
    raise NotImplementedError()


@route("users/<int:user_id>", ["GET", "PATCH", "POST"])
def _user(user_id: int):
    raise NotImplementedError()


@route("groups", ["GET", "POST"])
def _groups():
    raise NotImplementedError()


@route("groups/<int:group_id>", ["GET", "PATCH"])  # TODO: Вернуть DELETE метод, когда буду готов
def _group(group_id: int):
    raise NotImplementedError()


@route("groups/<int:group_id>/items", ["GET", "POST"])
def _items(group_id: int):
    raise NotImplementedError()


@route("groups/<int:group_id>/characters", ["GET", "POST"])
def _characters(group_id: int):
    raise NotImplementedError()


@route("groups/<int:group_id>/characters/templates", ["GET", "POST"])
def _templates(group_id: int):
    raise NotImplementedError()


@route("groups/<int:group_id>/items/<int:item_id>", ["GET", "PUT", "DELETE"])
def _item(group_id: int, item_id: int):
    raise NotImplementedError()


@route("groups/<int:group_id>/characters/<int:character_id>", ["GET", "PATCH", "DELETE"])
def _character(group_id: int, character_id: int):
    raise NotImplementedError()


@route("groups/<int:group_id>/characters/templates/<int:template_id>", ["GET", "PUT", "DELETE"])
def _template(group_id: int, template_id: int):
    raise NotImplementedError()


@route("groups/<int:group_id>/characters/<int:character_id>/items", ["GET", "POST"])
def _character_items(group_id: int, character_id: int):
    raise NotImplementedError()


@route("groups/<int:group_id>/characters/<int:character_id>/notes", ["GET", "POST"])
def _character_notes(group_id: int, character_id: int):
    raise NotImplementedError()


@route("groups/<int:group_id>/characters/<int:character_id>/items/<int:item_id>", ["GET", "PUT", "DELETE"])
def _character_items(group_id: int, character_id: int, item_id: int):
    raise NotImplementedError()


@route("groups/<int:group_id>/characters/<int:character_id>/notes/<int:note_id>", ["GET", "PUT", "DELETE"])
def _character_notes(group_id: int, character_id: int, note_id: int):
    raise NotImplementedError()