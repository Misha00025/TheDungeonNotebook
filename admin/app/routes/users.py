from flask import Blueprint, render_template, request, redirect, url_for, current_app
from app.middleware import login_required
from app import services

users_bp = Blueprint("users", __name__)


@users_bp.route("/users/create", methods=["GET", "POST"])
@login_required
def create_user():
    if request.method == "GET":
        return render_template("user_create.html", error=None)

    username = request.form.get("username", "").strip()
    password = request.form.get("password", "")
    nickname = request.form.get("nickname", "").strip()

    if not username or not password or not nickname:
        return render_template("user_create.html", error="All fields are required")

    try:
        services.register_user(username, password, nickname)
    except Exception as e:
        return render_template("user_create.html", error=str(e))

    return redirect(url_for("users.list_users"))


@users_bp.route("/users")
@login_required
def list_users():
    search = request.args.get("search", "")

    try:
        if search:
            data = services.get_all_users()
            all_users = data.get("users", [])
            users = [u for u in all_users if search.lower() in u.get("nickname", "").lower()]
        else:
            data = services.get_all_users()
            users = data.get("users", [])
    except Exception:
        users = []

    return render_template("users.html", users=users, search=search)


@users_bp.route("/users/<int:user_id>")
@login_required
def user_detail(user_id):
    user = services.get_user(user_id)
    if user is None:
        return render_template("user_detail.html", user=None, groups=None)

    try:
        policies = services.get_group_policies(user_id=user_id)
        user_groups = policies.get("users", [])
    except Exception:
        user_groups = []

    return render_template("user_detail.html", user=user, groups=user_groups)


@users_bp.route("/users/<int:user_id>/delete", methods=["POST"])
@login_required
def delete_user(user_id):
    try:
        services.delete_user(user_id)
    except Exception:
        pass
    return redirect(url_for("users.list_users"))


@users_bp.route("/users/<int:user_id>/remove-from-group/<int:group_id>", methods=["POST"])
@login_required
def remove_from_group(user_id, group_id):
    try:
        services.remove_user_from_group(user_id, group_id)
    except Exception:
        pass
    return redirect(url_for("users.user_detail", user_id=user_id))


@users_bp.route("/users/<int:user_id>/toggle-admin/<int:group_id>", methods=["POST"])
@login_required
def toggle_group_admin(user_id, group_id):
    try:
        current_admin_status = request.form.get("is_admin", "false") == "true"
        services.set_group_admin(user_id, group_id, not current_admin_status)
    except Exception:
        pass
    return redirect(url_for("users.user_detail", user_id=user_id))


@users_bp.route("/users/<int:user_id>/reset-password", methods=["POST"])
@login_required
def reset_password(user_id):
    try:
        result = services.request_password_reset(user_id)
        link = f"{current_app.config['PASSWORD_RESET_LINK_TEMPLATE']}{result['query']}"
        return render_template("reset_link_modal.html", reset_link=link, user_id=user_id)
    except Exception as e:
        return render_template("user_detail.html", user=None, error=f"Failed to generate reset link: {e}")
