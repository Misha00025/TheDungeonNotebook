from tests.templates import Test, Scenario, GatewayStep
from tests.test_variables import *
from .auth_helper import register_or_auth

h = {"Content-Type": "application/json; charset=utf-8"}
scenarios: list[Scenario] = []


def register_group_items_scenario():
    admin = register_or_auth("items_admin", "Pass123")
    user = register_or_auth("items_user", "Pass456")

    data = {
        "at": admin["accessToken"],
        "aid": admin["id"],
        "ut": user["accessToken"],
        "uid": user["id"],
    }

    tests = []

    # 0. Create group (admin)
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups", method="POST",
        data={"name": "ItemsGroup", "description": "For items"}, requirement=CREATED))

    # Add user to group
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.0.id}/users/{uid}", method="PUT",
        data={"isAdmin": False}, requirement=CREATED))

    # 1. POST /groups/{id}/items (admin) → 201
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.0.id}/items", method="POST",
        data={"name": "Sword", "description": "A sharp blade", "price": 10}, requirement=CREATED))

    # 2. GET /groups/{id}/items (admin) → 200
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.0.id}/items", method="GET", requirement=OK))

    # 3. GET /groups/{id}/items/{itemId} (admin) → 200
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.0.id}/items/{steps.2.id}", method="GET", requirement=OK))

    # 4. PUT /groups/{id}/items/{itemId} (admin, edit price) → 200
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.0.id}/items/{steps.2.id}", method="PUT",
        data={"name": "Sword", "price": 15}, requirement=OK))

    # 5. DELETE /groups/{id}/items/{itemId} (admin) → 200
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.0.id}/items/{steps.2.id}", method="DELETE", requirement=OK))

    # 6. GET /groups/{id}/items/{itemId} (after delete) → 404
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.0.id}/items/{steps.2.id}", method="GET", requirement=NOT_FOUND))

    # 7. POST /groups/{id}/items (user, not admin) → 403
    tests.append(Test(headers={**h, "Authorization": "{ut}"},
        request="groups/{steps.0.id}/items", method="POST",
        data={"name": "Stolen", "price": 999}, requirement=FORBID))

    # 8. PUT /groups/{id}/items/{itemId} (user, not admin) → 403
    tests.append(Test(headers={**h, "Authorization": "{ut}"},
        request="groups/{steps.0.id}/items/1", method="PUT",
        data={"name": "Stolen", "price": 999}, requirement=FORBID))

    steps = [GatewayStep(t) for t in tests]
    scenario = Scenario("GroupItemsLifecycle", steps, data)
    scenarios.append(scenario)
