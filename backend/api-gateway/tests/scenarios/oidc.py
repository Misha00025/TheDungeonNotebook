"""
Тесты для OIDC-токенов через Gateway.
Gateway не проксирует /.well-known/* и /userinfo —
эти эндпоинты на auth-service.
Проверяем только что токены с OIDC-полями проходят
валидацию в gateway.
"""

from tests.templates import Test, Scenario, GatewayStep
from tests.test_variables import *
from .jwt_helper import generate_token

scenarios: list[Scenario] = []


def register_oidc_scenario():
    h = {"Content-Type": "application/json; charset=utf-8"}

    tests = []

    oidc_token = generate_token(user_id=42, oidc=True)
    tests.append(Test(
        headers={**h, "Authorization": f"Bearer {oidc_token}"},
        request="whoami",
        method="GET",
        requirement=OK))

    tests.append(Test(
        request="whoami",
        method="GET",
        requirement=NOT_AUTH))

    steps = [GatewayStep(t) for t in tests]
    scenario = Scenario("OidcEndpoints", steps)
    scenarios.append(scenario)
