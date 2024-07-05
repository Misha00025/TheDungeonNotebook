from variables import _st, _at


def get_service_token(request):
    service_token = request.headers.get(_st, "")
    return service_token


def get_access_token(request):
    token = request.headers.get(_at)
    return token


def get_user_id(request):
    args = request.args
    user_id = args.get("user_id")
    return user_id


def get_admin_status(request):
    args = request.args
    is_admin = args.get("is_admin")
    return is_admin


