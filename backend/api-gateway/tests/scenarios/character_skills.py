from tests.templates import Test, Scenario, GatewayStep
from tests.test_variables import *
from .jwt_helper import generate_token

h = {"Content-Type": "application/json; charset=utf-8"}
scenarios: list[Scenario] = []


def register_character_skills_scenario():
    admin_token, admin_id = generate_token()
    user_token, user_id = generate_token()

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
        data={"firstName": "Admin", "lastName": "User", "nickname": "char_skills_admin"}, requirement=CREATED))

    # 1. Create regular user
    tests.append(Test(headers={**h, "Authorization": "{ut}"},
        request="users", method="POST",
        data={"firstName": "Regular", "lastName": "User", "nickname": "char_skills_user"}, requirement=CREATED))

    # 2. Create group
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups", method="POST",
        data={"name": "CharSkillsGroup"}, requirement=CREATED))

    # 3. Add user to group
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.2.id}/users/{uid}", method="PUT",
        data={"isAdmin": False}, requirement=CREATED))

    # 4. Create template
    template = {
        "name": "Rogue",
        "description": "Stealthy character",
        "fields": {"stealth": {"name": "Stealth", "description": "Hide skill", "value": 10}}
    }
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.2.id}/characters/templates", method="POST",
        data=template, requirement=CREATED))

    # 5. Create character
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.2.id}/characters", method="POST",
        data={"name": "Shadow", "description": "Rogue", "templateId": "{steps.4.id}"},
        requirement=CREATED))

    # 6. Add user to character with read-only access
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.2.id}/characters/{steps.5.id}/users/{uid}", method="PUT",
        data={"canWrite": False}, requirement=CREATED))

    # 7. PUT /groups/{id}/skills/attributes (admin) → 200
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.2.id}/skills/attributes", method="PUT",
        data={"attributes": [{"key": "stealth", "name": "Stealth"}, {"key": "perception", "name": "Perception"}]},
        requirement=OK))

    # 8. POST /groups/{id}/skills (admin, 2 skills) → 201, 201
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.2.id}/skills", method="POST",
        data={"name": "Stealth", "description": "Move silently"},
        requirement=CREATED))

    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.2.id}/skills", method="POST",
        data={"name": "Perception", "description": "Notice things"},
        requirement=CREATED))

    # 9. PUT /groups/{id}/characters/{charId}/skills/{skillId} (admin, assign Stealth) → 200
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.2.id}/characters/{steps.5.id}/skills/{steps.8.id}",
        method="PUT", requirement=OK))

    # 10. PUT /groups/{id}/characters/{charId}/skills/{skillId} (admin, assign Perception) → 200
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.2.id}/characters/{steps.5.id}/skills/{steps.9.id}",
        method="PUT", requirement=OK))

    # 11. GET /groups/{id}/characters/{charId}/skills (admin) → 200
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.2.id}/characters/{steps.5.id}/skills",
        method="GET", requirement=OK))

    # 12. PUT /groups/{id}/characters/{charId}/skills/{skillId} (user, read-only on Stealth) → 403
    tests.append(Test(headers={**h, "Authorization": "{ut}"},
        request="groups/{steps.2.id}/characters/{steps.5.id}/skills/{steps.8.id}",
        method="PUT", requirement=FORBID))

    # 13. DELETE /groups/{id}/characters/{charId}/skills/{skillId} (admin, delete Stealth) → 200
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.2.id}/characters/{steps.5.id}/skills/{steps.8.id}",
        method="DELETE", requirement=OK))

    steps = [GatewayStep(t) for t in tests]
    scenario = Scenario("CharacterSkillsAssignment", steps, data)
    scenarios.append(scenario)
