from flask import jsonify


_status = "status"
_error = "error"


def _default_status(code):
    match code:
        case 200:
            return {_status: "OK"}
        case 201:
            return {_status: "Created"}
        case 202:
            return {_status: "Accepted"}
        case 401:
            return {_error: "Unauthorized"}
        case 403:
            return {_error: "Forbidden"}
        case 404:
            return {_error: "Not Found"}
        case 501:
            return {_error: "Not Implemented"}
        case _:
            return {_error: "Unknown response code"}


def _answer(code, response=None):
    if response is not None and code >= 400 and type(response) is not dict:
        response = {_error: response}
    if response is None:
        response = _default_status(code)
    return jsonify(response), code


def ok(response=None):
    return _answer(200, response)


def created(response=None):
    return _answer(201, response)


def accepted(response=None):
    return _answer(202, response)


def forbidden(response=None):
    return _answer(403, response)


def not_implemented(response=None):
    return _answer(501, response)


def not_found(response=None):
    return _answer(404, response)


def unauthorized(response=None):
    return _answer(401, response)

