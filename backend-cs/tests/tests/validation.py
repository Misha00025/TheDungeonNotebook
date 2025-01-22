from requests import Response
import tests.test_variables as tv
from .templates import Test


def trying(func):
    def wrapper(*args, **kwarg):
        try:
            return func(*args, **kwarg)
        except Exception as e:
            if tv.debug:
                print(f"Exception: {e}")
            return False, "Error"
    wrapper.__name__ = func.__name__
    return wrapper

def parsed(t, access_level = False, amount = False):
    def decor(func):
        @trying
        def wrapper(test: Test, r: Response):
            body:dict = get_data(r)
            keys = _get_req(t, access_level, amount)
            return func(body, keys), f"\n   |- Requirement fields: {keys}"
        wrapper.__name__ = func.__name__
        return wrapper
    return decor


def _get_req(t, access_level = False, amount = False):
    keys = []
    match(t):
        case "user":
            keys = ["id", "first_name", "last_name", "photo_link"]
        case "entity":
            keys = ["id", "name", "description"]
        case "group":
            keys = ["id", "name", "photo_link"]
        case "owner":
            keys = ["id", ""]
    if access_level:
        keys.append("access_level")
    if amount:
        keys.append("amount")
    return keys
    


def _valid_data(body: dict, keys):
    for key in keys:
        if tv.debug:
            print(f"DEBUG: Check {key} in {body.keys()}")
        if key not in body.keys():
            return False
    return True

def get_data(r: Response):
    return r.json()["data"]

# prepared validators

@parsed("user")
def check_user_data(body: dict, keys):
    return _valid_data(body, keys)

@parsed("user", access_level=True)
def check_many_users(body: dict, keys):
    body = body["users"]
    for user in body:
        if not _valid_data(user, keys):
            return False
    return True

@parsed("entity")
def check_character_data(body: dict, keys):
    return _valid_data(body, keys)

@parsed("entity", access_level=True)
def check_many_characters(body: dict, keys):
    characters = body["characters"]
    for c in characters:
        if not _valid_data(c, keys):
            return False
    return True

@parsed("group")
def check_group_data(body: dict, keys):
    return _valid_data(body, keys)

@parsed("group", access_level=True)
def check_many_groups(body: dict, keys):
    groups = body["groups"]
    for g in groups:
        if not _valid_data(g, keys):
            return False
    return True

@parsed("entity")
def check_many_items(body: dict, keys):
    items = body["items"]
    for i in items:
        if not _valid_data(i, keys):
            return False
    return True