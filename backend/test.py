from typing import Mapping

import requests as rq
import json

from variables import _st


st = "1"
headers = {_st: st, "Content-Type": "application/json"}
user_id = "173745999"


def get_info():
    url = f"http://127.0.0.1:5000/api/v1/get_user_info/{user_id}"
    res = rq.get(url=url, headers=headers)
    return res.json()


def upd_user():
    payload = {"user_id": user_id}
    res = rq.request(
        method="PUT",
        url="http://127.0.0.1:5000/api/v1/update_user",
        params=payload,
        headers=headers
    )
    return res.content


def check_user():
    url = f"http://127.0.0.1:5000/api/v1/user_is_mine"
    payload = {"user_id": user_id}
    res = rq.get(url=url, headers=headers, params=payload)
    return res.text


def db_test():
    from app import database
    user = database.vk_user.VkUser()
    account_info = get_info()
    user.vk_id = account_info["id"]
    user.first_name = account_info["first_name"]
    user.last_name = account_info["last_name"]
    user.photo = account_info["photo_100"]
    res = database.vk_user.find(user_id)
    print(res[1])
    database.vk_user.add(user.vk_id, None, None, None)
    database.vk_user.update(user.vk_id, user.first_name, user.last_name, user.photo)
    res = database.vk_user.find(user_id)
    print(res[1].to_dict())
    database.vk_user.remove(user_id)
    return "OK"




if __name__ == "__main__":
    # print(db_test())
    # print(get_info())
    # print(upd_user())
    print(check_user())
