import secrets
from flask import Blueprint, render_template, request, redirect, url_for, make_response, current_app

from app.middleware import create_token

auth_bp = Blueprint("auth", __name__)


@auth_bp.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "GET":
        return render_template("login.html")

    username = request.form.get("username", "")
    password = request.form.get("password", "")

    expected_username = current_app.config["ADMIN_USERNAME"]
    expected_password = current_app.config["ADMIN_PASSWORD"]

    if not secrets.compare_digest(username, expected_username):
        return render_template("login.html", error="Invalid credentials"), 401

    if not secrets.compare_digest(password, expected_password):
        return render_template("login.html", error="Invalid credentials"), 401

    token = create_token(username, current_app.config["JWT_SECRET"])
    resp = make_response(redirect(url_for("dashboard.index")))
    resp.set_cookie("admin_token", token, httponly=True, max_age=86400)
    return resp


@auth_bp.route("/logout")
def logout():
    resp = make_response(redirect(url_for("auth.login")))
    resp.set_cookie("admin_token", "", expires=0)
    return resp
