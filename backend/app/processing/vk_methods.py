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
    return 1, "vk not found"


def save_client(user_id):
    from app.api.v0 import database
    user = database.VkUser()
    err, account_info = get_vk_account_info(user_id)
    if err:
        return err
    user.vk_id = account_info["id"]
    user.first_name = account_info["first_name"]
    user.last_name = account_info["last_name"]
    user.photo = account_info["photo_100"]
    database.save_user(user)
    return 0
