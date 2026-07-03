from tests.templates import Test, Scenario, GatewayStep
from tests.test_variables import *

h = {"Content-Type": "application/json; charset=utf-8"}
scenarios: list[Scenario] = []


def register_local_endpoints_scenario():
    tests = []

    # 0. Register user
    tests.append(Test(headers=h, request="auth/register", method="POST",
        data={"username": "local_tester", "password": "Pass123"}, requirement=CREATED))

    # 1. Login
    tests.append(Test(headers=h, request="auth/login", method="POST",
        data={"username": "local_tester", "password": "Pass123"}, requirement=OK))

    # 2. Refresh to get accessToken
    tests.append(Test(headers={**h, "Refresh-Token": "{steps.1.token}"},
        request="auth/refresh", method="POST", requirement=OK))

    # 3. GET /get_api (no auth) → 200
    tests.append(Test(headers=h, request="get_api", method="GET", requirement=OK))

    # 4. GET /whoami (with auth) → 200
    tests.append(Test(headers={**h, "Authorization": "{steps.2.accessToken}"},
        request="whoami", method="GET", requirement=OK))

    # 5. GET /whoami (no auth) → 401
    tests.append(Test(headers=h, request="whoami", method="GET", requirement=NOT_AUTH))

    steps = [GatewayStep(t) for t in tests]
    scenario = Scenario("LocalEndpoints", steps)
    scenarios.append(scenario)
