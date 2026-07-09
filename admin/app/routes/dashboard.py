from flask import Blueprint, render_template
from app.middleware import login_required
from app import services

dashboard_bp = Blueprint("dashboard", __name__)


@dashboard_bp.route("/")
@login_required
def index():
    try:
        users_data = services.get_all_users()
        total_users = len(users_data.get("users", []))
    except Exception:
        total_users = "N/A"

    try:
        groups = services.get_all_groups()
        total_groups = len(groups)
    except Exception:
        total_groups = "N/A"

    return render_template("dashboard.html",
                         total_users=total_users,
                         total_groups=total_groups)
