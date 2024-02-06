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
        return jsonify({"error": "not valid token"})
    wrapped.__name__ = func.__name__
    return wrapped


@route("auth", ["POST"])
def _authorise():
    # print(f"{request};\n{request.headers}\n{request.data}")
    content = request.json
    err, payload = get_payload(content)
    if not err:
        err, result = get_access_token(*get_authorise_data(payload))
        if not err:
            access_token = result
            user_token = access_to_user_token(access_token)
            save_client(payload, user_token)
            return jsonify({"access_token": user_token})
        return jsonify({"error": result})
    return jsonify({"error": "payload not found"})


@route("groups", ["GET"])
@authorised
def _get_groups():
    return jsonify({
        "groups": [
            {
                "id": 1,
                "name": "Group 1"
            },
            {
                "id": 2,
                "name": "Group 2"
            }
        ]
    })


@route("groups/<group_id>/notes", ["GET"])
@authorised
def _get_notes(group_id: int):
    author = {
        "photo": "https://sun1-55.userapi.com/s/v1/ig2/1zpZxO4Vb8Id0Afo4WdJrwjK7-i1mOnZE_stz27PDVXYQf7nuZ1_SnqlXipi8_cbL2Tub38AwybZoa7XNcCTXAc5.jpg?size=100x100&quality=95&crop=20,113,211,211&ava=1",
        "first_name": "Миша",
        "last_name": "Николаев"
    }
    results = {
        1: {
            "notes": [
                {"id": 1, "header": "Header 1", "body": "body1", "author": author},
                {"id": 2, "header": "Header 2", "body": "body2", "author": author}
            ]
        },
        2: {
            "notes": [
                {"id": 1, "header": "Note 1", "body": "body", "author": author},
                {"id": 2, "header": "Note 2", "body": "body body", "author": author}
            ]
        }
    }
    return jsonify(results[int(group_id)])


@route("groups/<group_id>/notes/<note_id>", ["GET"])
def _get_note(group_id: int, note_id: int):
    pass

