from app.api.v0.methods import (update_authorise_date)
from variables import _st, _at


def is_correct_token(request):
    from app.api.v0.methods import is_correct_token as ict
    token = request.headers.get(_at)
    result = ict(token)
    if result:
        update_authorise_date(token)
    return result


def is_correct_service_token(request):
    print(request.headers)
    if request.headers.get(_st, "") == "":
        return False
    return True


def authorised(func):
    from flask import request
    def wrapped(*args, **kwargs):
        if is_correct_token(request) or is_correct_service_token(request):
            return func(*args, **kwargs)
        return "not valid token", 401
    wrapped.__name__ = func.__name__
    return wrapped


def authorised_user(func):
    def wrapped(*args, **kwargs):
        from flask import request
        if is_correct_token(request):
            return func(*args, **kwargs)
        return "not valid token", 401
    wrapped.__name__ = func.__name__
    return wrapped
