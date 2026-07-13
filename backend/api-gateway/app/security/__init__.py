import json
from flask import Request
import jwt


def extract_ids(token: str) -> tuple[str | None, str | None]:
    payload = jwt.decode(token, options={"verify_signature": False})
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


def check_access_to_group_by_jwt(
    group_id: int,
    jwt_payload: dict | None,
    characters: list | None = None
) -> tuple[bool, bool, object]:
    """
    Проверяет доступ к группе на основе JWT payload.
    
    Args:
        group_id: ID группы.
        jwt_payload: Декодированный JWT payload (ctx.jwt).
        characters: Список для заполнения персонажами (опционально).
    
    Returns:
        (True, is_admin, None) если доступ есть,
        (False, False, response) если нет.
    """
    from app.status import unauthorized, forbidden
    
    uid = jwt_payload.get("userId") if jwt_payload else None
    gid = jwt_payload.get("groupId") if jwt_payload else None
    
    if uid is None and gid is None:
        return False, False, unauthorized()
    
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


def check_access_to_character_by_jwt(
    group_id: int,
    character_id: int,
    jwt_payload: dict | None
) -> tuple[bool, bool, bool, object]:
    """
    Проверяет доступ к персонажу на основе JWT payload.
    
    Returns:
        (True, is_admin, can_write, None) если доступ есть,
        (False, False, False, response) если нет.
    """
    from app.status import forbidden
    
    characters = []
    ok, is_admin, response = check_access_to_group_by_jwt(
        group_id, jwt_payload, characters
    )
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


     