from variables import _st, _at
from flask import Request


def get_service_token(request: Request):
    service_token = request.headers.get(_st, None)
    return service_token


def get_access_token(request: Request):
    token = request.headers.get(_at, None)
    return str(token)


def from_bot(request: Request):
    st = get_service_token(request)
    return st is not None


def from_user(request: Request):
    at = get_access_token(request)
    return at is not None


def get_user_id(request: Request):
    if from_bot(request):
        args = request.args
        user_id = args.get("user_id", None)
        if user_id is None and request.method != "GET":
            user_id = request.json.get("user_id")
        if user_id is None:
            return None
        return str(user_id)
    if from_user(request):
        from app.database import vk_user_token
        at = get_access_token(request)
        err, res = vk_user_token.find(str(at))
        if err:
            return None
        return res[0]
    raise Exception("Bad request: user_id not founded")

def get_group_id(request: Request):
    if from_bot(request):
        from app.database import group_bot_token
        st = get_service_token(request)
        err, res = group_bot_token.find(str(st))
        if err:
            return None
        return res[0]
    if from_user(request):
        args = request.args
        group_id = args.get("group_id", None)
        if group_id is None and request.method != "GET":
            group_id = request.json.get("group_id")
        return str(group_id)



def get_admin_status(request: Request):
    is_admin = request.json.get("is_admin")
    return is_admin


