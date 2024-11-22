from requests import Response
from .templates import Test


def trying(func):
    def wrapper(*args, **kwarg):
        try:
            return func(args, kwarg)
        except Exception:
            return False


def _valid_data(body: dict, t):
    match(t):
        case "character":
            return "id" in body.keys() and "group_id" in body.keys() and "name" in body.keys() and "description" in body.keys()
    return False


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