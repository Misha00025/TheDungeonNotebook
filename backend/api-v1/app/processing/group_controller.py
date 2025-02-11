from app import database as _db


def find_user_by_group(group_id, user_id):
    result = None
    from app.processing.founder import user_is_founded
    if group_id is not None and user_is_founded(user_id):
        err, result = _db.user_group.find(user_id, group_id)
    return result


def add_user_to_group(group_id, user_id, is_admin):
    return _db.user_group.add(user_id, group_id, is_admin)
