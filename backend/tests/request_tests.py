from variables import _st, _at
from . import variables
import requests as rq


ethernet = "https://the-dungeon-notebook.ru"
local = "http://127.0.0.1:5077"
version = "v2"
site = local+"/"  # + "/api/" + version + "/"
headers_template = {"Content-Type": "application/json; charset=utf-8"}


def test(f):
    def wrapper(*args, **kwargs):
        print(f"START: {f.__name__} with args: {args} and kwargs: {kwargs}\n")
        f(*args, **kwargs)
        print(f"\nEND: {f.__name__}\n\n")
    wrapper.__name__ = f.__name__
    return wrapper

def get_text(res, url, method, params={}, compact = variables.compact):
    try:
        response = res.json()
    except:
        response = res.text
    text = f"{method} REQUEST {res.status_code}: {url}, {params=} "
    if res.status_code < 400:
        if not variables.compact:
            text += f"\n   |- Response: {response}"
    elif res.status_code >= 500:
        text += "!!!VERY IMPORTANT ERROR!!!"
    else:
        text += f"  Error: {response}"
    return text


def get_test(headers, params, url, compact=variables.compact) -> rq.Response:
    full_url = site + url
    res = rq.get(url=full_url, headers=headers, params=params)
    return res


def post_test(headers, params, url, data, compact=variables.compact) -> rq.Response:
    full_url = site + url
    res = rq.post(url=full_url, headers=headers, params=params, json=data)
    return res


def put_test(headers, params, url, data, compact=variables.compact) -> rq.Response:
    full_url = site + url
    res = rq.put(url=full_url, headers=headers, params=params, json=data)
    return res


def delete_test(headers, params, url, compact=variables.compact) -> rq.Response:
    full_url = site + url
    res = rq.delete(url=full_url, headers=headers, params=params)
    return res
    