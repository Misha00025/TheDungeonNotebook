from tests.templates import Test, Scenario, GatewayStep
from tests.test_variables import *
from tests.validators import has_id, is_error, has_list_empty
from .jwt_helper import generate_token

h = {"Content-Type": "application/json; charset=utf-8"}
scenarios: list[Scenario] = []


def register_character_equipment_commands_scenario():
    admin_token, admin_id = generate_token()
    user_token, user_id = generate_token()

    data = {"at": admin_token, "aid": admin_id, "ut": user_token, "uid": user_id}

    tests = []

    # 0. Create admin user
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="users", method="POST",
        data={"firstName": "Admin", "lastName": "User", "nickname": "equip_admin"}, requirement=CREATED,
        is_valid=has_id()))

    # 1. Create regular user
    tests.append(Test(headers={**h, "Authorization": "{ut}"},
        request="users", method="POST",
        data={"firstName": "Regular", "lastName": "User", "nickname": "equip_user"}, requirement=CREATED,
        is_valid=has_id()))

    # 2. Create group
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups", method="POST",
        data={"name": "EquipGroup"}, requirement=CREATED,
        is_valid=has_id()))

    # 3. Add user to group (not admin)
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.2.id}/users/{uid}", method="PUT",
        data={"isAdmin": False}, requirement=CREATED))

    # 4. Create template (with a field so characters have at least one field)
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.2.id}/characters/templates", method="POST",
        data={"name": "EquipTemplate", "description": "Equipment commands test",
              "fields": {"hp": {"name": "HP", "description": "Health points", "value": 100}}},
        requirement=CREATED,
        is_valid=has_id()))

    # 5. Create char_w (admin, will grant user canWrite=True)
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.2.id}/characters", method="POST",
        data={"name": "EquipWritable", "description": "", "templateId": "{steps.4.id}"},
        requirement=CREATED,
        is_valid=has_id()))

    # 6. Grant write access to user on char_w (steps.5)
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.2.id}/characters/{steps.5.id}/users/{uid}", method="PUT",
        data={"canWrite": True}, requirement=CREATED))

    # 7. Create char_r (admin, will set user canWrite=False)
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.2.id}/characters", method="POST",
        data={"name": "EquipReadOnly", "description": "", "templateId": "{steps.4.id}"},
        requirement=CREATED,
        is_valid=has_id()))

    # 8. Set read-only access to user on char_r (steps.7)
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.2.id}/characters/{steps.7.id}/users/{uid}", method="PUT",
        data={"canWrite": False}, requirement=CREATED))

    # 9. Create a real group item → store item_id in data for later use
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.2.id}/items", method="POST",
        data={"name": "Iron Shield", "description": "A sturdy shield for testing"},
        requirement=CREATED))

    # 10. EquipItem item_id (admin) on char_w (steps.5) → 200
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.2.id}/characters/{steps.5.id}/commands", method="POST",
        data={"type": "EquipItem", "payload": {"itemId": "{steps.9.id}"}},
        requirement=OK))

    # 10a. GET equipment for char_w → contains the equipped item_id
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.2.id}/characters/{steps.5.id}/equipment", method="GET", requirement=OK,
        is_valid=lambda test, res, data=data: (
            int(data["steps"][9]["id"]) in res.json().get("items", []),
            f"Equipment contains item_id={int(data['steps'][9]['id'])}")))

    # 11. EquipItem item_id again → 409 CONFLICT
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.2.id}/characters/{steps.5.id}/commands", method="POST",
        data={"type": "EquipItem", "payload": {"itemId": "{steps.9.id}"}},
        requirement=CONFLICT,
        is_valid=is_error()))

    # 12. EquipItem 99999 (non-existent item) → 404 NOT_FOUND
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.2.id}/characters/{steps.5.id}/commands", method="POST",
        data={"type": "EquipItem", "payload": {"itemId": 99999}},
        requirement=NOT_FOUND,
        is_valid=is_error()))

    # 13. UnequipItem item_id → 200
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.2.id}/characters/{steps.5.id}/commands", method="POST",
        data={"type": "UnequipItem", "payload": {"itemId": "{steps.9.id}"}},
        requirement=OK))

    # 13a. GET equipment for char_w → empty
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.2.id}/characters/{steps.5.id}/equipment", method="GET", requirement=OK,
        is_valid=has_list_empty("items")))

    # 14. UnequipItem item_id again (not equipped) → 400 BAD
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.2.id}/characters/{steps.5.id}/commands", method="POST",
        data={"type": "UnequipItem", "payload": {"itemId": "{steps.9.id}"}},
        requirement=BAD,
        is_valid=is_error()))

    # 15. EquipItem on char_r (canWrite=False) as user → 403 FORBIDDEN
    tests.append(Test(headers={**h, "Authorization": "{ut}"},
        request="groups/{steps.2.id}/characters/{steps.7.id}/commands", method="POST",
        data={"type": "EquipItem", "payload": {"itemId": "{steps.9.id}"}},
        requirement=FORBID,
        is_valid=is_error()))

    steps = [GatewayStep(t) for t in tests]
    scenario = Scenario("CharacterEquipmentCommands", steps, data)
    scenarios.append(scenario)
