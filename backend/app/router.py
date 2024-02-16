import requests

from app import application
from flask.json import jsonify
from flask import request

from app.methods import *
from app import database


prefix = "/api/"


def route(url, methods):
    return application.route(prefix + url, methods=methods)


def authorised(func):
    def wrapped(*args, **kwargs):
        token = request.headers.get("token")
        if is_correct_token(token):
            update_authorise_date(token)
            return func(*args, **kwargs)
        return "not valid token", 401
    wrapped.__name__ = func.__name__
    return wrapped


@route("auth", ["POST"])
def _authorise():
    content = request.json
    err, payload = get_payload(content)
    if not err:
        err, result = get_access_token(*get_authorise_data(payload))
        if not err:
            access_token = result
            user_token = access_to_user_token(access_token)
            save_client(payload, user_token)
            return jsonify({"access_token": user_token})
        return result, 406
    return "payload not found", 415


@route("groups", ["GET"])
@authorised
def _get_groups():
    token = request.headers.get("token")
    err, user_id = get_user_id(token)
    if err:
        return "user not found", 404
    err, groups = get_groups(user_id)
    if err:
        return "unsupported error", 418
    return jsonify({"groups": groups})


@route("groups/<group_id>/notes", ["GET"])
@authorised
def _get_notes(group_id: int):
    token = request.headers.get("token")
    err, user_id = get_user_id(token)
    if err:
        return "user not found", 404
    err, notes = get_notes(user_id, int(group_id))
    if err:
        return notes, 418
    return jsonify({"notes": notes})


@route("groups/<group_id>/notes/<note_id>", ["GET"])
def _get_note(group_id: int, note_id: int):
    pass

