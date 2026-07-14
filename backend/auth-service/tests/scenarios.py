import json
from tests.tests_data import *
from tests.templates import Scenario, Step, Test, replace_placeholders
from tests.validation import *
from tests.test_variables import *
import tests.test_variables as tv

scenarios: list[Scenario] = []
h = headers_template


def to_steps(tests):
	steps = []
	for test in tests:
		steps.append(Step(test))
	return steps

def create_scenario(name, tests, data = None):
	steps = to_steps(tests)
	scenario = Scenario(name, steps, data)
	scenarios.append(scenario)


def with_auth_service_scenario():
    tests = []

    invalid_user_credentials = {"username": "invaliduser", "password": "wrongpass"}
    valid_registration_data = {"username": "newuser", "password": "securepassword"}
    valid_user_credentials = {"username": "newuser", "password": "securepassword"}
    missing_field_registration_data = {"username": "newuser"}
    duplicate_registration_data = valid_registration_data
    valid_refresh_token_request = {"refreshToken": "{steps.3.token}"}
    invalid_refresh_token_request = {"refreshToken": "invalid-refreshtoken"}

    tests.extend([
        Test(request="auth/register", method="POST", data=valid_registration_data, requirement=CREATED),
        Test(request="auth/register", method="POST", data=duplicate_registration_data, requirement=CONFLICT),
        Test(request="auth/register", method="POST", data=missing_field_registration_data, requirement=BAD),

        Test(request="auth/login", method="POST", data=valid_user_credentials, requirement=OK),
        Test(request="auth/login", method="POST", data=invalid_user_credentials, requirement=NOT_AUTH),

        Test(request="auth/token/refresh", method="POST", data=valid_refresh_token_request, requirement=OK),
        Test(request="auth/token/refresh", method="POST", data=invalid_refresh_token_request, requirement=NOT_AUTH),

        Test(request="auth/check", headers={**h, "Authorization": "Bearer {steps.3.token}"}, method="GET", requirement=OK),
        Test(request="auth/check", headers={**h, "Authorization": "Bearer {steps.5.token}"}, method="GET", requirement=OK),

        Test(request="auth/groups/1/service-token/generate", method="POST", data={"access":3, "years":5}, requirement=OK, internal=True),
        Test(request="auth/check", headers={**h, "Authorization": "Bearer {steps.-1.token}"}, method="GET", requirement=OK),

    ])

    # Reset-password tests
    reset_confirm_data = {"newPassword": "newsecurepassword"}
    tests.extend([
        Test(request="auth/reset-password/request/1", method="POST", data={}, requirement=OK, internal=True),
        Test(request="auth/reset-password/confirm", method="POST", params={"query": "{steps.11.query}"}, data=reset_confirm_data, requirement=OK),
        Test(request="auth/reset-password/confirm", method="POST", params={"query": "nonexistent"}, data={"newPassword": "newpass"}, requirement=NOT_FOUND),
        Test(request="auth/login", method="POST", data={"username": "newuser", "password": "newsecurepassword"}, requirement=OK),
        Test(request="auth/login", method="POST", data={"username": "newuser", "password": "securepassword"}, requirement=NOT_AUTH),
    ])

    # Test(request="auth/logout", method="DELETE", requirement=OK),
    # Test(request="auth/logout", method="DELETE", requirement=NOT_AUTH),

    create_scenario("Auth Service Scenarios", tests)


def with_oidc_scenario():
    tests = []

    # 1. OpenID Configuration
    tests.append(Test(
        request=".well-known/openid-configuration",
        method="GET",
        requirement=OK))

    # 2. JWKS
    tests.append(Test(
        request=".well-known/jwks.json",
        method="GET",
        requirement=OK))

    # 3. Userinfo without token → 401
    tests.append(Test(
        request="userinfo",
        method="GET",
        requirement=NOT_AUTH))

    # 4. Register + login → get token with OIDC claims
    reg_data = {"username": "oidcuser", "password": "oidcpass123"}
    login_data = {"username": "oidcuser", "password": "oidcpass123"}
    tests.append(Test(
        request="auth/register",
        method="POST",
        data=reg_data,
        requirement=CREATED))
    tests.append(Test(
        request="auth/login",
        method="POST",
        data=login_data,
        requirement=OK))

    # 5. Userinfo with valid token → should have sub + preferred_username
    tests.append(Test(
        request="userinfo",
        method="GET",
        headers={**h, "Authorization": "Bearer {steps.3.token}"},
        requirement=OK))

    # 6. Check token has sub claim
    tests.append(Test(
        request="auth/check",
        method="GET",
        headers={**h, "Authorization": "Bearer {steps.3.token}"},
        requirement=OK))

    create_scenario("OIDC Endpoints", tests)


def with_internal_endpoint_protection_scenario():
    tests = []

    # Сначала регистрируем пользователя через публичный порт (нормально)
    reg_data = {"username": "porttestuser", "password": "testpass123"}
    login_data = {"username": "porttestuser", "password": "testpass123"}

    tests.extend([
        Test(request="auth/register", method="POST", data=reg_data, requirement=CREATED),

        Test(request="auth/login", method="POST", data=login_data, requirement=OK),

        # /auth/check — доступен на обоих портах
        Test(request="auth/check", method="GET",
             headers={**h, "Authorization": "Bearer {steps.1.token}"},
             requirement=OK),
        Test(request="auth/check", method="GET",
             headers={**h, "Authorization": "Bearer {steps.1.token}"},
             requirement=OK, internal=True),

        # /auth/reset-password/request — internal-only: блокируется на public порту
        Test(request="auth/reset-password/request/1", method="POST",
             data={}, requirement=FORBID),

        # /auth/reset-password/request — работает на internal порту
        Test(request="auth/reset-password/request/1", method="POST",
             data={}, requirement=OK, internal=True),

        # /auth/groups/1/service-token/generate — internal-only
        Test(request="auth/groups/1/service-token/generate", method="POST",
             data={"access": 3, "years": 1}, requirement=FORBID),
        Test(request="auth/groups/1/service-token/generate", method="POST",
             data={"access": 3, "years": 1}, requirement=OK, internal=True),
    ])

    create_scenario("Internal Endpoint Protection", tests)
