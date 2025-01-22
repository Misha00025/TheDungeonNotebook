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
            return False
    # wrapper.__name__ = func.__name__
    return wrapper


def _valid_data(body: dict, t):
    keys = []
    match(t):
        case "user":
            keys = ["id", "first_name", "last_name", "photo_link"]
        case "character":
            keys = ["id", "group_id", "name", "description"]
        case "group":
            keys = ["id", "name", "photo_link"]
        case "owner":
            keys = ["id", ""]
    for key in keys:
        if tv.debug:
            print(f"DEBUG: Check {key} in {body.keys()}")
        if key not in body.keys():
            return False
    return True

@trying
def check_user_data(t: Test, r: Response):
    if tv.debug:
        print(f"DEBUG: Type of result: {type(r)} - {r}")
    body:dict = r.json()
    return _valid_data(body, "user")

@trying
def check_character_data(t: Test, r: Response):
    body:dict = r.json()
    return _valid_data(body, "character")

@trying 
def check_many_characters(t: Test, r: Response):
    body:dict = r.json()
    characters = body["characters"]
    for c in characters:
        if not _valid_data(c, "character"):
            return False
    return "characters" in body.keys()

@trying
def check_group_data(t: Test, r: Response):
    body:dict = r.json()
    access_level = t.check_access
    if access_level:
        if "group" not in body.keys() or "access_level" not in body.keys():
            return False
        body = body["group"]        
    return _valid_data(body, "group")

@trying
def check_many_groups(t: Test, r: Response):
    body:dict = r.json()
    characters = body["groups"]
    for c in characters:
        access_level = t.check_access
        if access_level:
            if "group" not in c.keys() or "access_level" not in c.keys():
                return False
            c = c["group"]
        if not _valid_data(c, "group"):
            return False
    return "groups" in body.keys()