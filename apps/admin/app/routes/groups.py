from flask import Blueprint, render_template, request, redirect, url_for
from app.middleware import login_required
from app import services

groups_bp = Blueprint("groups", __name__)


@groups_bp.route("/groups/create", methods=["GET", "POST"])
@login_required
def create_group():
    if request.method == "GET":
        return render_template("group_create.html", error=None)

    name = request.form.get("name", "").strip()
    icon = request.form.get("icon", "").strip()

    if not name:
        return render_template("group_create.html", error="Group name is required")

    try:
        services.create_group(name, icon)
    except Exception as e:
        return render_template("group_create.html", error=str(e))

    return redirect(url_for("groups.list_groups"))


@groups_bp.route("/groups")
@login_required
def list_groups():
    try:
        groups = services.get_all_groups()
    except Exception:
        groups = []
    return render_template("groups.html", groups=groups)


@groups_bp.route("/groups/<int:group_id>")
@login_required
def group_detail(group_id):
    group = services.get_group(group_id)
    if group is None:
        return render_template("group_detail.html", group=None, members=None)

    try:
        policies = services.get_group_policies(group_id=group_id)
        members = policies.get("users", [])
    except Exception:
        members = []

    member_ids = {m["userId"] for m in members}

    try:
        users_data = services.get_users_by_ids(list(member_ids))
        user_map = {u["id"]: u for u in users_data}
    except Exception:
        user_map = {}

    for m in members:
        m["user"] = user_map.get(m["userId"])

    try:
        all_users = services.get_all_users()
        available_users = [u for u in all_users.get("users", []) if u["id"] not in member_ids]
    except Exception:
        available_users = []

    return render_template("group_detail.html", group=group, members=members, available_users=available_users)


@groups_bp.route("/groups/<int:group_id>/delete", methods=["POST"])
@login_required
def delete_group(group_id):
    try:
        services.delete_group(group_id)
    except Exception:
        pass
    return redirect(url_for("groups.list_groups"))


@groups_bp.route("/groups/<int:group_id>/add-user", methods=["POST"])
@login_required
def add_user(group_id):
    user_id = request.form.get("user_id", type=int)
    if not user_id:
        return redirect(url_for("groups.group_detail", group_id=group_id))
    try:
        services.set_group_admin(user_id, group_id, is_admin=False)
    except Exception:
        pass
    return redirect(url_for("groups.group_detail", group_id=group_id))


@groups_bp.route("/groups/<int:group_id>/remove-user/<int:user_id>", methods=["POST"])
@login_required
def remove_user(group_id, user_id):
    try:
        services.remove_user_from_group(user_id, group_id)
    except Exception:
        pass
    return redirect(url_for("groups.group_detail", group_id=group_id))
