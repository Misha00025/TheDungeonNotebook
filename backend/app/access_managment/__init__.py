from app.api.v0.methods import (update_authorise_date)
from app.processing.request_parcer import get_service_token, get_access_token


def is_correct_token(request):
    from app.api.v0.methods import is_correct_token as ict
    token = get_access_token(request)
    result = token is not None and ict(token)
    if result:
        update_authorise_date(token)
    return result


def is_correct_service_token(request):
    st = get_service_token(request)
    if st is None:
        return False
    from app.processing.founder import find_group_id_by
    group_id = find_group_id_by(st)
    return group_id is not None


def authorised_group(func):
    from flask import request
    def wrapped(*args, **kwargs):
        if is_correct_service_token(request):
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


def authorised(func):
    def wrapped(*args, **kwargs):
        from flask import request
        if is_correct_token(request) or is_correct_service_token(request):
            return func(*args, **kwargs)
        return "not valid token", 401
    wrapped.__name__ = func.__name__
    return wrapped
