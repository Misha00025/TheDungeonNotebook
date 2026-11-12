from tests.templates import Test, Scenario, GatewayStep
from tests.test_variables import *
from tests.validators import has_id, is_error
from .jwt_helper import generate_token

h = {"Content-Type": "application/json; charset=utf-8"}
scenarios: list[Scenario] = []


def register_character_commands_batch_scenario():
    admin_token, admin_id = generate_token()
    user_token, user_id = generate_token()

    data = {"at": admin_token, "aid": admin_id, "ut": user_token, "uid": user_id}

    tests = []

    # 0. Create admin user
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="users", method="POST",
        data={"firstName": "Admin", "lastName": "User", "nickname": "batch_admin"}, requirement=CREATED,
        is_valid=has_id()))

    # 1. Create regular user
    tests.append(Test(headers={**h, "Authorization": "{ut}"},
        request="users", method="POST",
        data={"firstName": "Regular", "lastName": "User", "nickname": "batch_user"}, requirement=CREATED,
        is_valid=has_id()))

    # 2. Create group
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups", method="POST",
        data={"name": "BatchGroup"}, requirement=CREATED,
        is_valid=has_id()))

    # 3. Add user to group (not admin)
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.2.id}/users/{uid}", method="PUT",
        data={"isAdmin": False}, requirement=CREATED))

    # 4. Create template
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.2.id}/characters/templates", method="POST",
        data={"name": "BatchTemplate", "description": "Batch commands test",
              "fields": {"hp": {"name": "HP", "description": "Health points", "value": 100}}},
        requirement=CREATED,
        is_valid=has_id()))

    # 5. Create character (admin, for batch commands endpoint tests)
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.2.id}/characters", method="POST",
        data={"name": "BatchMain", "description": "", "templateId": "{steps.4.id}"},
        requirement=CREATED,
        is_valid=has_id()))

    # 6. Create character for user write access test
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.2.id}/characters", method="POST",
        data={"name": "BatchWritable", "description": "", "templateId": "{steps.4.id}"},
        requirement=CREATED,
        is_valid=has_id()))

    # 7. Grant write access to user on char_6
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.2.id}/characters/{steps.6.id}/users/{uid}", method="PUT",
        data={"canWrite": True}, requirement=CREATED))

    # 8. Create character for user read-only access test
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.2.id}/characters", method="POST",
        data={"name": "BatchReadOnly", "description": "", "templateId": "{steps.4.id}"},
        requirement=CREATED,
        is_valid=has_id()))

    # 9. Set read-only access to user on char_8
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.2.id}/characters/{steps.8.id}/users/{uid}", method="PUT",
        data={"canWrite": False}, requirement=CREATED))

    # 10. Batch [AddField agility, UpdateField agility, DeleteField agility] — all succeed → 200, results length 3, final agility absent
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.2.id}/characters/{steps.5.id}/commands/batch", method="POST",
        data=[
            {"type": "AddField", "payload": {"key": "agility", "field": {"name": "Agility", "description": "Agility stat", "value": 10}}},
            {"type": "UpdateField", "payload": {"key": "agility", "field": {"name": "Agility", "description": "Agility stat", "value": 15}}},
            {"type": "DeleteField", "payload": {"key": "agility"}}
        ],
        requirement=OK,
        is_valid=lambda test, res: (
            len(res.json()["results"]) == 3
            and all(r["status"] == 200 for r in res.json()["results"]),
            "Batch all 3 succeed: results length 3, all status 200")))

    # 10a. GET character to verify final state — agility should be absent
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.2.id}/characters/{steps.5.id}", method="GET", requirement=OK,
        is_valid=lambda test, res: (
            "agility" not in res.json().get("fields", {}),
            "POST char_5: agility absent after batch add+update+delete")))

    # 11. Batch [AddField strength, DeleteField nonexistent_key] → 400, failedIndex=1
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.2.id}/characters/{steps.5.id}/commands/batch", method="POST",
        data=[
            {"type": "AddField", "payload": {"key": "strength", "field": {"name": "Strength", "description": "Strength stat", "value": 12}}},
            {"type": "DeleteField", "payload": {"key": "nonexistent_key"}}
        ],
        requirement=BAD,
        is_valid=lambda test, res: (
            "title" in res.json()
            and "failedIndex" in res.json()
            and res.json()["failedIndex"] == 1
            and len(res.json()["results"]) == 2,
            "Batch valid+invalid: failedIndex=1, results length 2")))

    # 12. Batch [Bogus] — unknown command type → 422, is_error
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.2.id}/characters/{steps.5.id}/commands/batch", method="POST",
        data=[
            {"type": "Bogus", "payload": {}}
        ],
        requirement=UNPROCESSABLE,
        is_valid=is_error()))

    # 13. Batch on read-only char_8 as user → 403, is_error
    tests.append(Test(headers={**h, "Authorization": "{ut}"},
        request="groups/{steps.2.id}/characters/{steps.8.id}/commands/batch", method="POST",
        data=[
            {"type": "AddField", "payload": {"key": "willpower", "field": {"name": "Willpower", "description": "Willpower stat", "value": 5}}}
        ],
        requirement=FORBID,
        is_valid=is_error()))

    steps = [GatewayStep(t) for t in tests]
    scenario = Scenario("CharacterCommandsBatch", steps, data)
    scenarios.append(scenario)
