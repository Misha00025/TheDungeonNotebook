from tests.templates import Test, Scenario, GatewayStep
from tests.test_variables import *
from tests.validators import has_id, is_error
from .jwt_helper import generate_token

h = {"Content-Type": "application/json; charset=utf-8"}
scenarios: list[Scenario] = []


def register_character_log_crud_scenario():
    admin_token, admin_id = generate_token()
    user_token, user_id = generate_token()

    data = {"at": admin_token, "aid": admin_id, "ut": user_token, "uid": user_id}

    tests = []

    # 0. Create admin user
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="users", method="POST",
        data={"firstName": "Admin", "lastName": "User", "nickname": "logcrud_admin"}, requirement=CREATED,
        is_valid=has_id()))

    # 1. Create regular user
    tests.append(Test(headers={**h, "Authorization": "{ut}"},
        request="users", method="POST",
        data={"firstName": "Regular", "lastName": "User", "nickname": "logcrud_user"}, requirement=CREATED,
        is_valid=has_id()))

    # 2. Create group
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups", method="POST",
        data={"name": "LogCrudGroup"}, requirement=CREATED,
        is_valid=has_id()))

    # 3. Add user to group (not admin)
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.2.id}/users/{uid}", method="PUT",
        data={"isAdmin": False}, requirement=CREATED))

    # 4. Create template
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.2.id}/characters/templates", method="POST",
        data={"name": "LogCrudTemplate", "description": "Template for CRUD log testing",
              "fields": {"hp": {"name": "HP", "description": "Health", "value": 100}}},
        requirement=CREATED,
        is_valid=has_id()))

    # 5. Create character (admin)
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.2.id}/characters", method="POST",
        data={"name": "LogCrudChar", "description": "", "templateId": "{steps.4.id}"},
        requirement=CREATED,
        is_valid=has_id()))

    # 6. Grant write access
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.2.id}/characters/{steps.5.id}/users/{uid}", method="PUT",
        data={"canWrite": True}, requirement=CREATED))

    # --- Items ---

    # 7. POST items (user)
    tests.append(Test(headers={**h, "Authorization": "{ut}"},
        request="groups/{steps.2.id}/characters/{steps.5.id}/items", method="POST",
        data={"name": "Health Potion", "description": "Restores HP", "amount": 5},
        requirement=CREATED,
        is_valid=has_id()))

    # 8. GET log → AddItem
    tests.append(Test(headers={**h, "Authorization": "{ut}"},
        request="groups/{steps.2.id}/characters/{steps.5.id}/log", method="GET", requirement=OK,
        is_valid=lambda test, res, data=data: (
            any(int(e["details"]["itemId"]) == int(data["steps"][7]["id"]) and e["actionType"] == "AddItem" and e["details"]["oldValue"] == 0 and e["details"]["delta"] == 5
                for e in res.json().get("entries", [])),
            f"Expected AddItem entry, got {res.json()}")))

    # 9. PUT items/{steps.7.id} (user)
    tests.append(Test(headers={**h, "Authorization": "{ut}"},
        request="groups/{steps.2.id}/characters/{steps.5.id}/items/{steps.7.id}", method="PUT",
        data={"name": "Health Potion", "description": "Restores HP", "amount": 10},
        requirement=OK))

    # 10. GET log → UpdateItem
    tests.append(Test(headers={**h, "Authorization": "{ut}"},
        request="groups/{steps.2.id}/characters/{steps.5.id}/log", method="GET", requirement=OK,
        is_valid=lambda test, res, data=data: (
            any(int(e["details"]["itemId"]) == int(data["steps"][7]["id"]) and e["actionType"] == "UpdateItem" and e["details"]["oldValue"] == 5 and e["details"]["delta"] == 5
                for e in res.json().get("entries", [])),
            f"Expected UpdateItem entry, got {res.json()}")))

    # 11. DELETE items/{steps.7.id} (user)
    tests.append(Test(headers={**h, "Authorization": "{ut}"},
        request="groups/{steps.2.id}/characters/{steps.5.id}/items/{steps.7.id}", method="DELETE",
        requirement=OK))

    # 12. GET log → RemoveItem
    tests.append(Test(headers={**h, "Authorization": "{ut}"},
        request="groups/{steps.2.id}/characters/{steps.5.id}/log", method="GET", requirement=OK,
        is_valid=lambda test, res, data=data: (
            any(int(e["details"]["itemId"]) == int(data["steps"][7]["id"]) and e["actionType"] == "RemoveItem" and e["details"]["oldValue"] == 10 and e["details"]["delta"] == -10
                for e in res.json().get("entries", [])),
            f"Expected RemoveItem entry, got {res.json()}")))

    # --- Skills ---

    # 13. Create a skill (admin)
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.2.id}/skills", method="POST",
        data={"name": "Stealth", "description": "Move silently"},
        requirement=CREATED,
        is_valid=has_id()))

    # 14. PUT skill to character (user)
    tests.append(Test(headers={**h, "Authorization": "{ut}"},
        request="groups/{steps.2.id}/characters/{steps.5.id}/skills/{steps.13.id}", method="PUT",
        requirement=OK))

    # 15. GET log → AddSkill
    tests.append(Test(headers={**h, "Authorization": "{ut}"},
        request="groups/{steps.2.id}/characters/{steps.5.id}/log", method="GET", requirement=OK,
        is_valid=lambda test, res, data=data: (
            any(int(e["details"]["skillId"]) == int(data["steps"][13]["id"]) and e["actionType"] == "AddSkill" and e["details"]["oldValue"] == 0 and e["details"]["delta"] == 1
                for e in res.json().get("entries", [])),
            f"Expected AddSkill entry, got {res.json()}")))

    # 16. DELETE skill (user)
    tests.append(Test(headers={**h, "Authorization": "{ut}"},
        request="groups/{steps.2.id}/characters/{steps.5.id}/skills/{steps.13.id}", method="DELETE",
        requirement=OK))

    # 17. GET log → RemoveSkill
    tests.append(Test(headers={**h, "Authorization": "{ut}"},
        request="groups/{steps.2.id}/characters/{steps.5.id}/log", method="GET", requirement=OK,
        is_valid=lambda test, res, data=data: (
            any(int(e["details"]["skillId"]) == int(data["steps"][13]["id"]) and e["actionType"] == "RemoveSkill" and e["details"]["oldValue"] == 1 and e["details"]["delta"] == -1
                for e in res.json().get("entries", [])),
            f"Expected RemoveSkill entry, got {res.json()}")))

    # --- Equipment ---

    # 18. Create group item (admin)
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.2.id}/items", method="POST",
        data={"name": "Iron Shield", "description": "A sturdy shield"},
        requirement=CREATED,
        is_valid=has_id()))

    # 19. PATCH equipment (user) → add
    tests.append(Test(headers={**h, "Authorization": "{ut}"},
        request="groups/{steps.2.id}/characters/{steps.5.id}/equipment", method="PATCH",
        data={"action": "add", "itemId": "{steps.18.id}"},
        requirement=OK))

    # 20. GET log → EquipItem
    tests.append(Test(headers={**h, "Authorization": "{ut}"},
        request="groups/{steps.2.id}/characters/{steps.5.id}/log", method="GET", requirement=OK,
        is_valid=lambda test, res, data=data: (
            any(int(e["details"]["itemId"]) == int(data["steps"][18]["id"]) and e["actionType"] == "EquipItem" and e["details"]["oldValue"] == 0 and e["details"]["delta"] == 1
                for e in res.json().get("entries", [])),
            f"Expected EquipItem entry, got {res.json()}")))

    # 21. PATCH equipment (user) → remove
    tests.append(Test(headers={**h, "Authorization": "{ut}"},
        request="groups/{steps.2.id}/characters/{steps.5.id}/equipment", method="PATCH",
        data={"action": "remove", "itemId": "{steps.18.id}"},
        requirement=OK))

    # 22. GET log → UnequipItem
    tests.append(Test(headers={**h, "Authorization": "{ut}"},
        request="groups/{steps.2.id}/characters/{steps.5.id}/log", method="GET", requirement=OK,
        is_valid=lambda test, res, data=data: (
            any(int(e["details"]["itemId"]) == int(data["steps"][18]["id"]) and e["actionType"] == "UnequipItem" and e["details"]["oldValue"] == 1 and e["details"]["delta"] == -1
                for e in res.json().get("entries", [])),
            f"Expected UnequipItem entry, got {res.json()}")))

    steps = [GatewayStep(t) for t in tests]
    scenario = Scenario("CharacterLogCrud", steps, data)
    scenarios.append(scenario)
