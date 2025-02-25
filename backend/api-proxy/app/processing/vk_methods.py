import requests
import config


vk_api_version = "5.131"
service_token = config.token


def _get_response(res):
    # print(res.json())
    json: dict = res.json()
    if "response" in json.keys():
        return 0, json["response"]
    return 1, json["error"]


def get_user_info(user_id):
    from app.api.v0.database import find_user_from_id
    err, user = find_user_from_id(user_id)
    if err:
        return None
    return user.to_dict()


def get_vk_account_info(user_id):
    data = f"v={vk_api_version}&user_ids={user_id}&fields=photo_100&access_token={service_token}&lang=0"
    res = requests.post('https://api.vk.com/method/users.get', data=data)
    if res.ok:
        err, response = _get_response(res)
        if not err:
            return 0, response[0]
        return 1, response
    return 2, "vk not found"


def save_client(user_id):
    from app.database import vk_user
    err, ai = get_vk_account_info(user_id)
    if bool(err):
        ai = {"id": user_id, "first_name": f"Unknown-{user_id}", "last_name":f"", "photo_100":None}
    err, res = vk_user.add(user_id, ai["first_name"], ai["last_name"], ai["photo_100"])
    return err
