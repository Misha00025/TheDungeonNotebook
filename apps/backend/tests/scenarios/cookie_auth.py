from tests.templates import Test, Scenario, GatewayStep
from tests.test_variables import *
from tests.validators import has_keys, is_error


scenarios: list[Scenario] = []


def register_cookie_auth_scenario():
    data = {
        "username": "cookie_test",
        "password": "testpass123",
    }

    tests = []

    # Register
    tests.append(Test(headers={"Content-Type": "application/json; charset=utf-8"},
        request="auth/register", method="POST",
        data={"username": "{username}", "password": "{password}"},
        requirement=CREATED,
        is_valid=has_keys("id")))

    # Login
    tests.append(Test(headers={"Content-Type": "application/json; charset=utf-8"},
        request="auth/token", method="POST",
        data={"grant_type": "password", "username": "{username}", "password": "{password}"},
        requirement=OK,
        is_valid=has_keys("access_token", "refresh_token")))

    # Check with Authorization Bearer — /whoami should work
    tests.append(Test(headers={"Content-Type": "application/json; charset=utf-8", "Authorization": "Bearer {steps.1.access_token}"},
        request="whoami", method="GET",
        requirement=OK,
        is_valid=has_keys("id", "type")))

    # Check with access_token in cookie (no Authorization header)
    tests.append(Test(headers={"Content-Type": "application/json; charset=utf-8"},
        cookies={"access_token": "{steps.1.access_token}"},
        request="whoami", method="GET",
        requirement=OK,
        is_valid=has_keys("id", "type")))

    # Check that invalid cookie token -> 401
    tests.append(Test(headers={"Content-Type": "application/json; charset=utf-8"},
        cookies={"access_token": "invalid.jwt.token"},
        request="whoami", method="GET",
        requirement=NOT_AUTH,
        is_valid=is_error()))

    steps = [GatewayStep(t) for t in tests]
    scenario = Scenario("CookieAuth", steps, data)
    scenarios.append(scenario)


def create_cookie_auth_scenario():
    return scenarios
