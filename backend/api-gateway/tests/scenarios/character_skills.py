from tests.templates import Test, Scenario, GatewayStep
from tests.test_variables import *
from .auth_helper import register_or_auth

h = {"Content-Type": "application/json; charset=utf-8"}
scenarios: list[Scenario] = []


def register_character_skills_scenario():
    admin = register_or_auth("char_skills_admin", "Pass123")
    user = register_or_auth("char_skills_user", "Pass456")

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
        data={"name": "CharSkillsGroup"}, requirement=CREATED))

    # 1. Create template
    template = {
        "name": "Rogue",
        "description": "Stealthy character",
        "fields": {"stealth": {"name": "Stealth", "description": "Hide skill", "value": 10}}
    }
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.0.id}/characters/templates", method="POST",
        data=template, requirement=CREATED))

    # 2. Create character
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.0.id}/characters", method="POST",
        data={"name": "Shadow", "description": "Rogue", "templateId": "{steps.1.id}"},
        requirement=CREATED))

    # 3. Add user to character with read-only access
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.0.id}/characters/{steps.2.id}/users/{uid}", method="PUT",
        data={"canWrite": False}, requirement=CREATED))

    # 4. PUT /groups/{id}/skills/attributes (admin) → 200
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.0.id}/skills/attributes", method="PUT",
        data={"stealth": {"name": "Stealth"}, "perception": {"name": "Perception"}},
        requirement=OK))

    # 5. POST /groups/{id}/skills (admin, 2 skills) → 201, 201
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.0.id}/skills", method="POST",
        data={"name": "Stealth", "description": "Move silently"},
        requirement=CREATED))

    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.0.id}/skills", method="POST",
        data={"name": "Perception", "description": "Notice things"},
        requirement=CREATED))

    # 6. PUT /groups/{id}/characters/{charId}/skills/{skillId} (admin) → 200
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.0.id}/characters/{steps.2.id}/skills/{steps.5.id}",
        method="PUT", requirement=OK))

    # 7. GET /groups/{id}/characters/{charId}/skills (admin) → 200
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.0.id}/characters/{steps.2.id}/skills",
        method="GET", requirement=OK))

    # 8. DELETE /groups/{id}/characters/{charId}/skills/{skillId} (admin) → 200
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.0.id}/characters/{steps.2.id}/skills/{steps.5.id}",
        method="DELETE", requirement=OK))

    # 9. PUT /groups/{id}/characters/{charId}/skills/{skillId} (user, read-only) → 403
    tests.append(Test(headers={**h, "Authorization": "{ut}"},
        request="groups/{steps.0.id}/characters/{steps.2.id}/skills/{steps.6.id}",
        method="PUT", requirement=FORBID))

    steps = [GatewayStep(t) for t in tests]
    scenario = Scenario("CharacterSkillsAssignment", steps, data)
    scenarios.append(scenario)
