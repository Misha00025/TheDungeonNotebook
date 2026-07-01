from . import test_variables
import requests as rq
import variables


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


def get_test(headers, params, url, compact=test_variables.compact) -> rq.Response:
    base = variables.server_url.rstrip("/")
    full_url = f"{base}/{url}"
    res = rq.get(url=full_url, headers=headers, params=params)
    return res


def post_test(headers, params, url, data, compact=test_variables.compact) -> rq.Response:
    base = variables.server_url.rstrip("/")
    full_url = f"{base}/{url}"
    res = rq.post(url=full_url, headers=headers, params=params, json=data)
    return res


def put_test(headers, params, url, data, compact=test_variables.compact) -> rq.Response:
    base = variables.server_url.rstrip("/")
    full_url = f"{base}/{url}"
    res = rq.put(url=full_url, headers=headers, params=params, json=data)
    return res

def patch_test(headers, params, url, data, compact=test_variables.compact) -> rq.Response:
    base = variables.server_url.rstrip("/")
    full_url = f"{base}/{url}"
    res = rq.patch(url=full_url, headers=headers, params=params, json=data)
    return res

def delete_test(headers, params, url, compact=test_variables.compact) -> rq.Response:
    base = variables.server_url.rstrip("/")
    full_url = f"{base}/{url}"
    res = rq.delete(url=full_url, headers=headers, params=params)
    return res
