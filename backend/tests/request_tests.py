from . import test_variables
import requests as rq


ethernet = "https://the-dungeon-notebook.ru"
local = "http://127.0.0.1:5077"
internal = "http://127.0.0.1:5078"
version = "v2"
site = local + "/"
site_internal = internal + "/"


def test(f):
    def wrapper(*args, **kwargs):
        print(f"START: {f.__name__} with args: {args} and kwargs: {kwargs}\n")
        f(*args, **kwargs)
        print(f"\nEND: {f.__name__}\n\n")
    wrapper.__name__ = f.__name__
    return wrapper

def get_text(res, url, method, params={}, compact = test_variables.compact):
    try:
        response = res.json()
    except:
        response = res.text
    text = f"{method} REQUEST {res.status_code}: {url}, {params=} "
    if res.status_code < 400:
        if not test_variables.compact:
            text += f"\n   |- Response: {response}"
    elif res.status_code >= 500:
        text += "!!!VERY IMPORTANT ERROR!!!"
    else:
        text += f"  Error: {response}"
    return text


def _resolve_url(url: str, internal: bool = False) -> str:
    base = site_internal if internal else site
    return base + url


def get_test(headers, params, url, compact=test_variables.compact, internal=False) -> rq.Response:
    full_url = _resolve_url(url, internal)
    res = rq.get(url=full_url, headers=headers, params=params)
    return res


def post_test(headers, params, url, data, compact=test_variables.compact, internal=False) -> rq.Response:
    full_url = _resolve_url(url, internal)
    res = rq.post(url=full_url, headers=headers, params=params, json=data)
    return res


def put_test(headers, params, url, data, compact=test_variables.compact, internal=False) -> rq.Response:
    full_url = _resolve_url(url, internal)
    res = rq.put(url=full_url, headers=headers, params=params, json=data)
    return res

def patch_test(headers, params, url, data, compact=test_variables.compact, internal=False) -> rq.Response:
    full_url = _resolve_url(url, internal)
    res = rq.patch(url=full_url, headers=headers, params=params, json=data)
    return res

def delete_test(headers, params, url, compact=test_variables.compact, internal=False) -> rq.Response:
    full_url = _resolve_url(url, internal)
    res = rq.delete(url=full_url, headers=headers, params=params)
    return res
    