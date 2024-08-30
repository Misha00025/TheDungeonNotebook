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
    "groups", "groups/-100", "groups/-101",
    "notes", "notes/31", "notes/32",
    "users", f"users/{user_id}"
]


def user_get(headers, params, url):
    full_url = site + url
    res = rq.get(url=full_url, headers=headers, params=params)
    try:
        response = res.json()
    except:
        response = res.text
    text = f"REQUEST: {url}: Code: {res.status_code}"
    if res.status_code < 400:
        text += f"\n   |- Response: {response}"
    print(text)


def user_get_tests(user_token, groups = ["-100"]):
    print(f"START: test with USER token: {user_token}\n")
    headers = headers_template.copy()
    headers[_at] = user_token
    for url in urls_get:
        for group_id in groups:
            payload = {"group_id": group_id}
            user_get(headers, payload, url)
    print(f"\nEND: test with USER token: {user_token}\n\n")
    



if __name__ == "__main__":
    user_get_tests("1")
    user_get_tests("2")
