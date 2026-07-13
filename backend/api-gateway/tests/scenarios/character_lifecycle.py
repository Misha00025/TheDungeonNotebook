from tests.templates import Test, Scenario, GatewayStep
from tests.test_variables import *
from .jwt_helper import generate_token

h = {"Content-Type": "application/json; charset=utf-8"}
scenarios: list[Scenario] = []


def register_character_lifecycle_scenario():
    admin_id = 5001
    user_id = 5002

    admin_token = generate_token(admin_id)
    user_token = generate_token(user_id)

    data = {
        "at": admin_token,
        "aid": admin_id,
        "ut": user_token,
        "uid": user_id,
    }

    tests = []

    # 0. Create admin user
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="users", method="POST",
        data={"firstName": "Admin", "lastName": "User", "nickname": "char_admin"}, requirement=CREATED))

    # 1. Create regular user
    tests.append(Test(headers={**h, "Authorization": "{ut}"},
        request="users", method="POST",
        data={"firstName": "Regular", "lastName": "User", "nickname": "char_user"}, requirement=CREATED))

    # 2. Create group
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups", method="POST",
        data={"name": "CharGroup"}, requirement=CREATED))

    # 3. Add user to group
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.2.id}/users/{uid}", method="PUT",
        data={"isAdmin": False}, requirement=CREATED))

    # 4. Create template
    new_template = {
        "name": "Warrior",
        "description": "Strong melee fighter",
        "fields": {"strength": {"name": "Strength", "description": "Physical power", "value": 10}}
    }
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.2.id}/characters/templates", method="POST",
        data=new_template, requirement=CREATED))

    # 5. Create character (admin) → 201
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.2.id}/characters", method="POST",
        data={"name": "Conan", "description": "Barbarian", "templateId": "{steps.4.id}"},
        requirement=CREATED))

    # 6. GET /groups/{id}/characters (admin) → 200
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.2.id}/characters", method="GET", requirement=OK))

    # 7. GET /groups/{id}/characters/{charId} (admin) → 200
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.2.id}/characters/{steps.5.id}", method="GET", requirement=OK))

    # 8. PATCH /groups/{id}/characters/{charId} (admin) → 200
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.2.id}/characters/{steps.5.id}", method="PATCH",
        data={"name": "Conan the Barbarian"}, requirement=OK))

    # 9. Create second character for deletion
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.2.id}/characters", method="POST",
        data={"name": "DeleteMe", "description": "To be deleted", "templateId": "{steps.4.id}"},
        requirement=CREATED))

    # 10. DELETE /groups/{id}/characters/{charId} (admin) → 200
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.2.id}/characters/{steps.9.id}", method="DELETE", requirement=OK))

    # 11. GET /groups/{id}/characters/{charId} (after delete) → 404
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.2.id}/characters/{steps.9.id}", method="GET", requirement=NOT_FOUND))

    # 12. POST /groups/{id}/characters (user, not admin) → 403
    tests.append(Test(headers={**h, "Authorization": "{ut}"},
        request="groups/{steps.2.id}/characters", method="POST",
        data={"name": "Unauthorized", "description": "Should fail", "templateId": "{steps.4.id}"},
        requirement=FORBID))

    # === Character access control ===

    # 13. Create another character for write access testing
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.2.id}/characters", method="POST",
        data={"name": "WriteTestChar", "description": "", "templateId": "{steps.4.id}"},
        requirement=CREATED))

    # 14. Create another character for read-only testing
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.2.id}/characters", method="POST",
        data={"name": "ReadOnlyTestChar", "description": "", "templateId": "{steps.4.id}"},
        requirement=CREATED))

    # 15. Add user to group on char_3 (write access)
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.2.id}/characters/{steps.13.id}/users/{uid}", method="PUT",
        data={"canWrite": True}, requirement=CREATED))

    # 16. Add user to group on char_4 (read-only)
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.2.id}/characters/{steps.14.id}/users/{uid}", method="PUT",
        data={"canWrite": False}, requirement=CREATED))

    # 17. PATCH char_4 (user, read-only) → 403
    tests.append(Test(headers={**h, "Authorization": "{ut}"},
        request="groups/{steps.2.id}/characters/{steps.14.id}", method="PATCH",
        data={"name": "Hacked"}, requirement=FORBID))

    # 18. PATCH char_3 (user, write access) → 200
    tests.append(Test(headers={**h, "Authorization": "{ut}"},
        request="groups/{steps.2.id}/characters/{steps.13.id}", method="PATCH",
        data={"name": "UpdatedByUser"}, requirement=OK))

    # 19. DELETE char_4 (user, read-only) → 403
    tests.append(Test(headers={**h, "Authorization": "{ut}"},
        request="groups/{steps.2.id}/characters/{steps.14.id}", method="DELETE", requirement=FORBID))

    # 20. DELETE char_3 (user, write access) → 200
    tests.append(Test(headers={**h, "Authorization": "{ut}"},
        request="groups/{steps.2.id}/characters/{steps.13.id}", method="DELETE", requirement=OK))

    # 21. GET /groups/{id}/characters/{charId}/users (composite handler) → 200
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.2.id}/characters/{steps.5.id}/users", method="GET", requirement=OK))

    # 22. DELETE /.../characters/{charId}/users/{uid} (user, not admin) → 403
    tests.append(Test(headers={**h, "Authorization": "{ut}"},
        request="groups/{steps.2.id}/characters/{steps.5.id}/users/{uid}", method="DELETE", requirement=FORBID))

    # 23. Create a new character for admin DELETE user test
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.2.id}/characters", method="POST",
        data={"name": "DeleteUserTest", "description": "", "templateId": "{steps.4.id}"},
        requirement=CREATED))

    # 24. Add user to the new character with write access
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.2.id}/characters/{steps.23.id}/users/{uid}", method="PUT",
        data={"canWrite": True}, requirement=CREATED))

    # 25. DELETE /.../characters/{charId}/users/{uid} (admin) → 200
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.2.id}/characters/{steps.23.id}/users/{uid}", method="DELETE", requirement=OK))

    steps = [GatewayStep(t) for t in tests]
    scenario = Scenario("CharacterLifecycle", steps, data)
    scenarios.append(scenario)
