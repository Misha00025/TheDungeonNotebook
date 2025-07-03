import json
from flask import Request
from jwt import PyJWT as jwt
from app.services import auth



def extract_tokens(rq: Request) ->  tuple[str | None, str | None] :
    '''
    returns:
    access_token, refresh_token
    '''
    access_token = rq.headers.get('Authorization')
    refresh_token = rq.headers.get('Refresh-Token')
    return access_token, refresh_token

def check_token(token: str | None) -> bool:
    from app import services
    res = services.auth({}).check(token)
    return res.ok

def extract_ids(token: str) -> tuple[str | None, str | None]:
    payload = jwt.decode(token, verify=False)
            
    return payload.get("userId"), payload.get("groupId")

def get_user_accesses(user_id) -> list[dict]:
        from app import services
        pres = services.polices({}).groups().all(user_id=user_id)
        if not pres.ok:
             return None
        group_ids: list = pres.json()["users"]
        user_accesses: list[dict] = []
        for data in group_ids:
            user_accesses.append({"groupId": data["groupId"], "isAdmin": data["isAdmin"], "characters": data["characters"]})
        return user_accesses


def check_auth(rq: Request)  -> tuple[bool, int, int, object]:
    '''
        return: status, user_id, group_id, response
    '''
    from app.status import unauthorized
    _, at = extract_tokens(rq)
    if at is None:
        return False, None, None, unauthorized()
    res = auth(rq.headers).check(at)
    if not res.ok:
        return False, None, None, unauthorized()
    uid, gid = extract_ids(at)
    if uid is None and gid is None:
        return False, None, None, unauthorized()
    return True, uid, gid, None

def check_access_to_group(group_id, rq, characters: list[dict] = None) -> tuple[bool, bool, object]:
    '''
        return: status, is_admin, response
    '''
    from app.status import forbidden
    ok, uid, gid, response = check_auth(rq)
    if not ok: 
        return False, False, response
    is_admin = False
    if gid is not None:
        if int(gid) != group_id:
            return False, False, forbidden()
        is_admin = True
    elif uid is not None:
        accesses = get_user_accesses(uid)
        group_access = None
        for access in accesses:
            if access["groupId"] == group_id:
                group_access = access
                break
        if group_access is None:
            return False, False, forbidden()
        if characters is not None:
            characters.extend(group_access["characters"])
        is_admin = bool(group_access["isAdmin"])
    return True, is_admin, None

def check_access_to_character(group_id, character_id, rq) -> tuple[bool, bool, object]:
    '''
        return: status, is_admin, can_write, response
    '''
    from app.status import forbidden
    characters = []
    ok, is_admin, response = check_access_to_group(group_id, rq, characters)
    if not ok:
        return ok, False, False, response
    if is_admin:
        return True, True, True, None
    character_access = None
    for access in characters:
        if int(access["characterId"]) == character_id:
            character_access = access
            break
    if character_access is None:
        return False, False, False, forbidden()
    else:
        return True, False, bool(character_access["canWrite"]), None
    
     