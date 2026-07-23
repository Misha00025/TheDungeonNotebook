from tests.templates import Test, Scenario, GatewayStep
from tests.test_variables import *
from .jwt_helper import generate_token

h = {"Content-Type": "application/json; charset=utf-8"}
scenarios: list[Scenario] = []


def register_user_profile_scenario():
    admin_token, admin_id = generate_token()
    stranger_token, stranger_id = generate_token()

    data = {
        "at": admin_token,
        "aid": admin_id,
        "st": stranger_token,
        "sid": stranger_id,
    }

    tests = []

    # 0. POST /users (admin) → 201
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="users", method="POST",
        data={"firstName": "Admin", "lastName": "Tester", "nickname": "profile_admin"}, requirement=CREATED))

    # 1. POST /users (stranger) → 201
    tests.append(Test(headers={**h, "Authorization": "{st}"},
        request="users", method="POST",
        data={"firstName": "Stranger", "lastName": "Tester", "nickname": "profile_stranger"}, requirement=CREATED))

    # 2. GET /users/{aid} (own profile) → 200
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="users/{aid}", method="GET", requirement=OK))

    # 3. PATCH /users/{aid} (own, firstName) → 200
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="users/{aid}", method="PATCH",
        data={"firstName": "UpdatedAdmin", "visibleName": "UpdatedAdmin"}, requirement=OK))

    # 4. GET /users/{aid} verify name changed → 200
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="users/{aid}", method="GET", requirement=OK))

    # 5. PATCH /users/{aid} (stranger token) → 403
    tests.append(Test(headers={**h, "Authorization": "{st}"},
        request="users/{aid}", method="PATCH",
        data={"firstName": "Hacked"}, requirement=FORBID))

    # 6. POST /users (no token) → 401
    tests.append(Test(headers=h, request="users", method="POST",
        data={"firstName": "NoAuth", "lastName": "User"}, requirement=NOT_AUTH))

    # 7. GET /users (no token) → 200
    tests.append(Test(headers=h, request="users", method="GET", requirement=OK))

    # 8. GET /users (with token) → 200
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="users", method="GET", requirement=OK))

    steps = [GatewayStep(t) for t in tests]
    scenario = Scenario("UserProfile", steps, data)
    scenarios.append(scenario)
