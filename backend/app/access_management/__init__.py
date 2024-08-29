from flask import Request
from app.api.v0.methods import (update_authorize_date)
from app.processing.request_parser import get_service_token, get_access_token


def is_correct_token(request: Request):
    from app.database import vk_user_token
    token = str(get_access_token(request))
    err, user = vk_user_token.find(token)
    result = not err
    if result:
        update_authorize_date(token)
    return result


def is_correct_service_token(request):
    st = get_service_token(request)
    if st is None:
        return False
    from app.processing.founder import find_group_id_by
    group_id = find_group_id_by(st)
    return group_id is not None


def authorized_group(func):
    from flask import request
    def wrapped(*args, **kwargs):
        if is_correct_service_token(request):
            return func(*args, **kwargs)
        return "not valid token", 401
    wrapped.__name__ = func.__name__
    return wrapped


def authorized_user(func):
    def wrapped(*args, **kwargs):
        from flask import request
        if is_correct_token(request):
            return func(*args, **kwargs)
        return "not valid token", 401
    wrapped.__name__ = func.__name__
    return wrapped


def authorized(func):
    def wrapped(*args, **kwargs):
        from flask import request
        if is_correct_token(request) or is_correct_service_token(request):
            return func(*args, **kwargs)
        return "not valid token", 401
    wrapped.__name__ = func.__name__
    return wrapped
