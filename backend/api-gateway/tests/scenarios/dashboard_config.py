from tests.templates import Test, Scenario, GatewayStep
from tests.test_variables import *
from .jwt_helper import generate_token

h = {"Content-Type": "application/json; charset=utf-8"}
scenarios: list[Scenario] = []


def register_dashboard_config_scenario():
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
        data={"firstName": "Admin", "lastName": "User", "nickname": "dash_admin"}, requirement=CREATED))

    # 1. Create regular user
    tests.append(Test(headers={**h, "Authorization": "{ut}"},
        request="users", method="POST",
        data={"firstName": "Regular", "lastName": "User", "nickname": "dash_user"}, requirement=CREATED))

    # 2. Create group
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups", method="POST",
        data={"name": "DashGroup", "description": "For dashboard config testing"}, requirement=CREATED))

    # 3. Add user to group
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.2.id}/users/{uid}", method="PUT",
        data={"isAdmin": False}, requirement=CREATED))

    schema_fields = ["hp", "mana", "gold"]

    # 4. PUT /groups/{id}/schemas/characters/resources (admin) → 200
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.2.id}/schemas/characters/resources", method="PUT",
        data={"fields": schema_fields}, requirement=OK))

    # 5. GET /groups/{id}/schemas/characters/resources → 200, check fields
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.2.id}/schemas/characters/resources", method="GET", requirement=OK,
        is_valid=lambda test, res: (res.json().get("fields") == schema_fields, f"Expected fields={schema_fields}, got {res.json().get('fields')}")))

    # 6. PUT /groups/{id}/schemas/characters/resources (user, not admin) → 403
    tests.append(Test(headers={**h, "Authorization": "{ut}"},
        request="groups/{steps.2.id}/schemas/characters/resources", method="PUT",
        data={"fields": schema_fields}, requirement=FORBID))

    # 7. Create template
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.2.id}/characters/templates", method="POST",
        data={"name": "Hero", "description": "Template for dash test",
              "fields": {"str": {"name": "Strength", "description": "", "value": 10}}},
        requirement=CREATED))

    # 8. Create character
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.2.id}/characters", method="POST",
        data={"name": "DashChar", "description": "", "templateId": "{steps.7.id}"},
        requirement=CREATED))

    # 9. Give user write access to character
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.2.id}/characters/{steps.8.id}/users/{uid}", method="PUT",
        data={"canWrite": True}, requirement=CREATED))

    # 10. GET equipment (empty) → 200, items = []
    tests.append(Test(headers={**h, "Authorization": "{ut}"},
        request="groups/{steps.2.id}/characters/{steps.8.id}/equipment", method="GET", requirement=OK,
        is_valid=lambda test, res: (res.json().get("items") == [], f"Expected empty items, got {res.json().get('items')}")))

    # 11. PATCH equipment add → 200
    tests.append(Test(headers={**h, "Authorization": "{ut}"},
        request="groups/{steps.2.id}/characters/{steps.8.id}/equipment", method="PATCH",
        data={"action": "add", "itemId": 42}, requirement=OK))

    # 12. GET equipment → 200, contains 42
    tests.append(Test(headers={**h, "Authorization": "{ut}"},
        request="groups/{steps.2.id}/characters/{steps.8.id}/equipment", method="GET", requirement=OK,
        is_valid=lambda test, res: (42 in res.json().get("items", []), f"Expected items to contain 42, got {res.json().get('items')}")))

    # 13. PATCH equipment remove → 200
    tests.append(Test(headers={**h, "Authorization": "{ut}"},
        request="groups/{steps.2.id}/characters/{steps.8.id}/equipment", method="PATCH",
        data={"action": "remove", "itemId": 42}, requirement=OK))

    # 14. GET equipment → 200, empty again
    tests.append(Test(headers={**h, "Authorization": "{ut}"},
        request="groups/{steps.2.id}/characters/{steps.8.id}/equipment", method="GET", requirement=OK,
        is_valid=lambda test, res: (res.json().get("items") == [], f"Expected empty items after remove, got {res.json().get('items')}")))

    # 15. PUT equipment (full replace) → 200
    tests.append(Test(headers={**h, "Authorization": "{ut}"},
        request="groups/{steps.2.id}/characters/{steps.8.id}/equipment", method="PUT",
        data={"itemIds": [7, 3, 5]}, requirement=OK))

    # 16. GET equipment → 200, contains [7, 3, 5]
    tests.append(Test(headers={**h, "Authorization": "{ut}"},
        request="groups/{steps.2.id}/characters/{steps.8.id}/equipment", method="GET", requirement=OK,
        is_valid=lambda test, res: (res.json().get("items") == [7, 3, 5], f"Expected [7,3,5], got {res.json().get('items')}")))

    # 17. PUT equipment (admin, as admin) → 200
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.2.id}/characters/{steps.8.id}/equipment", method="PUT",
        data={"itemIds": []}, requirement=OK))

    # 18. GET equipment (user, check cleared) → 200, items = []
    tests.append(Test(headers={**h, "Authorization": "{ut}"},
        request="groups/{steps.2.id}/characters/{steps.8.id}/equipment", method="GET", requirement=OK,
        is_valid=lambda test, res: (res.json().get("items") == [], f"Expected empty items after admin clear, got {res.json().get('items')}")))

    steps = [GatewayStep(t) for t in tests]
    scenario = Scenario("DashboardConfig", steps, data)
    scenarios.append(scenario)
