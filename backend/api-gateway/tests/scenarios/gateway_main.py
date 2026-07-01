from tests.templates import Test, Scenario, GatewayStep
from tests.test_variables import *

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
    tests = []

    # Registration & Login
    tests.append(Test(headers=h, request="auth/register", method="POST",
        data={"username": "adminTester", "password": "TestPass"}, requirement=CREATED))

    tests.append(Test(headers=h, request="auth/login", method="POST",
        data={"username": "adminTester", "password": "TestPass"}, requirement=OK))

    tests.append(Test(headers=h, request="auth/register", method="POST",
        data={"username": "userTester", "password": "TestUserPass"}, requirement=CREATED))

    tests.append(Test(headers=h, request="auth/login", method="POST",
        data={"username": "userTester", "password": "TestUserPass"}, requirement=OK))

    # user_3 login before registration → 401
    tests.append(Test(headers=h, request="auth/login", method="POST",
        data={"username": "evilTester", "password": "iTryBrakeAll"}, requirement=NOT_AUTH))

    tests.append(Test(headers=h, request="auth/register", method="POST",
        data={"username": "evilTester", "password": "iTryBrakeAll"}, requirement=CREATED))

    tests.append(Test(headers=h, request="auth/login", method="POST",
        data={"username": "evilTester", "password": "iTryBrakeAll"}, requirement=OK))

    # Refresh tokens
    tests.append(Test(headers={**h, "Refresh-Token": "{steps.1.token}"},
        request="auth/refresh", method="POST", requirement=OK))

    tests.append(Test(headers={**h, "Refresh-Token": "{steps.3.token}"},
        request="auth/refresh", method="POST", requirement=OK))

    tests.append(Test(headers={**h, "Refresh-Token": "{steps.6.token}"},
        request="auth/refresh", method="POST", requirement=OK))

    # Group creation
    tests.append(Test(headers={**h, "Authorization": "{steps.7.accessToken}"},
        request="groups", method="POST",
        data={"name": "TestGroup", "description": "TestDescription"}, requirement=CREATED))

    # Check group access
    tests.append(Test(headers={**h, "Authorization": "{steps.7.accessToken}"},
        request="groups/1", method="GET", requirement=OK))

    tests.append(Test(headers={**h, "Authorization": "{steps.8.accessToken}"},
        request="groups/1", method="GET", requirement=NOT_FOUND))

    # user_3 tries to add self to group (not admin) → 403
    tests.append(Test(headers={**h, "Authorization": "{steps.9.accessToken}"},
        request="groups/1/users/{steps.5.id}", method="PUT",
        data={"isAdmin": False}, requirement=FORBID))

    # user_1 adds user_2 to group
    tests.append(Test(headers={**h, "Authorization": "{steps.7.accessToken}"},
        request="groups/1/users/{steps.2.id}", method="PUT",
        data={"isAdmin": False}, requirement=CREATED))

    # Check group access after user_2 added
    tests.append(Test(headers={**h, "Authorization": "{steps.7.accessToken}"},
        request="groups/1", method="GET", requirement=OK))

    tests.append(Test(headers={**h, "Authorization": "{steps.8.accessToken}"},
        request="groups/1", method="GET", requirement=OK))

    tests.append(Test(headers={**h, "Authorization": "{steps.9.accessToken}"},
        request="groups/1", method="GET", requirement=NOT_FOUND))

    # user_1 adds user_3 to group
    tests.append(Test(headers={**h, "Authorization": "{steps.7.accessToken}"},
        request="groups/1/users/{steps.5.id}", method="PUT",
        data={"isAdmin": False}, requirement=CREATED))

    # user_3 tries to make self admin → 403
    tests.append(Test(headers={**h, "Authorization": "{steps.9.accessToken}"},
        request="groups/1/users/{steps.5.id}", method="PUT",
        data={"isAdmin": True}, requirement=FORBID))

    # user_3 can now see the group
    tests.append(Test(headers={**h, "Authorization": "{steps.9.accessToken}"},
        request="groups/1", method="GET", requirement=OK))

    # user_3 tries to create template (not admin) → 403
    tests.append(Test(headers={**h, "Authorization": "{steps.9.accessToken}"},
        request="groups/1/characters/templates", method="POST",
        data=new_template, requirement=FORBID))

    # user_1 creates template
    tests.append(Test(headers={**h, "Authorization": "{steps.7.accessToken}"},
        request="groups/1/characters/templates", method="POST",
        data=new_template, requirement=CREATED))

    # user_1 edits template
    tests.append(Test(headers={**h, "Authorization": "{steps.7.accessToken}"},
        request="groups/1/characters/templates/{steps.22.id}", method="PUT",
        data=edited_template, requirement=OK))

    # Create 4 characters
    for i in range(1, 5):
        tests.append(Test(headers={**h, "Authorization": "{steps.7.accessToken}"},
            request="groups/1/characters", method="POST",
            data={"name": f"Test Character {i}", "description": "", "templateId": "{steps.22.id}"},
            requirement=CREATED))

    # user_1 gives user_2 write access to char_2 (step 25)
    tests.append(Test(headers={**h, "Authorization": "{steps.7.accessToken}"},
        request="groups/1/characters/{steps.25.id}/users/{steps.2.id}", method="PUT",
        data={"canWrite": True}, requirement=CREATED))

    # user_1 gives user_3 read-only access to char_3 (step 26)
    tests.append(Test(headers={**h, "Authorization": "{steps.7.accessToken}"},
        request="groups/1/characters/{steps.26.id}/users/{steps.5.id}", method="PUT",
        data={"canWrite": False}, requirement=CREATED))

    # user_1 adds note to char_1 → 201
    tests.append(Test(headers={**h, "Authorization": "{steps.7.accessToken}"},
        request="groups/1/characters/{steps.24.id}/notes", method="POST",
        data=new_note, requirement=CREATED))

    # user_2 adds note to char_2 (can_write=True) → 201
    tests.append(Test(headers={**h, "Authorization": "{steps.8.accessToken}"},
        request="groups/1/characters/{steps.25.id}/notes", method="POST",
        data=new_note, requirement=CREATED))

    # user_3 adds note to char_3 (read-only) → 403
    tests.append(Test(headers={**h, "Authorization": "{steps.9.accessToken}"},
        request="groups/1/characters/{steps.26.id}/notes", method="POST",
        data=new_note, requirement=FORBID))

    # user_1 adds item to char_1 → 201
    tests.append(Test(headers={**h, "Authorization": "{steps.7.accessToken}"},
        request="groups/1/characters/{steps.24.id}/items", method="POST",
        data=new_character_item, requirement=CREATED))

    # user_2 adds item to char_2 (can_write=True) → 201
    tests.append(Test(headers={**h, "Authorization": "{steps.8.accessToken}"},
        request="groups/1/characters/{steps.25.id}/items", method="POST",
        data=new_character_item, requirement=CREATED))

    # user_3 adds item to char_3 (read-only) → 403
    tests.append(Test(headers={**h, "Authorization": "{steps.9.accessToken}"},
        request="groups/1/characters/{steps.26.id}/items", method="POST",
        data=new_character_item, requirement=FORBID))

    # user_1 creates group item → 201
    tests.append(Test(headers={**h, "Authorization": "{steps.7.accessToken}"},
        request="groups/1/items", method="POST",
        data=new_group_item, requirement=CREATED))

    # user_3 creates group item (not admin) → 403
    tests.append(Test(headers={**h, "Authorization": "{steps.9.accessToken}"},
        request="groups/1/items", method="POST",
        data=new_group_item, requirement=FORBID))

    steps = [GatewayStep(t) for t in tests]
    scenario = Scenario("GatewayMain", steps)
    scenarios.append(scenario)


def create_gateway_main_scenario():
    return scenarios
