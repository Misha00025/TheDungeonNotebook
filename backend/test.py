from time import sleep
from typing import Mapping

import requests as rq
import json

from variables import _st, _at

ethernet = "https://the-dungeon-notebook.ru"
local = "http://127.0.0.1:5000"
site = local
st = "1"
ut = "4595880663507502266"
headers = {_st: st, "Content-Type": "application/json; charset=utf-8"}
user_id = "173745999"


def get_info():
    url = f"{site}/api/v1/get_user_info/{user_id}"
    res = rq.get(url=url, headers=headers)
    return res.json()


def upd_user():
    payload = {"user_id": user_id}
    res = rq.request(
        method="PUT",
        url=f"{site}/api/v1/update_user",
        params=payload,
        headers=headers
    )
    return res.content


def check_user():
    url = f"{site}/api/v1/user_is_mine"
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


def test_notes():
    # from app.model.Note import Note
    # note = Note(19)
    url = f"{site}/api/v1/notes/"
    payload = {"user_id": user_id}
    upayload = {"group_id": "218984657"}
    data = {"header": "heh", "body": "heheh"}
    head = headers.copy()
    head.pop(_st)
    head[_at] = "-1456012282360953399"
    # res = rq.get(url=url, headers=headers, params=payload)
    # print(res.text)
    # res = rq.get(url=url, headers=headers)
    # print(res.text)
    # res = rq.get(url=url, headers=head, params=upayload)
    # print(res.text)
    # res = rq.post(url=url+"add", headers=headers, params=payload, json=data).json()
    note_id = "20"
    res = rq.get(url=url+note_id, headers=head)
    # print(res.text)
    serv_data = res.json()
    data["header"] = serv_data["header"]
    data["body"] = serv_data["body"] + " ...Test"
    print(data)
    rq.put(url=url+note_id, headers=head, params=upayload, json=data)
    res = rq.get(url=url+note_id, headers=head, params=upayload)
    print(res.json()["body"])
    # sleep(10)
    # rq.delete(url=url+note_id, headers=headers, params=payload)
    # res = rq.get(url=url+note_id, headers=headers, params=payload)
    return ""


if __name__ == "__main__":
    # print(db_test())
    # print(get_info())
    # print(upd_user())
    # print(check_user())
    # print(test_notes())
    # from app.model.VkUser import VkUser
    # user = VkUser(user_id)
    # # print(user.to_dict())
    # from app.model.Note import Note
    # note = Note(26)
    # is_mine = str(note.owner_id) == str(user.user_id)
    # is_admin = str(note.group_id) in user.admin_in
    # print(f"{note.group_id}:{user.admin_in}")
    # print(is_mine)
    # print(is_admin)
    # access = is_mine or is_admin
    # print(access)
    res = rq.get(url=f"{site}/api/get_api")
    if res.ok:
        apis = res.json()["api_methods"]
        for v in apis:
            for api in apis[v]:
                print(f"{v}:{api}")
    pass
