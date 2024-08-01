from flask import jsonify


def ok():
    return jsonify({"status": "OK"}), 200


def forbidden():
    return jsonify({"error": "Forbidden"}), 403


def not_implemented():
    return jsonify({"error": "Not Implemented"}), 501


def not_found():
    return jsonify({"error": "Not Found"}), 404

