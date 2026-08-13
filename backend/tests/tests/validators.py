from requests import Response
from .templates import Test


def _get_data(res: Response):
    try:
        return res.json(), None
    except Exception as e:
        return {}, f"JSON decode error: {e}. Body: {res.text[:200]}"


def has_id():
    def validator(test: Test, res: Response):
        data, err = _get_data(res)
        if err:
            return False, err
        if "id" not in data or not isinstance(data["id"], int):
            return False, f"Missing or invalid 'id' in {data}"
        return True, "OK"
    return validator


def has_fields(**expected):
    def validator(test: Test, res: Response):
        data, err = _get_data(res)
        if err:
            return False, err
        for k, v in expected.items():
            actual = data.get(k)
            if actual != v:
                return False, f"Expected {k}={v!r}, got {actual!r} in {data}"
        return True, "OK"
    return validator


def has_list(key: str):
    def validator(test: Test, res: Response):
        data, err = _get_data(res)
        if err:
            return False, err
        if key not in data or not isinstance(data[key], list):
            return False, f"Missing or invalid '{key}' list in {data}"
        return True, "OK"
    return validator


def has_keys(*keys):
    def validator(test: Test, res: Response):
        data, err = _get_data(res)
        if err:
            return False, err
        for k in keys:
            if k not in data:
                return False, f"Missing key '{k}' in {data}"
        return True, "OK"
    return validator


def has_item_in_list(key: str, item):
    def validator(test: Test, res: Response):
        data, err = _get_data(res)
        if err:
            return False, err
        lst = data.get(key, [])
        if item not in lst:
            return False, f"Expected '{item}' in '{key}', got {lst}"
        return True, "OK"
    return validator


def has_list_empty(key: str):
    def validator(test: Test, res: Response):
        data, err = _get_data(res)
        if err:
            return False, err
        lst = data.get(key, [])
        if lst != []:
            return False, f"Expected empty '{key}', got {lst}"
        return True, "OK"
    return validator


def has_list_eq(key: str, expected: list):
    def validator(test: Test, res: Response):
        data, err = _get_data(res)
        if err:
            return False, err
        actual = data.get(key, [])
        if actual != expected:
            return False, f"Expected '{key}'={expected}, got {actual}"
        return True, "OK"
    return validator


def is_error():
    def validator(test: Test, res: Response):
        text = res.text.strip()
        if not text:
            return True, "OK (empty body)"
        try:
            data = res.json()
        except Exception:
            return True, f"OK (text error: {text[:200]})"
        if "error" in data or "title" in data:
            return True, "OK"
        return False, f"Expected error response, got {data}"
    return validator


def is_success_with_keys(*keys):
    def validator(test: Test, res: Response):
        data, err = _get_data(res)
        if err:
            return False, err
        if "error" in data:
            return False, f"Unexpected error in response: {data}"
        for k in keys:
            if k not in data:
                return False, f"Missing key '{k}' in {data}"
        return True, "OK"
    return validator
