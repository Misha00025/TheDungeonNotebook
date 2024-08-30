from time import sleep
from typing import Mapping

import requests as rq
import json

from variables import _st, _at

ethernet = "https://the-dungeon-notebook.ru"
local = "http://127.0.0.1:5000"
version = "v1"
site = local + "/api/" + version + "/"
st = "1"
headers_template = {"Content-Type": "application/json; charset=utf-8"}
user_id = "tester"

urls_get = [
    "groups", "groups/-100", "groups/-101", "groups/-102",
    "notes", "notes/31", "notes/32", "notes/33",
    "users", f"users/{user_id}"
]


def user_get(headers, params, url, compact):
    full_url = site + url
    res = rq.get(url=full_url, headers=headers, params=params)
    try:
        response = res.json()
    except:
        response = res.text
    text = f"REQUEST {res.status_code}: {url} "
    if res.status_code < 400:
        if not compact:
            text += f"\n   |- Response: {response}"
    else:
        text += f"  Error: {response}"
    print(text)


def user_get_tests(user_token, groups = ["-100"], compact = False):
    print(f"START: test with USER token: {user_token}\n")
    headers = headers_template.copy()
    headers[_at] = user_token
    for url in urls_get:
        for group_id in groups:
            payload = {"group_id": group_id}
            user_get(headers, payload, url, compact)
    print(f"\nEND: test with USER token: {user_token}\n\n")
    



if __name__ == "__main__":
    compact = bool(1)
    user_get_tests("1", compact=compact)
    user_get_tests("2", compact=compact)
