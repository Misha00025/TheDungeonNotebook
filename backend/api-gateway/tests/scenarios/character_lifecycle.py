from tests.templates import Test, Scenario, GatewayStep
from tests.test_variables import *
from .auth_helper import register_or_auth

h = {"Content-Type": "application/json; charset=utf-8"}
scenarios: list[Scenario] = []


def register_character_lifecycle_scenario():
    admin = register_or_auth("char_admin", "Pass123")
    user = register_or_auth("char_user", "Pass456")

    data = {
        "at": admin["accessToken"],
        "aid": admin["id"],
        "ut": user["accessToken"],
        "uid": user["id"],
    }

    tests = []

    # 0. Create group
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups", method="POST",
        data={"name": "CharGroup"}, requirement=CREATED))

    # 1. Create template
    new_template = {
        "name": "Warrior",
        "description": "Strong melee fighter",
        "fields": {"strength": {"name": "Strength", "description": "Physical power", "value": 10}}
    }
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.0.id}/characters/templates", method="POST",
        data=new_template, requirement=CREATED))

    # 2. Create character (admin) → 201
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.0.id}/characters", method="POST",
        data={"name": "Conan", "description": "Barbarian", "templateId": "{steps.1.id}"},
        requirement=CREATED))

    # 3. GET /groups/{id}/characters (admin) → 200
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.0.id}/characters", method="GET", requirement=OK))

    # 4. GET /groups/{id}/characters/{charId} (admin) → 200
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.0.id}/characters/{steps.2.id}", method="GET", requirement=OK))

    # 5. PATCH /groups/{id}/characters/{charId} (admin) → 200
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.0.id}/characters/{steps.2.id}", method="PATCH",
        data={"name": "Conan the Barbarian"}, requirement=OK))

    # 6. Create second character for deletion
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.0.id}/characters", method="POST",
        data={"name": "DeleteMe", "description": "To be deleted", "templateId": "{steps.1.id}"},
        requirement=CREATED))

    # 7. DELETE /groups/{id}/characters/{charId} (admin) → 200
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.0.id}/characters/{steps.6.id}", method="DELETE", requirement=OK))

    # 8. GET /groups/{id}/characters/{charId} (after delete) → 404
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.0.id}/characters/{steps.6.id}", method="GET", requirement=NOT_FOUND))

    # 9. POST /groups/{id}/characters (user, not admin) → 403
    tests.append(Test(headers={**h, "Authorization": "{ut}"},
        request="groups/{steps.0.id}/characters", method="POST",
        data={"name": "Unauthorized", "description": "Should fail", "templateId": "{steps.1.id}"},
        requirement=FORBID))

    steps = [GatewayStep(t) for t in tests]
    scenario = Scenario("CharacterLifecycle", steps, data)
    scenarios.append(scenario)
