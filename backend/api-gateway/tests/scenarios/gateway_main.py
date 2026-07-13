from tests.templates import Test, Scenario, GatewayStep
from tests.test_variables import *
from .jwt_helper import generate_token

h = {"Content-Type": "application/json; charset=utf-8"}

new_template = {
    "name": "TestTemplate",
    "description": "TestDescriptionOfTemplate",
    "fields": {"strong": {"name": "Strong", "description": "Strong", "value": 10}}
}

edited_template = {
    "name": "TestTemplate",
    "description": "TestDescriptionOfTemplate",
    "fields": {
        "strong": {"name": "Strong", "description": "Strong", "value": 10},
        "intellect": {"name": "Int", "description": "", "value": 11}
    }
}

new_note = {"header": "Test", "body": "Test Test"}
new_character_item = {"name": "TestItem", "description": "Test", "amount": 5}
new_group_item = {"name": "TestItem", "description": "Test", "price": 10}

scenarios: list[Scenario] = []


def register_gateway_main():
    admin_id = 2001
    user_id = 2002
    evil_id = 2003

    admin_token = generate_token(admin_id)
    user_token = generate_token(user_id)
    evil_token = generate_token(evil_id)

    data = {
        "at": admin_token,
        "aid": admin_id,
        "ut": user_token,
        "uid": user_id,
        "et": evil_token,
        "eid": evil_id,
    }

    tests = []

    # Create admin user
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="users", method="POST",
        data={"firstName": "Admin", "lastName": "Tester", "nickname": "gate_admin"}, requirement=CREATED))

    # Create user
    tests.append(Test(headers={**h, "Authorization": "{ut}"},
        request="users", method="POST",
        data={"firstName": "User", "lastName": "Tester", "nickname": "gate_user"}, requirement=CREATED))

    # Create evil user
    tests.append(Test(headers={**h, "Authorization": "{et}"},
        request="users", method="POST",
        data={"firstName": "Evil", "lastName": "Tester", "nickname": "gate_evil"}, requirement=CREATED))

    # Group creation
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups", method="POST",
        data={"name": "TestGroup", "description": "TestDescription"}, requirement=CREATED))

    # Check group access
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/1", method="GET", requirement=OK))

    tests.append(Test(headers={**h, "Authorization": "{ut}"},
        request="groups/1", method="GET", requirement=NOT_FOUND))

    # evil tries to add self to group (not admin) → 403
    tests.append(Test(headers={**h, "Authorization": "{et}"},
        request="groups/1/users/{eid}", method="PUT",
        data={"isAdmin": False}, requirement=FORBID))

    # admin adds user to group
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/1/users/{uid}", method="PUT",
        data={"isAdmin": False}, requirement=CREATED))

    # Check group access after user added
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/1", method="GET", requirement=OK))

    tests.append(Test(headers={**h, "Authorization": "{ut}"},
        request="groups/1", method="GET", requirement=OK))

    tests.append(Test(headers={**h, "Authorization": "{et}"},
        request="groups/1", method="GET", requirement=NOT_FOUND))

    # admin adds evil to group
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/1/users/{eid}", method="PUT",
        data={"isAdmin": False}, requirement=CREATED))

    # evil tries to make self admin → 403
    tests.append(Test(headers={**h, "Authorization": "{et}"},
        request="groups/1/users/{eid}", method="PUT",
        data={"isAdmin": True}, requirement=FORBID))

    # evil can now see the group
    tests.append(Test(headers={**h, "Authorization": "{et}"},
        request="groups/1", method="GET", requirement=OK))

    # evil tries to create template (not admin) → 403
    tests.append(Test(headers={**h, "Authorization": "{et}"},
        request="groups/1/characters/templates", method="POST",
        data=new_template, requirement=FORBID))

    # admin creates template
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/1/characters/templates", method="POST",
        data=new_template, requirement=CREATED))

    # admin edits template
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/1/characters/templates/{steps.15.id}", method="PUT",
        data=edited_template, requirement=OK))

    # Create 4 characters
    for i in range(1, 5):
        tests.append(Test(headers={**h, "Authorization": "{at}"},
            request="groups/1/characters", method="POST",
            data={"name": f"Test Character {i}", "description": "", "templateId": "{steps.15.id}"},
            requirement=CREATED))

    # admin gives user write access to char_2 (step 18)
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/1/characters/{steps.18.id}/users/{uid}", method="PUT",
        data={"canWrite": True}, requirement=CREATED))

    # admin gives evil read-only access to char_3 (step 19)
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/1/characters/{steps.19.id}/users/{eid}", method="PUT",
        data={"canWrite": False}, requirement=CREATED))

    # admin adds note to char_1 → 201
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/1/characters/{steps.17.id}/notes", method="POST",
        data=new_note, requirement=CREATED))

    # user adds note to char_2 (can_write=True) → 201
    tests.append(Test(headers={**h, "Authorization": "{ut}"},
        request="groups/1/characters/{steps.18.id}/notes", method="POST",
        data=new_note, requirement=CREATED))

    # evil adds note to char_3 (read-only) → 403
    tests.append(Test(headers={**h, "Authorization": "{et}"},
        request="groups/1/characters/{steps.19.id}/notes", method="POST",
        data=new_note, requirement=FORBID))

    # admin adds item to char_1 → 201
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/1/characters/{steps.17.id}/items", method="POST",
        data=new_character_item, requirement=CREATED))

    # user adds item to char_2 (can_write=True) → 201
    tests.append(Test(headers={**h, "Authorization": "{ut}"},
        request="groups/1/characters/{steps.18.id}/items", method="POST",
        data=new_character_item, requirement=CREATED))

    # evil adds item to char_3 (read-only) → 403
    tests.append(Test(headers={**h, "Authorization": "{et}"},
        request="groups/1/characters/{steps.19.id}/items", method="POST",
        data=new_character_item, requirement=FORBID))

    # admin creates group item → 201
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/1/items", method="POST",
        data=new_group_item, requirement=CREATED))

    # evil creates group item (not admin) → 403
    tests.append(Test(headers={**h, "Authorization": "{et}"},
        request="groups/1/items", method="POST",
        data=new_group_item, requirement=FORBID))

    # PATCH /groups/{id} (admin) → 200
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/1", method="PATCH",
        data={"name": "UpdatedGroup"}, requirement=OK))

    # PATCH /groups/{id} (evil, not admin) → 403
    tests.append(Test(headers={**h, "Authorization": "{et}"},
        request="groups/1", method="PATCH",
        data={"name": "HackedName"}, requirement=FORBID))

    # GET /groups/{id}/users (admin) → 200
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/1/users", method="GET", requirement=OK))

    # DELETE /groups/{id}/users/{uid} (evil tries to delete user, not admin) → 403
    tests.append(Test(headers={**h, "Authorization": "{et}"},
        request="groups/1/users/{uid}", method="DELETE", requirement=FORBID))

    # DELETE /groups/{id}/users/{eid} (admin deletes evil) → 200
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/1/users/{eid}", method="DELETE", requirement=OK))

    # Verify evil can no longer see the group → 404
    tests.append(Test(headers={**h, "Authorization": "{et}"},
        request="groups/1", method="GET", requirement=NOT_FOUND))

    steps = [GatewayStep(t) for t in tests]
    scenario = Scenario("GatewayMain", steps, data)
    scenarios.append(scenario)


def create_gateway_main_scenario():
    return scenarios
