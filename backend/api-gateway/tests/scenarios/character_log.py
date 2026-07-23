from tests.templates import Test, Scenario, GatewayStep
from tests.test_variables import *
from .jwt_helper import generate_token

h = {"Content-Type": "application/json; charset=utf-8"}
scenarios: list[Scenario] = []


def register_character_log_scenario():
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
        data={"firstName": "Admin", "lastName": "User", "nickname": "log_admin"}, requirement=CREATED))

    # 1. Create regular user
    tests.append(Test(headers={**h, "Authorization": "{ut}"},
        request="users", method="POST",
        data={"firstName": "Regular", "lastName": "User", "nickname": "log_user"}, requirement=CREATED))

    # 2. Create group
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups", method="POST",
        data={"name": "LogTestGroup"}, requirement=CREATED))

    # 3. Add user to group
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.2.id}/users/{uid}", method="PUT",
        data={"isAdmin": False}, requirement=CREATED))

    # 4. Create template with field
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.2.id}/characters/templates", method="POST",
        data={
            "name": "LogTestTemplate",
            "description": "Template for log testing",
            "fields": {
                "hp": {"name": "HP", "description": "Health points", "value": 100},
                "mp": {"name": "MP", "description": "Mana points", "value": 50}
            }
        }, requirement=CREATED))

    # 5. Create character (admin)
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.2.id}/characters", method="POST",
        data={"name": "LogTestChar", "description": "", "templateId": "{steps.4.id}"},
        requirement=CREATED))

    # 6. Give user write access to character
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.2.id}/characters/{steps.5.id}/users/{uid}", method="PUT",
        data={"canWrite": True}, requirement=CREATED))

    # --- field_change test ---

    # 7. PATCH character field (user reduces HP by 10)
    tests.append(Test(headers={**h, "Authorization": "{ut}"},
        request="groups/{steps.2.id}/characters/{steps.5.id}", method="PATCH",
        data={"fields": {"hp": {"value": 90}}}, requirement=OK,
        is_valid=lambda test, res: (
            res.json().get("fields", {}).get("hp", {}).get("value") == 90,
            f"Expected hp=90, got {res.json().get('fields', {}).get('hp', {})}"
        )))

    # 8. GET log — should have field_change entry with delta=90 (field created from template)
    tests.append(Test(headers={**h, "Authorization": "{ut}"},
        request="groups/{steps.2.id}/characters/{steps.5.id}/log", method="GET",
        requirement=OK,
        is_valid=lambda test, res: (
            len(res.json().get("entries", [])) >= 1 and
            res.json()["entries"][0]["actionType"] == "field_change" and
            res.json()["entries"][0]["details"]["key"] == "hp" and
            res.json()["entries"][0]["details"]["oldValue"] == 100 and
            res.json()["entries"][0]["details"]["delta"] == -10,
            f"Expected field_change hp: old=100, delta=-10, got {res.json()}"
        )))

    # 9. PATCH character field (admin increases MP by 20)
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.2.id}/characters/{steps.5.id}", method="PATCH",
        data={"fields": {"mp": {"value": 70}}}, requirement=OK,
        is_valid=lambda test, res: (
            res.json().get("fields", {}).get("mp", {}).get("value") == 70,
            f"Expected mp=70, got {res.json().get('fields', {}).get('mp', {})}"
        )))

    # 10. GET log — second field_change should be mp with delta=70
    tests.append(Test(headers={**h, "Authorization": "{ut}"},
        request="groups/{steps.2.id}/characters/{steps.5.id}/log", method="GET",
        requirement=OK,
        is_valid=lambda test, res: (
            len(res.json().get("entries", [])) >= 2 and
            res.json()["entries"][0]["actionType"] == "field_change" and
            res.json()["entries"][0]["details"]["key"] == "mp" and
            res.json()["entries"][0]["details"]["oldValue"] == 50 and
            res.json()["entries"][0]["details"]["delta"] == 20,
            f"Expected field_change mp: old=50, delta=20 at entries[0], got {res.json()}"
        )))

    # --- item_change test ---

    # 11. POST item to character (user adds 5 potions)
    tests.append(Test(headers={**h, "Authorization": "{ut}"},
        request="groups/{steps.2.id}/characters/{steps.5.id}/items", method="POST",
        data={"name": "Health Potion", "description": "Restores HP", "amount": 5},
        requirement=CREATED))

    # 12. GET log — should have item_change entry with delta=5
    tests.append(Test(headers={**h, "Authorization": "{ut}"},
        request="groups/{steps.2.id}/characters/{steps.5.id}/log", method="GET",
        requirement=OK,
        is_valid=lambda test, res: (
            any(
                e["actionType"] == "item_change" and
                e["details"]["oldValue"] == 0 and
                e["details"]["delta"] == 5
                for e in res.json().get("entries", [])
            ),
            f"Expected item_change entry with old=0, delta=5, got {res.json()}"
        )))

    # --- skill_change test ---

    # 13. Create a skill in group first
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.2.id}/skills", method="POST",
        data={"name": "Stealth", "description": "Move silently"},
        requirement=CREATED))

    # 14. PUT skill to character (add skill)
    tests.append(Test(headers={**h, "Authorization": "{ut}"},
        request="groups/{steps.2.id}/characters/{steps.5.id}/skills/{steps.13.id}", method="PUT",
        requirement=OK))

    # 15. GET log — should have skill_change entry with delta=1
    tests.append(Test(headers={**h, "Authorization": "{ut}"},
        request="groups/{steps.2.id}/characters/{steps.5.id}/log", method="GET",
        requirement=OK,
        is_valid=lambda test, res: (
            any(
                e["actionType"] == "skill_change" and
                e["details"]["oldValue"] == 0 and
                e["details"]["delta"] == 1
                for e in res.json().get("entries", [])
            ),
            f"Expected skill_change entry with old=0, delta=1, got {res.json()}"
        )))

    # --- equipment_change test ---

    # 16. POST a group item to use as equipment
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.2.id}/items", method="POST",
        data={"name": "Iron Shield", "description": "A sturdy shield"},
        requirement=CREATED))

    # 17. PATCH equipment (add item to equipment)
    tests.append(Test(headers={**h, "Authorization": "{ut}"},
        request="groups/{steps.2.id}/characters/{steps.5.id}/equipment", method="PATCH",
        data={"action": "add", "itemId": "{steps.16.id}"},
        requirement=OK))

    # 18. GET log — should have equipment_change entry with delta=1
    tests.append(Test(headers={**h, "Authorization": "{ut}"},
        request="groups/{steps.2.id}/characters/{steps.5.id}/log", method="GET",
        requirement=OK,
        is_valid=lambda test, res: (
            any(
                e["actionType"] == "equipment_change" and
                e["details"]["oldValue"] == 0 and
                e["details"]["delta"] == 1
                for e in res.json().get("entries", [])
            ),
            f"Expected equipment_change entry with old=0, delta=1, got {res.json()}"
        )))

    # --- Remove equipment test ---

    # 19. PATCH equipment (remove item)
    tests.append(Test(headers={**h, "Authorization": "{ut}"},
        request="groups/{steps.2.id}/characters/{steps.5.id}/equipment", method="PATCH",
        data={"action": "remove", "itemId": "{steps.16.id}"},
        requirement=OK))

    # 20. GET log — should have equipment_change entry with delta=-1
    tests.append(Test(headers={**h, "Authorization": "{ut}"},
        request="groups/{steps.2.id}/characters/{steps.5.id}/log", method="GET",
        requirement=OK,
        is_valid=lambda test, res: (
            any(
                e["actionType"] == "equipment_change" and
                e["details"]["oldValue"] == 1 and
                e["details"]["delta"] == -1
                for e in res.json().get("entries", [])
            ),
            f"Expected equipment_change entry with old=1, delta=-1, got {res.json()}"
        )))

    # --- Access control: random user can't see log ---

    # 21. GET log without access → 403
    stranger_id = 20003
    stranger_token, stranger_id = generate_token()
    data["st"] = stranger_token

    tests.append(Test(headers={**h, "Authorization": "{st}"},
        request="groups/{steps.2.id}/characters/{steps.5.id}/log", method="GET",
        requirement=FORBID))

    steps = [GatewayStep(t) for t in tests]
    scenario = Scenario("CharacterLog", steps, data)
    scenarios.append(scenario)
