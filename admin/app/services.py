import requests
from flask import current_app


def get_all_users() -> dict:
    url = f"{current_app.config['USERS_SERVICE_URL']}/users"
    resp = requests.get(url, timeout=10)
    resp.raise_for_status()
    return resp.json()


def get_user(user_id: int) -> dict | None:
    url = f"{current_app.config['USERS_SERVICE_URL']}/users/{user_id}"
    resp = requests.get(url, timeout=10)
    if resp.status_code == 404:
        return None
    resp.raise_for_status()
    return resp.json()


def get_users_by_ids(ids: list[int]) -> list[dict]:
    ids_str = ",".join(str(i) for i in ids)
    url = f"{current_app.config['USERS_SERVICE_URL']}/users"
    resp = requests.get(url, params={"ids": ids_str}, timeout=10)
    resp.raise_for_status()
    return resp.json().get("users", [])


def delete_user(user_id: int) -> dict:
    url = f"{current_app.config['USERS_SERVICE_URL']}/users/{user_id}"
    resp = requests.delete(url, timeout=10)
    resp.raise_for_status()
    return resp.json()


def get_all_groups() -> list[dict]:
    url = f"{current_app.config['CAMPAIGN_SERVICE_URL']}/groups"
    resp = requests.get(url, timeout=10)
    resp.raise_for_status()
    return resp.json()


def get_group(group_id: int) -> dict | None:
    url = f"{current_app.config['CAMPAIGN_SERVICE_URL']}/groups/{group_id}"
    resp = requests.get(url, timeout=10)
    if resp.status_code == 404:
        return None
    resp.raise_for_status()
    return resp.json()


def delete_group(group_id: int) -> dict:
    url = f"{current_app.config['CAMPAIGN_SERVICE_URL']}/groups/{group_id}"
    resp = requests.delete(url, timeout=10)
    resp.raise_for_status()
    return resp.json()


def get_group_policies(group_id: int = None, user_id: int = None) -> dict:
    url = f"{current_app.config['CAMPAIGN_SERVICE_URL']}/polices/groups"
    params = {}
    if group_id is not None:
        params["groupId"] = group_id
    if user_id is not None:
        params["userId"] = user_id
    resp = requests.get(url, params=params, timeout=10)
    resp.raise_for_status()
    return resp.json()


def set_group_admin(user_id: int, group_id: int, is_admin: bool) -> dict:
    url = f"{current_app.config['CAMPAIGN_SERVICE_URL']}/polices/groups"
    resp = requests.put(url, json={
        "userId": user_id,
        "groupId": group_id,
        "isAdmin": is_admin,
    }, timeout=10)
    resp.raise_for_status()
    return resp.json()


def remove_user_from_group(user_id: int, group_id: int) -> dict:
    url = f"{current_app.config['CAMPAIGN_SERVICE_URL']}/polices/groups"
    resp = requests.delete(url, params={
        "userId": user_id,
        "groupId": group_id,
    }, timeout=10)
    resp.raise_for_status()
    return resp.json()


def get_group_items(group_id: int) -> list[dict]:
    url = f"{current_app.config['CAMPAIGN_SERVICE_URL']}/groups/{group_id}/items"
    resp = requests.get(url, timeout=10)
    resp.raise_for_status()
    return resp.json().get("items", [])


def get_group_skills(group_id: int) -> list[dict]:
    url = f"{current_app.config['CAMPAIGN_SERVICE_URL']}/groups/{group_id}/skills"
    resp = requests.get(url, timeout=10)
    resp.raise_for_status()
    data = resp.json()
    return data.get("skills", [])


def get_group_notes(group_id: int) -> list[dict]:
    url = f"{current_app.config['CAMPAIGN_SERVICE_URL']}/groups/{group_id}/notes"
    resp = requests.get(url, timeout=10)
    resp.raise_for_status()
    return resp.json()


def get_group_characters(group_id: int) -> list[dict]:
    url = f"{current_app.config['CAMPAIGN_SERVICE_URL']}/groups/{group_id}/characters"
    resp = requests.get(url, timeout=10)
    resp.raise_for_status()
    return resp.json()


def delete_group_item(group_id: int, item_id: int) -> dict:
    url = f"{current_app.config['CAMPAIGN_SERVICE_URL']}/groups/{group_id}/items/{item_id}"
    resp = requests.delete(url, timeout=10)
    resp.raise_for_status()
    return resp.json()


def delete_group_skill(group_id: int, skill_id: int) -> dict:
    url = f"{current_app.config['CAMPAIGN_SERVICE_URL']}/groups/{group_id}/skills/{skill_id}"
    resp = requests.delete(url, timeout=10)
    resp.raise_for_status()
    return resp.json()


def delete_group_note(group_id: int, note_id: int) -> dict:
    url = f"{current_app.config['CAMPAIGN_SERVICE_URL']}/groups/{group_id}/notes/{note_id}"
    resp = requests.delete(url, timeout=10)
    resp.raise_for_status()
    return resp.json()


def delete_character_note(group_id: int, character_id: int, note_id: int) -> dict:
    url = f"{current_app.config['CAMPAIGN_SERVICE_URL']}/groups/{group_id}/characters/{character_id}/notes/{note_id}"
    resp = requests.delete(url, timeout=10)
    resp.raise_for_status()
    return resp.json()


def delete_character(group_id: int, character_id: int) -> dict:
    url = f"{current_app.config['CAMPAIGN_SERVICE_URL']}/groups/{group_id}/characters/{character_id}"
    resp = requests.delete(url, timeout=10)
    resp.raise_for_status()
    return resp.json()
