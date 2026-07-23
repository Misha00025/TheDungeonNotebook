from tests.templates import Test, Scenario, GatewayStep
from tests.test_variables import *
from .jwt_helper import generate_token

h = {"Content-Type": "application/json; charset=utf-8"}
scenarios: list[Scenario] = []


def register_local_endpoints_scenario():
    token, user_id = generate_token()

    data = {
        "at": token,
        "aid": user_id,
    }

    tests = []

    # Create user
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="users", method="POST",
        data={"firstName": "Local", "lastName": "Tester", "nickname": "local_tester"}, requirement=CREATED))

    # GET /get_api (no auth) → 200
    tests.append(Test(headers=h, request="get_api", method="GET", requirement=OK))

    # GET /whoami (with auth) → 200
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="whoami", method="GET", requirement=OK))

    # GET /whoami (no auth) → 401
    tests.append(Test(headers=h, request="whoami", method="GET", requirement=NOT_AUTH))

    steps = [GatewayStep(t) for t in tests]
    scenario = Scenario("LocalEndpoints", steps, data)
    scenarios.append(scenario)
