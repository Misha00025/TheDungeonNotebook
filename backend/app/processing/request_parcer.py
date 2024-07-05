from variables import _st, _at
from flask import Request


def get_service_token(request: Request):
    service_token = request.headers.get(_st, "")
    return service_token


def get_access_token(request: Request):
    token = request.headers.get(_at)
    return token


def get_user_id(request: Request):
    args = request.args
    user_id = args.get("user_id", None)
    if user_id is None:
        user_id = request.json.get("user_id")
    return user_id


def get_admin_status(request):
    is_admin = request.json.get("is_admin")
    return is_admin


