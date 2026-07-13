from tests.templates import Test, Scenario, GatewayStep
from tests.test_variables import *
from .jwt_helper import generate_token

h = {"Content-Type": "application/json; charset=utf-8"}
scenarios: list[Scenario] = []


def register_group_skills_scenario():
    admin_id = 6001
    user_id = 6002

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
        data={"firstName": "Admin", "lastName": "User", "nickname": "skills_admin"}, requirement=CREATED))

    # 1. Create regular user
    tests.append(Test(headers={**h, "Authorization": "{ut}"},
        request="users", method="POST",
        data={"firstName": "Regular", "lastName": "User", "nickname": "skills_user"}, requirement=CREATED))

    # 2. Create group
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups", method="POST",
        data={"name": "SkillsGroup"}, requirement=CREATED))

    # 3. Add user to group
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.2.id}/users/{uid}", method="PUT",
        data={"isAdmin": False}, requirement=CREATED))

    # 4. PUT /groups/{id}/skills/attributes (admin) → 200
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.2.id}/skills/attributes", method="PUT",
        data={"attributes": [{"key": "strength", "name": "Strength"}, {"key": "dexterity", "name": "Dexterity"}]},
        requirement=OK))

    # 5. GET /groups/{id}/skills/attributes → 200
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.2.id}/skills/attributes", method="GET", requirement=OK))

    # 6. POST /groups/{id}/skills (admin) → 201
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.2.id}/skills", method="POST",
        data={"name": "Athletics", "description": "Climb, jump, swim"},
        requirement=CREATED))

    # 7. GET /groups/{id}/skills → 200
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.2.id}/skills", method="GET", requirement=OK))

    # 8. GET /groups/{id}/skills/{skillId} → 200
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.2.id}/skills/{steps.6.id}", method="GET", requirement=OK))

    # 9. PUT /groups/{id}/skills/{skillId} (admin) → 200
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.2.id}/skills/{steps.6.id}", method="PUT",
        data={"name": "Athletics (Improved)"}, requirement=OK))

    # 10. DELETE /groups/{id}/skills/{skillId} (admin) → 200
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.2.id}/skills/{steps.6.id}", method="DELETE", requirement=OK))

    # 11. POST /groups/{id}/skills (user, not admin) → 403
    tests.append(Test(headers={**h, "Authorization": "{ut}"},
        request="groups/{steps.2.id}/skills", method="POST",
        data={"name": "Illegal Skill"}, requirement=FORBID))

    # 12. PUT /groups/{id}/skills/attributes (user, not admin) → 403
    tests.append(Test(headers={**h, "Authorization": "{ut}"},
        request="groups/{steps.2.id}/skills/attributes", method="PUT",
        data={"attributes": [{"key": "strength", "name": "STR"}]}, requirement=FORBID))

    steps = [GatewayStep(t) for t in tests]
    scenario = Scenario("GroupSkills", steps, data)
    scenarios.append(scenario)
