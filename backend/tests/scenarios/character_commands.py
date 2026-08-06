from tests.templates import Test, Scenario, GatewayStep
from tests.test_variables import *
from tests.validators import has_id, has_keys, has_fields, is_error
from .jwt_helper import generate_token

h = {"Content-Type": "application/json; charset=utf-8"}
scenarios: list[Scenario] = []


def register_character_commands_scenario():
    admin_token, admin_id = generate_token()
    user_token, user_id = generate_token()

    data = {"at": admin_token, "aid": admin_id, "ut": user_token, "uid": user_id}

    tests = []

    # 0. Create admin user
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="users", method="POST",
        data={"firstName": "Admin", "lastName": "User", "nickname": "cmd_admin"}, requirement=CREATED,
        is_valid=has_id()))

    # 1. Create regular user
    tests.append(Test(headers={**h, "Authorization": "{ut}"},
        request="users", method="POST",
        data={"firstName": "Regular", "lastName": "User", "nickname": "cmd_user"}, requirement=CREATED,
        is_valid=has_id()))

    # 2. Create group
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups", method="POST",
        data={"name": "CmdGroup"}, requirement=CREATED,
        is_valid=has_id()))

    # 3. Add user to group (not admin)
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.2.id}/users/{uid}", method="PUT",
        data={"isAdmin": False}, requirement=CREATED))

    # 4. Create template
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.2.id}/characters/templates", method="POST",
        data={"name": "CmdTemplate", "description": "Commands test",
              "fields": {"hp": {"name": "HP", "description": "Health points", "value": 100},
                         "mp": {"name": "MP", "description": "Mana points", "value": 50}}},
        requirement=CREATED,
        is_valid=has_id()))

    # 5. Create character (admin, for commands endpoint tests)
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.2.id}/characters", method="POST",
        data={"name": "CmdMain", "description": "", "templateId": "{steps.4.id}"},
        requirement=CREATED,
        is_valid=has_id()))

    # 6. Create character for user write access test
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.2.id}/characters", method="POST",
        data={"name": "CmdWritable", "description": "", "templateId": "{steps.4.id}"},
        requirement=CREATED,
        is_valid=has_id()))

    # 7. Grant write access to user on char_6
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.2.id}/characters/{steps.6.id}/users/{uid}", method="PUT",
        data={"canWrite": True}, requirement=CREATED))

    # 8. Create character for user read-only access test
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.2.id}/characters", method="POST",
        data={"name": "CmdReadOnly", "description": "", "templateId": "{steps.4.id}"},
        requirement=CREATED,
        is_valid=has_id()))

    # 9. Set read-only access to user on char_8
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.2.id}/characters/{steps.8.id}/users/{uid}", method="PUT",
        data={"canWrite": False}, requirement=CREATED))

    # 10. POST commands on char_5 (admin) — endpoint NOT IMPLEMENTED → 501
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.2.id}/characters/{steps.5.id}/commands", method="POST",
        data={"type": "Bogus", "payload": {}}, requirement=NOT_IMPL,
        is_valid=is_error()))

    # 11. AddField — admin on char_5
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.2.id}/characters/{steps.5.id}/commands", method="POST",
        data={"type": "AddField",
              "payload": {"key": "agility",
                          "field": {"name": "Agility", "description": "Agility stat", "value": 5}}},
        requirement=OK,
        is_valid=lambda test, res: (
            res.json()["fields"]["agility"]["value"] == 5
            and res.json()["fields"]["agility"]["name"] == "Agility",
            "AddField agility value=5, name=Agility")))

    # 12. AddField (override existing field) — admin on char_5
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.2.id}/characters/{steps.5.id}/commands", method="POST",
        data={"type": "AddField",
              "payload": {"key": "hp",
                          "field": {"name": "HP", "description": "Health points", "value": 75}}},
        requirement=OK,
        is_valid=lambda test, res: (
            res.json()["fields"]["hp"]["value"] == 75,
            "AddField hp value=75")))

    # 13. UpdateField — admin on char_5 with idempotency key
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.2.id}/characters/{steps.5.id}/commands", method="POST",
        data={"type": "UpdateField",
              "payload": {"key": "agility",
                          "field": {"name": "Agility", "description": "Agility stat", "value": 8}},
              "idempotencyKey": "cmd-k1"},
        requirement=OK,
        is_valid=lambda test, res: (
            res.json()["fields"]["agility"]["value"] == 8,
            "UpdateField agility value=8")))

    # 14. DeleteField — admin on char_5
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.2.id}/characters/{steps.5.id}/commands", method="POST",
        data={"type": "DeleteField", "payload": {"key": "agility"}},
        requirement=OK,
        is_valid=lambda test, res: (
            "agility" not in res.json().get("fields", {})
            and res.json()["fields"]["hp"]["value"] == 75,
            "DeleteField agility removed, hp value=75")))

    # 15. DeleteField (duplicate / no-op) — admin on char_5
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.2.id}/characters/{steps.5.id}/commands", method="POST",
        data={"type": "DeleteField", "payload": {"key": "agility"}},
        requirement=OK,
        is_valid=lambda test, res: (
            "error" not in res.json()
            and "id" in res.json()
            and "agility" not in res.json().get("fields", {}),
            "Duplicate DeleteField: no error, has id, agility still absent")))

    # 16. AddField — user on char_6 (has canWrite=True)
    tests.append(Test(headers={**h, "Authorization": "{ut}"},
        request="groups/{steps.2.id}/characters/{steps.6.id}/commands", method="POST",
        data={"type": "AddField",
              "payload": {"key": "luck",
                          "field": {"name": "Luck", "description": "Fortune", "value": 7}}},
        requirement=OK,
        is_valid=lambda test, res: (
            res.json()["fields"]["luck"]["value"] == 7,
            "User AddField luck value=7 on writable char")))

    # 17. AddField — user on char_8 (has canWrite=False) → FORBIDDEN
    tests.append(Test(headers={**h, "Authorization": "{ut}"},
        request="groups/{steps.2.id}/characters/{steps.8.id}/commands", method="POST",
        data={"type": "AddField",
              "payload": {"key": "luck",
                          "field": {"name": "Luck", "description": "Fortune", "value": 1}}},
        requirement=FORBID,
        is_valid=is_error()))

    # 18. GET character (verify commands persisted — hp=75, agility absent)
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.2.id}/characters/{steps.5.id}", method="GET", requirement=OK,
        is_valid=lambda test, res: (
            res.json()["fields"]["hp"]["value"] == 75
            and "agility" not in res.json().get("fields", {}),
            "GET char_5: hp=75, agility absent")))

    steps = [GatewayStep(t) for t in tests]
    scenario = Scenario("CharacterCommands", steps, data)
    scenarios.append(scenario)
