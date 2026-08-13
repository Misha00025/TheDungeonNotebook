from tests.templates import Test, Scenario, GatewayStep
from tests.test_variables import *
from tests.validators import has_id, has_keys, has_fields, has_list, is_error
from .jwt_helper import generate_token, generate_service_token

h = {"Content-Type": "application/json; charset=utf-8"}

new_template = {
    "name": "STTemplate",
    "description": "Service token template",
    "fields": {"str": {"name": "Strength", "description": "", "value": 10}}
}

new_group_item = {"name": "STItem", "description": "ST Item", "price": 5}
new_note = {"header": "STNote", "body": "ST Note body"}

scenarios: list[Scenario] = []


def register_service_token_scenario():
    admin_token, admin_id = generate_token()
    service_token, service_group_id = generate_service_token(group_id=1)
    second_token, second_group_id = generate_service_token(group_id=2)

    data = {
        "at": admin_token,
        "aid": admin_id,
        "st": service_token,
        "sgid": service_group_id,
        "st2": second_token,
        "sgid2": second_group_id,
    }

    tests = []

    # Setup 0: Create admin user
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="users", method="POST",
        data={"firstName": "STAdmin", "lastName": "STAdmin", "nickname": "st_admin"}, requirement=CREATED,
        is_valid=has_id()))

    # Setup 1: Admin creates group 1 (matches service token groupId)
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups", method="POST",
        data={"name": "STGroup", "description": "ST Group"}, requirement=CREATED,
        is_valid=has_id()))

    # Setup 2: Make admin a group admin
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.1.id}/users/{aid}", method="PUT",
        data={"isAdmin": True}, requirement=OK))

    # Setup 3: Admin creates character template
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.1.id}/characters/templates", method="POST",
        data=new_template, requirement=CREATED,
        is_valid=has_id()))

    # Setup 4: Admin creates character
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.1.id}/characters", method="POST",
        data={"name": "ST Char Setup", "description": "", "templateId": "{steps.3.id}"},
        requirement=CREATED,
        is_valid=has_id()))

    # Setup 5: Admin creates second group (for negative tests)
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups", method="POST",
        data={"name": "STGroup2", "description": "ST Group 2"}, requirement=CREATED,
        is_valid=has_id()))

    # Setup 6: Make admin admin of second group
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.5.id}/users/{aid}", method="PUT",
        data={"isAdmin": True}, requirement=OK))

    # --- Positive tests with service token ---

    # Test 1: GET /whoami → type=group, groupId=N
    tests.append(Test(headers={**h, "Authorization": "{st}"},
        request="whoami", method="GET", requirement=OK,
        is_valid=has_fields(type="group", groupId=service_group_id)))

    # Test 2: GET /groups/{groupId}
    tests.append(Test(headers={**h, "Authorization": "{st}"},
        request="groups/{sgid}", method="GET", requirement=OK,
        is_valid=has_id()))

    # Test 3: PATCH /groups/{groupId} rename
    tests.append(Test(headers={**h, "Authorization": "{st}"},
        request="groups/{sgid}", method="PATCH",
        data={"name": "STGroupRenamed"}, requirement=OK,
        is_valid=has_fields(name="STGroupRenamed")))

    # Test 4: GET /groups/{groupId}/characters/templates (view existing templates)
    tests.append(Test(headers={**h, "Authorization": "{st}"},
        request="groups/{sgid}/characters/templates", method="GET", requirement=OK,
        is_valid=has_list("templates")))

    # Test 5: POST /groups/{groupId}/characters
    tests.append(Test(headers={**h, "Authorization": "{st}"},
        request="groups/{sgid}/characters", method="POST",
        data={"name": "ST Char", "description": "", "templateId": 1},
        requirement=CREATED,
        is_valid=has_id()))

    # Test 6: GET /groups/{groupId}/characters/{charId}
    tests.append(Test(headers={**h, "Authorization": "{st}"},
        request="groups/{sgid}/characters/{steps.11.id}", method="GET", requirement=OK,
        is_valid=has_id()))

    # Test 7: POST /groups/{groupId}/items
    tests.append(Test(headers={**h, "Authorization": "{st}"},
        request="groups/{sgid}/items", method="POST",
        data=new_group_item, requirement=CREATED,
        is_valid=has_id()))

    # Test 8: GET /groups/{groupId}/items
    tests.append(Test(headers={**h, "Authorization": "{st}"},
        request="groups/{sgid}/items", method="GET", requirement=OK,
        is_valid=has_list("items")))

    # Test 9: POST /groups/{groupId}/characters/{charId}/notes
    tests.append(Test(headers={**h, "Authorization": "{st}"},
        request="groups/{sgid}/characters/{steps.11.id}/notes", method="POST",
        data=new_note, requirement=CREATED,
        is_valid=has_id()))

    # Test 10: GET /groups/{groupId}/characters/{charId}/notes
    tests.append(Test(headers={**h, "Authorization": "{st}"},
        request="groups/{sgid}/characters/{steps.11.id}/notes", method="GET", requirement=OK,
        is_valid=has_list("notes")))

    # Test 11: DELETE /groups/{groupId}/items/{itemId}
    tests.append(Test(headers={**h, "Authorization": "{st}"},
        request="groups/{sgid}/items/{steps.13.id}", method="DELETE", requirement=OK))

    # Test 12: GET /groups/{groupId}/export
    tests.append(Test(headers={**h, "Authorization": "{st}"},
        request="groups/{sgid}/export", method="GET", requirement=OK))

    # --- Negative tests (service token on wrong group) ---

    # Test 13: GET /groups/{secondGroupId} → 404
    tests.append(Test(headers={**h, "Authorization": "{st}"},
        request="groups/{sgid2}", method="GET", requirement=NOT_FOUND,
        is_valid=is_error()))

    # Test 14: POST /groups/{secondGroupId}/items → 404
    tests.append(Test(headers={**h, "Authorization": "{st}"},
        request="groups/{sgid2}/items", method="POST",
        data=new_group_item, requirement=NOT_FOUND,
        is_valid=is_error()))

    # Test 15: GET /groups/{secondGroupId}/characters → 404
    tests.append(Test(headers={**h, "Authorization": "{st}"},
        request="groups/{sgid2}/characters", method="GET", requirement=NOT_FOUND,
        is_valid=is_error()))

    steps = [GatewayStep(t) for t in tests]
    scenario = Scenario("ServiceTokenAccess", steps, data)
    scenarios.append(scenario)


def create_service_token_scenario():
    return scenarios
