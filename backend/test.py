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


def test(f):
    def wrapper(*args, **kwargs):
        print(f"START: {f.__name__} with args: {args} and kwargs: {kwargs}\n")
        f(*args, **kwargs)
        print(f"\nEND: {f.__name__}\n\n")
    wrapper.__name__ = f.__name__
    return wrapper


def get_test(headers, params, url, compact):
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
    elif res.status_code >= 500:
        text += "!!!VERY IMPORTANT ERROR!!!"
    else:
        text += f"  Error: {response}"
    print(text)


@test
def user_get_tests(user_token, groups = ["-100"], compact = False):
    headers = headers_template.copy()
    headers[_at] = user_token
    for url in urls_get:
        for group_id in groups:
            payload = {"group_id": group_id}
            get_test(headers, payload, url, compact)
    

@test
def group_get_tests(group_token, users = ["1"], compact = False):
    headers = headers_template.copy()
    headers[_st] = group_token
    for url in urls_get:
        for user in users:
            get_test(headers, {"user_id": user}, url, compact)


if __name__ == "__main__":
    compact = bool(1)
    user_get_tests("1", compact=compact)
    user_get_tests("2", compact=compact)
    group_get_tests("1", users=["test_user"], compact=compact)
    group_get_tests("1", users=["tester"], compact=compact)
    group_get_tests("1", users=["1"], compact=compact)
