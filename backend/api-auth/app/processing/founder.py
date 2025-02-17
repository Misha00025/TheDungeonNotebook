from app import database as _db


def user_is_founded(user_id):
    err, res = _db.vk_user.find(user_id)
    return not bool(err)


def find_group_id_by(service_token):
    err, res = _db.group_bot_token.find(service_token)
    if err:
        return None
    return res[0]

