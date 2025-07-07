from scripts.scenario_register import register
from scripts import outputs
import variables as v
import requests as rq

def make_headers():
    return  {"Content-Type": "application/json; charset=utf-8"}

@register("Main")
def main():
    user_1 = {"username": "adminTester", "password": "TestPass"}
    user_2 = {"username": "userTester", "password": "TestUserPass"}
    user_3 = {"username": "evilTester", "password": "iTryBrakeAll"}
    headers_1 = make_headers()
    headers_2 = make_headers()
    headers_3 = make_headers()
    
    # Registration
    user_id_1 = register_and_login(user_1, headers_1)
    user_id_2 = register_and_login(user_2, headers_2)
    res = login(user_3, headers_3)
    outputs.write_result(res)
    user_id_3 = register_and_login(user_3, headers_3)
    get_access_token(headers_1)
    get_access_token(headers_2)
    get_access_token(headers_3)
    # Group creating
    group_id = group_create(headers_1, {"name": "TestGroup", "description": "TestDescription"})
    check_group(headers_1, group_id)
    check_group(headers_2, group_id)
    check_group(headers_3, group_id)
    add_group_access(headers_3, group_id, user_id_3)
    add_group_access(headers_1, group_id, user_id_2)
    check_group(headers_1, group_id)
    check_group(headers_2, group_id)
    check_group(headers_3, group_id)
    add_group_access(headers_1, group_id, user_id_3)
    add_group_access(headers_3, group_id, user_id_3, is_admin=True)
    check_group(headers_3, group_id)

    # Template and Characters creating
    new_template = {"name": "TestTemplate", "description": "TestDescriptionOfTemplate", "fields": {"strong": {"name": "Strong", "description": "Strong", "value": 10}}}
    create_template(headers_3, group_id, new_template)
    template_id = create_template(headers_1, group_id, new_template)
    edited_template = new_template.copy()
    edited_template["fields"]["intellect"] = {"name": "Int", "description": "", "value": 11}
    put_template(headers_1, group_id, template_id, edited_template)
    new_character_1 = {"name": "Test Character 1", "description": "", "templateId": template_id}
    new_character_2 = {"name": "Test Character 2", "description": "", "templateId": template_id}
    new_character_3 = {"name": "Test Character 3", "description": "", "templateId": template_id}
    new_character_4 = {"name": "Test Character 4", "description": "", "templateId": template_id}
    character_id_1 = create_character(headers_1, group_id, new_character_1)
    character_id_2 = create_character(headers_1, group_id, new_character_2)
    character_id_3 = create_character(headers_1, group_id, new_character_3)
    character_id_4 = create_character(headers_1, group_id, new_character_4)
    add_character_access(headers_1, group_id, character_id_2, user_id_2, can_write=True)
    add_character_access(headers_1, group_id, character_id_3, user_id_3)
    


def get_access_token(headers):
    res = refresh(headers)
    outputs.write_result(res)
    headers["Authorization"] = res.json()["accessToken"]

def register_and_login(user, headers):
    res = register(user, headers)
    user_id = res.json()["id"]
    outputs.write_result(res)
    res = login(user, headers)
    outputs.write_result(res)
    headers["Refresh-Token"] = res.json()["token"]
    return user_id

def group_create(headers, data):
    res = rq.post(f"{v.server_url}/groups", json=data, headers=headers)
    outputs.write_result(res)
    return res.json()["id"]

def check_group(headers, group_id):
    res = rq.get(f"{v.server_url}/groups/{group_id}", headers=headers)
    outputs.write_result(res)

def add_group_access(headers, group_id, user_id, is_admin=False):
    res = rq.put(f"{v.server_url}/groups/{group_id}/users/{user_id}", json={"isAdmin": is_admin}, headers=headers)
    outputs.write_result(res)

def create_template(headers, group_id, data):
    res = rq.post(f"{v.server_url}/groups/{group_id}/characters/templates", json=data, headers=headers)
    outputs.write_result(res)
    if res.ok:
        template_id = res.json()["id"]
        return template_id
    
def put_template(headers, group_id, template_id, data):
    res = rq.put(f"{v.server_url}/groups/{group_id}/characters/templates/{template_id}", json=data, headers=headers)
    outputs.write_result(res)

def create_character(headers, group_id, data):
    res = rq.post(f"{v.server_url}/groups/{group_id}/characters", json=data, headers=headers)
    outputs.write_result(res)
    if res.ok:
        character_id = res.json()["id"]
        return character_id
    
def add_character_access(headers, group_id, character_id, user_id, can_write=False):
    res = rq.put(f"{v.server_url}/groups/{group_id}/characters/{character_id}/users/{user_id}", json={"canWrite": can_write}, headers=headers)
    outputs.write_result(res)


def register(user_data, headers) -> rq.Response:
    return rq.post(f"{v.server_url}/auth/register", json=user_data, headers=headers)

def login(user_data, headers) -> rq.Response:
    return rq.post(f"{v.server_url}/auth/login", json=user_data, headers=headers)

def refresh(headers) -> rq.Response:
    return rq.post(f"{v.server_url}/auth/refresh", headers=headers)


