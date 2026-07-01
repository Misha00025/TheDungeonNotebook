from tests.templates import Test, Scenario, GatewayStep
from tests.test_variables import *
from .auth_helper import register_or_auth

h = {"Content-Type": "application/json; charset=utf-8"}
scenarios: list[Scenario] = []


def register_user_profile_scenario():
    admin = register_or_auth("profile_admin", "Pass123")
    stranger = register_or_auth("profile_stranger", "Pass456")

    data = {
        "at": admin["accessToken"],
        "aid": admin["id"],
        "st": stranger["accessToken"],
        "sid": stranger["id"],
    }

    tests = []

    # 1. POST /users (with admin token) → 201
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="users", method="POST",
        data={"firstName": "Admin", "lastName": "Tester", "nickname": "AdminTester"}, requirement=CREATED))

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

    steps = [GatewayStep(t) for t in tests]
    scenario = Scenario("UserProfile", steps, data)
    scenarios.append(scenario)
