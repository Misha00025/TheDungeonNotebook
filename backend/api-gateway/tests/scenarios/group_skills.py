from tests.templates import Test, Scenario, GatewayStep
from tests.test_variables import *
from .auth_helper import register_or_auth

h = {"Content-Type": "application/json; charset=utf-8"}
scenarios: list[Scenario] = []


def register_group_skills_scenario():
    admin = register_or_auth("skills_admin", "Pass123")
    user = register_or_auth("skills_user", "Pass456")

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
        data={"name": "SkillsGroup"}, requirement=CREATED))

    # Add user to group
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.0.id}/users/{uid}", method="PUT",
        data={"isAdmin": False}, requirement=CREATED))

    # 1. PUT /groups/{id}/skills/attributes (admin) → 200
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.0.id}/skills/attributes", method="PUT",
        data={"strength": {"name": "Strength"}, "dexterity": {"name": "Dexterity"}},
        requirement=OK))

    # 2. GET /groups/{id}/skills/attributes → 200
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.0.id}/skills/attributes", method="GET", requirement=OK))

    # 3. POST /groups/{id}/skills (admin) → 201
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.0.id}/skills", method="POST",
        data={"name": "Athletics", "description": "Climb, jump, swim"},
        requirement=CREATED))

    # 4. GET /groups/{id}/skills → 200
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.0.id}/skills", method="GET", requirement=OK))

    # 5. GET /groups/{id}/skills/{skillId} → 200
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.0.id}/skills/{steps.3.id}", method="GET", requirement=OK))

    # 6. PUT /groups/{id}/skills/{skillId} (admin) → 200
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.0.id}/skills/{steps.3.id}", method="PUT",
        data={"name": "Athletics (Improved)"}, requirement=OK))

    # 7. DELETE /groups/{id}/skills/{skillId} (admin) → 200
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.0.id}/skills/{steps.3.id}", method="DELETE", requirement=OK))

    # 8. POST /groups/{id}/skills (user, not admin) → 403
    tests.append(Test(headers={**h, "Authorization": "{ut}"},
        request="groups/{steps.0.id}/skills", method="POST",
        data={"name": "Illegal Skill"}, requirement=FORBID))

    # 9. PUT /groups/{id}/skills/attributes (user, not admin) → 403
    tests.append(Test(headers={**h, "Authorization": "{ut}"},
        request="groups/{steps.0.id}/skills/attributes", method="PUT",
        data={"strength": {"name": "STR"}}, requirement=FORBID))

    steps = [GatewayStep(t) for t in tests]
    scenario = Scenario("GroupSkills", steps, data)
    scenarios.append(scenario)
