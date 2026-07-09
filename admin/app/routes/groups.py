from flask import Blueprint, render_template, redirect, url_for
from app.middleware import login_required
from app import services

groups_bp = Blueprint("groups", __name__)


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

    user_ids = [m["userId"] for m in members]
    try:
        users_data = services.get_users_by_ids(user_ids)
        user_map = {u["id"]: u for u in users_data}
    except Exception:
        user_map = {}

    for m in members:
        m["user"] = user_map.get(m["userId"])

    return render_template("group_detail.html", group=group, members=members)


@groups_bp.route("/groups/<int:group_id>/delete", methods=["POST"])
@login_required
def delete_group(group_id):
    try:
        services.delete_group(group_id)
    except Exception:
        pass
    return redirect(url_for("groups.list_groups"))


@groups_bp.route("/groups/<int:group_id>/remove-user/<int:user_id>", methods=["POST"])
@login_required
def remove_user(group_id, user_id):
    try:
        services.remove_user_from_group(user_id, group_id)
    except Exception:
        pass
    return redirect(url_for("groups.group_detail", group_id=group_id))
