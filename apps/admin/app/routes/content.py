from flask import Blueprint, render_template, request, redirect, url_for
from app.middleware import login_required
from app import services

content_bp = Blueprint("content", __name__)


@content_bp.route("/content")
@login_required
def content_list():
    group_id = request.args.get("group_id", type=int)

    try:
        groups = services.get_all_groups()
    except Exception:
        groups = []

    items = []
    skills = []
    notes = []
    characters = []

    if group_id:
        try:
            items = services.get_group_items(group_id)
        except Exception:
            items = []

        try:
            skills = services.get_group_skills(group_id)
        except Exception:
            skills = []

        try:
            notes = services.get_group_notes(group_id)
        except Exception:
            notes = []

        try:
            characters = services.get_group_characters(group_id)
        except Exception:
            characters = []

    return render_template("content.html",
                         groups=groups,
                         selected_group_id=group_id,
                         items=items,
                         skills=skills,
                         notes=notes,
                         characters=characters)


@content_bp.route("/content/item/<int:group_id>/<int:item_id>/delete", methods=["POST"])
@login_required
def delete_item(group_id, item_id):
    try:
        services.delete_group_item(group_id, item_id)
    except Exception:
        pass
    return redirect(url_for("content.content_list", group_id=group_id))


@content_bp.route("/content/skill/<int:group_id>/<int:skill_id>/delete", methods=["POST"])
@login_required
def delete_skill(group_id, skill_id):
    try:
        services.delete_group_skill(group_id, skill_id)
    except Exception:
        pass
    return redirect(url_for("content.content_list", group_id=group_id))


@content_bp.route("/content/note/<int:group_id>/<int:note_id>/delete", methods=["POST"])
@login_required
def delete_note(group_id, note_id):
    try:
        services.delete_group_note(group_id, note_id)
    except Exception:
        pass
    return redirect(url_for("content.content_list", group_id=group_id))


@content_bp.route("/content/character/<int:group_id>/<int:character_id>/delete", methods=["POST"])
@login_required
def delete_character(group_id, character_id):
    try:
        services.delete_character(group_id, character_id)
    except Exception:
        pass
    return redirect(url_for("content.content_list", group_id=group_id))
