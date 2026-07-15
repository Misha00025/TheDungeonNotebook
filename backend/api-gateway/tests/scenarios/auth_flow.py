from tests.templates import Test, Scenario, GatewayStep
from tests.test_variables import *
import random

h = {"Content-Type": "application/json; charset=utf-8"}

scenarios: list[Scenario] = []


def register_auth_flow_scenario():
    username = f"auth_test_{random.randint(10000, 99999)}"
    password = "testpass123"

    data = {
        "username": username,
        "password": password,
    }

    tests = []

    # Register
    tests.append(Test(headers=h,
        request="auth/register", method="POST",
        data={"username": "{username}", "password": "{password}"},
        requirement=CREATED))

    # Login with correct credentials via /auth/token (OAuth 2.0)
    tests.append(Test(headers=h,
        request="auth/token", method="POST",
        data={"grant_type": "password", "username": "{username}", "password": "{password}"},
        requirement=OK))

    # Login with wrong password -> 401
    tests.append(Test(headers=h,
        request="auth/token", method="POST",
        data={"grant_type": "password", "username": "{username}", "password": "wrongpass"},
        requirement=NOT_AUTH))

    # Login with wrong username -> 401
    tests.append(Test(headers=h,
        request="auth/token", method="POST",
        data={"grant_type": "password", "username": "nonexistent", "password": "whatever"},
        requirement=NOT_AUTH))

    # Check token from login -> 200
    tests.append(Test(headers={**h, "Authorization": "Bearer {steps.1.access_token}"},
        request="auth/check", method="GET",
        requirement=OK))

    # Check with invalid token -> 401
    tests.append(Test(headers={**h, "Authorization": "Bearer invalid.token.here"},
        request="auth/check", method="GET",
        requirement=NOT_AUTH))

    # Refresh token -> 200
    tests.append(Test(headers=h,
        request="auth/token", method="POST",
        data={"grant_type": "refresh_token", "refresh_token": "{steps.1.access_token}"},
        requirement=OK))

    # Register duplicate username -> 409
    tests.append(Test(headers=h,
        request="auth/register", method="POST",
        data={"username": "{username}", "password": "{password}"},
        requirement=CONFLICT))

    steps = [GatewayStep(t) for t in tests]
    scenario = Scenario("AuthFlow", steps, data)
    scenarios.append(scenario)


def create_auth_flow_scenario():
    return scenarios
