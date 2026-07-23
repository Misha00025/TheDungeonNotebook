from tests.templates import Test, Scenario, GatewayStep
from tests.test_variables import *
from .jwt_helper import generate_token

h = {"Content-Type": "application/json; charset=utf-8"}
scenarios: list[Scenario] = []


def register_group_items_scenario():
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
        data={"firstName": "Admin", "lastName": "User", "nickname": "items_admin"}, requirement=CREATED))

    # 1. Create regular user
    tests.append(Test(headers={**h, "Authorization": "{ut}"},
        request="users", method="POST",
        data={"firstName": "Regular", "lastName": "User", "nickname": "items_user"}, requirement=CREATED))

    # 2. Create group (admin)
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups", method="POST",
        data={"name": "ItemsGroup", "description": "For items"}, requirement=CREATED))

    # 3. Add user to group
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.2.id}/users/{uid}", method="PUT",
        data={"isAdmin": False}, requirement=CREATED))

    # 4. POST /groups/{id}/items (admin) → 201
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.2.id}/items", method="POST",
        data={"name": "Sword", "description": "A sharp blade", "price": 10}, requirement=CREATED))

    # 5. GET /groups/{id}/items (admin) → 200
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.2.id}/items", method="GET", requirement=OK))

    # 6. GET /groups/{id}/items/{itemId} (admin) → 200
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.2.id}/items/{steps.4.id}", method="GET", requirement=OK))

    # 7. PUT /groups/{id}/items/{itemId} (admin, edit price) → 200
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.2.id}/items/{steps.4.id}", method="PUT",
        data={"name": "Sword", "description": "A sharp blade", "price": 15}, requirement=OK))

    # 8. DELETE /groups/{id}/items/{itemId} (admin) → 200
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.2.id}/items/{steps.4.id}", method="DELETE", requirement=OK))

    # 9. GET /groups/{id}/items/{itemId} (after delete) → 404
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.2.id}/items/{steps.4.id}", method="GET", requirement=NOT_FOUND))

    # 10. POST /groups/{id}/items (user, not admin) → 403
    tests.append(Test(headers={**h, "Authorization": "{ut}"},
        request="groups/{steps.2.id}/items", method="POST",
        data={"name": "Stolen", "price": 999}, requirement=FORBID))

    # 11. PUT /groups/{id}/items/{itemId} (user, not admin) → 403
    tests.append(Test(headers={**h, "Authorization": "{ut}"},
        request="groups/{steps.2.id}/items/1", method="PUT",
        data={"name": "Stolen", "price": 999}, requirement=FORBID))

    steps = [GatewayStep(t) for t in tests]
    scenario = Scenario("GroupItemsLifecycle", steps, data)
    scenarios.append(scenario)
