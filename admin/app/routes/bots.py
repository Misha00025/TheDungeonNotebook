from flask import Blueprint, render_template, request
from app.middleware import login_required
from app import services

bots_bp = Blueprint("bots", __name__)


@bots_bp.route("/bots", methods=["GET", "POST"])
@login_required
def bots():
    try:
        groups = services.get_all_groups()
    except Exception:
        groups = []

    token = None
    error = None
    selected_group_id = None
    years = 1

    if request.method == "POST":
        selected_group_id = request.form.get("group_id", type=int)
        years = request.form.get("years", 1, type=int)

        if years < 1:
            years = 1

        if not selected_group_id:
            error = "Select a group"
        else:
            try:
                token = services.generate_service_token(selected_group_id, years)
            except Exception as e:
                error = str(e)

    return render_template("bots.html",
                         groups=groups,
                         token=token,
                         error=error,
                         selected_group_id=selected_group_id,
                         years=years)
