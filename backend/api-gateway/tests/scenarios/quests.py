from tests.templates import Test, Scenario, GatewayStep, replace_placeholders
from tests.test_variables import *
from tests.validators import has_id, has_list, has_list_empty, is_error
from .jwt_helper import generate_token

h = {"Content-Type": "application/json; charset=utf-8"}
scenarios: list[Scenario] = []


def deep_replace(data, results):
    if isinstance(data, str):
        return replace_placeholders(data, results)
    elif isinstance(data, list):
        return [deep_replace(item, results) for item in data]
    elif isinstance(data, dict):
        return {k: deep_replace(v, results) for k, v in data.items()}
    return data


class DeepGatewayStep(GatewayStep):
    def execute(self, _data):
        self.test.data = deep_replace(self.test.data, _data)
        return super().execute(_data)


def register_quests_scenario():
    admin_token, admin_id = generate_token()
    user_token, user_id = generate_token()
    stranger_token, stranger_id = generate_token()

    data = {
        "at": admin_token,
        "aid": admin_id,
        "ut": user_token,
        "uid": user_id,
        "st": stranger_token,
        "sid": stranger_id,
    }

    tests = []

    # 0. Create admin user
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="users", method="POST",
        data={"firstName": "Admin", "lastName": "User", "nickname": "quest_admin"}, requirement=CREATED))

    # 1. Create regular user
    tests.append(Test(headers={**h, "Authorization": "{ut}"},
        request="users", method="POST",
        data={"firstName": "Regular", "lastName": "User", "nickname": "quest_user"}, requirement=CREATED))

    # 2. Create group
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups", method="POST",
        data={"name": "QuestTestGroup"}, requirement=CREATED))

    # 3. Add user to group
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.2.id}/users/{uid}", method="PUT",
        data={"isAdmin": False}, requirement=CREATED))

    # 4. Create character template
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.2.id}/characters/templates", method="POST",
        data={
            "name": "QuestTestTemplate",
            "description": "Template for quest testing",
            "fields": {}
        }, requirement=CREATED))

    # 5. Create first character
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.2.id}/characters", method="POST",
        data={"name": "QuestChar1", "description": "", "templateId": "{steps.4.id}"},
        requirement=CREATED))

    # 6. Create second character
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.2.id}/characters", method="POST",
        data={"name": "QuestChar2", "description": "", "templateId": "{steps.4.id}"},
        requirement=CREATED))

    # 7. Give user write access to first character
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.2.id}/characters/{steps.5.id}/users/{uid}", method="PUT",
        data={"canWrite": True}, requirement=CREATED))

    # 8. Give user write access to second character
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.2.id}/characters/{steps.6.id}/users/{uid}", method="PUT",
        data={"canWrite": True}, requirement=CREATED))

    # 9. POST quest (admin) with assigned character
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.2.id}/quests", method="POST",
        data={
            "header": "Find the Amulet",
            "description": "Quest description here",
            "reward": ["100 XP", "Gold Ring"],
            "status": "active",
            "objectives": [
                {"key": "find_temple", "description": "Find the ancient temple", "status": "pending"},
                {"key": "defeat_guardian", "description": "Defeat the guardian", "status": "pending"},
                {"key": "claim_amulet", "description": "Claim the amulet", "status": "pending"}
            ],
            "assignedCharacters": ["{steps.5.id}"]
        }, requirement=CREATED, is_valid=has_id()))

    # 10. GET quests list (admin, no filters)
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.2.id}/quests", method="GET",
        requirement=OK, is_valid=has_list("quests")))

    # 11. GET single quest (admin)
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.2.id}/quests/{steps.9.id}", method="GET",
        requirement=OK, is_valid=has_id()))

    # 12. PUT update quest (admin) — add second character
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.2.id}/quests/{steps.9.id}", method="PUT",
        data={
            "header": "Find the Amulet (Updated)",
            "description": "Updated description",
            "reward": ["100 XP", "Gold Ring", "Legendary Sword"],
            "status": "active",
            "objectives": [
                {"key": "find_temple", "description": "Find the ancient temple", "status": "pending"},
                {"key": "defeat_guardian", "description": "Defeat the guardian", "status": "completed"},
                {"key": "claim_amulet", "description": "Claim the amulet", "status": "pending"}
            ],
            "assignedCharacters": ["{steps.5.id}", "{steps.6.id}"]
        }, requirement=OK, is_valid=has_id()))

    # 13. GET quest after update (admin)
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.2.id}/quests/{steps.9.id}", method="GET",
        requirement=OK,
        is_valid=lambda test, res: (
            res.json().get("header") == "Find the Amulet (Updated)",
            f"Expected header 'Find the Amulet (Updated)', got {res.json().get('header')}"
        )))

    # 14. PATCH objective status via quest patch (user, character_writer)
    tests.append(Test(headers={**h, "Authorization": "{ut}"},
        request="groups/{steps.2.id}/quests/{steps.9.id}",
        method="PATCH", data={
            "objectives": [{"key": "find_temple", "status": "completed"}]
        },
        requirement=OK))

    # 15. GET quest after objective update (admin)
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.2.id}/quests/{steps.9.id}", method="GET",
        requirement=OK,
        is_valid=lambda test, res: (
            any(
                obj.get("key") == "find_temple" and obj.get("status") == "completed"
                for obj in res.json().get("objectives", [])
            ),
            f"Expected find_temple=completed in objectives, got {res.json()}"
        )))

    # 16. GET quests filtered by userId (user)
    tests.append(Test(headers={**h, "Authorization": "{ut}"},
        request="groups/{steps.2.id}/quests?userId={uid}", method="GET",
        requirement=OK, is_valid=has_list("quests")))

    # 17. GET quests filtered by characterId (user)
    tests.append(Test(headers={**h, "Authorization": "{ut}"},
        request="groups/{steps.2.id}/quests?characterId={steps.5.id}", method="GET",
        requirement=OK, is_valid=has_list("quests")))

    # 18. GET quests combined filter (user)
    tests.append(Test(headers={**h, "Authorization": "{ut}"},
        request="groups/{steps.2.id}/quests?userId={uid}&characterId={steps.5.id}", method="GET",
        requirement=OK, is_valid=has_list("quests")))

    # 19. GET quests as stranger (should see empty)
    tests.append(Test(headers={**h, "Authorization": "{st}"},
        request="groups/{steps.2.id}/quests", method="GET",
        requirement=OK, is_valid=has_list("quests")))

    # 20. DELETE quest (admin)
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.2.id}/quests/{steps.9.id}", method="DELETE",
        requirement=OK))

    # 21. GET quest after delete (admin) → 404
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.2.id}/quests/{steps.9.id}", method="GET",
        requirement=NOT_FOUND, is_valid=is_error()))

    # 22. User creates quest for own character (via character endpoint) → 201
    tests.append(Test(headers={**h, "Authorization": "{ut}"},
        request="groups/{steps.2.id}/characters/{steps.5.id}/quests", method="POST",
        data={
            "header": "User's Own Quest",
            "description": "Created by user for their character",
            "reward": ["50 XP"],
            "status": "active",
            "objectives": [{"key": "do_something", "description": "Do something", "status": "pending"}]
        }, requirement=CREATED, is_valid=has_id()))

    # 23. Stranger tries to create quest → 403
    tests.append(Test(headers={**h, "Authorization": "{st}"},
        request="groups/{steps.2.id}/quests", method="POST",
        data={
            "header": "Stranger Quest",
            "description": "",
            "reward": [],
            "status": "active",
            "objectives": [],
            "assignedCharacters": ["{steps.5.id}"]
        }, requirement=FORBID))

    # 24. Stranger tries to create quest for character → 403
    tests.append(Test(headers={**h, "Authorization": "{st}"},
        request="groups/{steps.2.id}/characters/{steps.5.id}/quests", method="POST",
        data={
            "header": "Hacked Quest",
            "description": "",
            "reward": [],
            "status": "active",
            "objectives": []
        }, requirement=FORBID))

    # 25. Stranger tries to update quest → 403
    tests.append(Test(headers={**h, "Authorization": "{st}"},
        request="groups/{steps.2.id}/quests/{steps.9.id}", method="PUT",
        data={
            "header": "Hacked!",
            "description": "",
            "reward": [],
            "status": "active",
            "objectives": [],
            "assignedCharacters": ["{steps.5.id}"]
        }, requirement=FORBID))

    # 26. Stranger tries to patch quest → 403
    tests.append(Test(headers={**h, "Authorization": "{st}"},
        request="groups/{steps.2.id}/quests/{steps.9.id}", method="PATCH",
        data={"header": "Hacked!"},
        requirement=FORBID))

    # 27. DELETE user's quest (admin) → 200
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.2.id}/quests/{steps.22.id}", method="DELETE",
        requirement=OK))

    steps = [DeepGatewayStep(t) for t in tests]
    scenario = Scenario("Quests", steps, data)
    scenarios.append(scenario)
