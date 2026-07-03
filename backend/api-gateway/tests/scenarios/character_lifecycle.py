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

    # 1. Add user to group
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.0.id}/users/{uid}", method="PUT",
        data={"isAdmin": False}, requirement=CREATED))

    # 2. Create template
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
        data={"name": "Conan", "description": "Barbarian", "templateId": "{steps.2.id}"},
        requirement=CREATED))

    # 3. GET /groups/{id}/characters (admin) → 200
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.0.id}/characters", method="GET", requirement=OK))

    # 4. GET /groups/{id}/characters/{charId} (admin) → 200
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.0.id}/characters/{steps.3.id}", method="GET", requirement=OK))

    # 5. PATCH /groups/{id}/characters/{charId} (admin) → 200
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.0.id}/characters/{steps.3.id}", method="PATCH",
        data={"name": "Conan the Barbarian"}, requirement=OK))

    # 6. Create second character for deletion
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.0.id}/characters", method="POST",
        data={"name": "DeleteMe", "description": "To be deleted", "templateId": "{steps.2.id}"},
        requirement=CREATED))

    # 7. DELETE /groups/{id}/characters/{charId} (admin) → 200
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.0.id}/characters/{steps.7.id}", method="DELETE", requirement=OK))

    # 8. GET /groups/{id}/characters/{charId} (after delete) → 404
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.0.id}/characters/{steps.7.id}", method="GET", requirement=NOT_FOUND))

    # 9. POST /groups/{id}/characters (user, not admin) → 403
    tests.append(Test(headers={**h, "Authorization": "{ut}"},
        request="groups/{steps.0.id}/characters", method="POST",
        data={"name": "Unauthorized", "description": "Should fail", "templateId": "{steps.2.id}"},
        requirement=FORBID))

    # === Character access control ===

    # 10. Create another character for write access testing
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.0.id}/characters", method="POST",
        data={"name": "WriteTestChar", "description": "", "templateId": "{steps.2.id}"},
        requirement=CREATED))

    # 11. Create another character for read-only testing
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.0.id}/characters", method="POST",
        data={"name": "ReadOnlyTestChar", "description": "", "templateId": "{steps.2.id}"},
        requirement=CREATED))

    # 12. Add user to group on char_3 (write access)
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.0.id}/characters/{steps.11.id}/users/{uid}", method="PUT",
        data={"canWrite": True}, requirement=CREATED))

    # 13. Add user to group on char_4 (read-only)
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.0.id}/characters/{steps.12.id}/users/{uid}", method="PUT",
        data={"canWrite": False}, requirement=CREATED))

    # 14. PATCH char_4 (user, read-only) → 403
    tests.append(Test(headers={**h, "Authorization": "{ut}"},
        request="groups/{steps.0.id}/characters/{steps.12.id}", method="PATCH",
        data={"name": "Hacked"}, requirement=FORBID))

    # 15. PATCH char_3 (user, write access) → 200
    tests.append(Test(headers={**h, "Authorization": "{ut}"},
        request="groups/{steps.0.id}/characters/{steps.11.id}", method="PATCH",
        data={"name": "UpdatedByUser"}, requirement=OK))

    # 16. DELETE char_4 (user, read-only) → 403
    tests.append(Test(headers={**h, "Authorization": "{ut}"},
        request="groups/{steps.0.id}/characters/{steps.12.id}", method="DELETE", requirement=FORBID))

    # 17. DELETE char_3 (user, write access) → 200
    tests.append(Test(headers={**h, "Authorization": "{ut}"},
        request="groups/{steps.0.id}/characters/{steps.11.id}", method="DELETE", requirement=OK))

    # 18. GET /groups/{id}/characters/{charId}/users (composite handler) → 200
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.0.id}/characters/{steps.3.id}/users", method="GET", requirement=OK))

    # 19. DELETE /.../characters/{charId}/users/{uid} (user, not admin) → 403
    tests.append(Test(headers={**h, "Authorization": "{ut}"},
        request="groups/{steps.0.id}/characters/{steps.3.id}/users/{uid}", method="DELETE", requirement=FORBID))

    steps = [GatewayStep(t) for t in tests]
    scenario = Scenario("CharacterLifecycle", steps, data)
    scenarios.append(scenario)
