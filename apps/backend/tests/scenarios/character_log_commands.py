from tests.templates import Test, Scenario, GatewayStep
from tests.test_variables import *
from tests.validators import has_id, is_error
from .jwt_helper import generate_token

h = {"Content-Type": "application/json; charset=utf-8"}
scenarios: list[Scenario] = []


def register_character_log_commands_scenario():
    admin_token, admin_id = generate_token()
    user_token, user_id = generate_token()

    data = {"at": admin_token, "aid": admin_id, "ut": user_token, "uid": user_id}

    tests = []

    # 0. Create admin user
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="users", method="POST",
        data={"firstName": "Admin", "lastName": "User", "nickname": "logcmd_admin"}, requirement=CREATED,
        is_valid=has_id()))

    # 1. Create regular user
    tests.append(Test(headers={**h, "Authorization": "{ut}"},
        request="users", method="POST",
        data={"firstName": "Regular", "lastName": "User", "nickname": "logcmd_user"}, requirement=CREATED,
        is_valid=has_id()))

    # 2. Create group
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups", method="POST",
        data={"name": "LogCmdGroup"}, requirement=CREATED,
        is_valid=has_id()))

    # 3. Add user to group (not admin)
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.2.id}/users/{uid}", method="PUT",
        data={"isAdmin": False}, requirement=CREATED))

    # 4. Create template
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.2.id}/characters/templates", method="POST",
        data={"name": "LogCmdTemplate", "description": "Template for commands log testing",
              "fields": {"hp": {"name": "HP", "description": "Health", "value": 100},
                         "mp": {"name": "MP", "description": "Mana", "value": 50}}},
        requirement=CREATED,
        is_valid=has_id()))

    # 5. Create character (admin)
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.2.id}/characters", method="POST",
        data={"name": "LogCmdChar", "description": "", "templateId": "{steps.4.id}"},
        requirement=CREATED,
        is_valid=has_id()))

    # 6. Grant write access
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.2.id}/characters/{steps.5.id}/users/{uid}", method="PUT",
        data={"canWrite": True}, requirement=CREATED))

    # 7. AddField command (admin)
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.2.id}/characters/{steps.5.id}/commands", method="POST",
        data={"type": "AddField", "payload": {"key": "agility", "field": {"name": "Agility", "description": "Agility stat", "value": 5}}},
        requirement=OK))

    # 8. GET log → AddField
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.2.id}/characters/{steps.5.id}/log", method="GET", requirement=OK,
        is_valid=lambda test, res, data=data: (
            any(e["actionType"] == "AddField" and e["details"]["key"] == "agility" and e["details"]["oldValue"] == 0 and e["details"]["delta"] == 5
                for e in res.json().get("entries", [])),
            f"Expected AddField entries, got {res.json()}")))

    # 9. UpdateField command (user)
    tests.append(Test(headers={**h, "Authorization": "{ut}"},
        request="groups/{steps.2.id}/characters/{steps.5.id}/commands", method="POST",
        data={"type": "UpdateField", "payload": {"key": "agility", "field": {"name": "Agility", "description": "Agility stat", "value": 8}}},
        requirement=OK))

    # 10. GET log → UpdateField with actorId
    tests.append(Test(headers={**h, "Authorization": "{ut}"},
        request="groups/{steps.2.id}/characters/{steps.5.id}/log", method="GET", requirement=OK,
        is_valid=lambda test, res, data=data: (
            any(e["actionType"] == "UpdateField" and e["details"]["key"] == "agility" and e["details"]["oldValue"] == 5 and e["details"]["delta"] == 3 and e["actorId"] == data["uid"]
                for e in res.json().get("entries", [])),
            f"Expected UpdateField with actorId={data['uid']}, got {res.json()}")))

    # 11. DeleteField command (admin)
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.2.id}/characters/{steps.5.id}/commands", method="POST",
        data={"type": "DeleteField", "payload": {"key": "agility"}},
        requirement=OK))

    # 12. GET log → DeleteField
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.2.id}/characters/{steps.5.id}/log", method="GET", requirement=OK,
        is_valid=lambda test, res, data=data: (
            any(e["actionType"] == "DeleteField" and e["details"]["key"] == "agility" and e["details"]["oldValue"] == 8 and e["details"]["delta"] == -8
                for e in res.json().get("entries", [])),
            f"Expected DeleteField entries, got {res.json()}")))

    # 13. Create item (admin)
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.2.id}/items", method="POST",
        data={"name": "Iron Shield", "description": "A sturdy shield"},
        requirement=CREATED,
        is_valid=has_id()))

    # 14. EquipItem command (admin)
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.2.id}/characters/{steps.5.id}/commands", method="POST",
        data={"type": "EquipItem", "payload": {"itemId": "{steps.13.id}"}},
        requirement=OK))

    # 15. GET log → EquipItem
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.2.id}/characters/{steps.5.id}/log", method="GET", requirement=OK,
        is_valid=lambda test, res, data=data: (
            any(int(e["details"]["itemId"]) == int(data["steps"][13]["id"]) and e["actionType"] == "EquipItem" and e["details"]["oldValue"] == 0 and e["details"]["delta"] == 1
                for e in res.json().get("entries", [])),
            f"Expected EquipItem entry, got {res.json()}")))

    # 16. UnequipItem command (admin)
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.2.id}/characters/{steps.5.id}/commands", method="POST",
        data={"type": "UnequipItem", "payload": {"itemId": "{steps.13.id}"}},
        requirement=OK))

    # 17. GET log → UnequipItem
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.2.id}/characters/{steps.5.id}/log", method="GET", requirement=OK,
        is_valid=lambda test, res, data=data: (
            any(int(e["details"]["itemId"]) == int(data["steps"][13]["id"]) and e["actionType"] == "UnequipItem" and e["details"]["oldValue"] == 1 and e["details"]["delta"] == -1
                for e in res.json().get("entries", [])),
            f"Expected UnequipItem entry, got {res.json()}")))

    steps = [GatewayStep(t) for t in tests]
    scenario = Scenario("CharacterLogCommands", steps, data)
    scenarios.append(scenario)
