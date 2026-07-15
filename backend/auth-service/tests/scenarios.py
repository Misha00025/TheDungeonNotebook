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
    tests.extend([
        Test(request="register", method="POST", data=valid_registration_data, requirement=CREATED),
        Test(request="register", method="POST", data=duplicate_registration_data, requirement=CONFLICT),
        Test(request="register", method="POST", data=missing_field_registration_data, requirement=BAD),

        # Login via OIDC /token with grant_type=password (accepts JSON)
        Test(request="token", method="POST", data={"grant_type": "password", **valid_user_credentials}, requirement=OK),
        Test(request="token", method="POST", data={"grant_type": "password", **invalid_user_credentials}, requirement=NOT_AUTH),

        # Refresh via /token
        Test(request="token", method="POST", data={"grant_type": "refresh_token", "refresh_token": "{steps.3.access_token}"}, requirement=OK),
        Test(request="token", method="POST", data={"grant_type": "refresh_token", "refresh_token": "invalid-refreshtoken"}, requirement=NOT_AUTH),

        # Check token — use access_token from login (step 3)
        Test(request="check", headers={**h, "Authorization": "Bearer {steps.3.access_token}"}, method="GET", requirement=OK),
        # Check token — use access_token from refresh (step 5)
        Test(request="check", headers={**h, "Authorization": "Bearer {steps.5.access_token}"}, method="GET", requirement=OK),
    ])

    # Reset-password tests
    reset_confirm_data = {"newPassword": "newsecurepassword"}
    tests.extend([
        Test(request="reset-password/request/1", method="POST", data={}, requirement=OK, internal=True),
        Test(request="reset-password/confirm", method="POST", params={"query": "{steps.11.query}"}, data=reset_confirm_data, requirement=OK),
        Test(request="reset-password/confirm", method="POST", params={"query": "nonexistent"}, data={"newPassword": "newpass"}, requirement=NOT_FOUND),
        # Login again with new password via /token
        Test(request="token", method="POST", data={"grant_type": "password", "username": "newuser", "password": "newsecurepassword"}, requirement=OK),
        Test(request="token", method="POST", data={"grant_type": "password", "username": "newuser", "password": "securepassword"}, requirement=NOT_AUTH),
    ])

    create_scenario("Auth Service Scenarios", tests)


def with_internal_endpoint_protection_scenario():
    tests = []

    # Сначала регистрируем пользователя через публичный порт (нормально)
    reg_data = {"username": "porttestuser", "password": "testpass123"}
    login_data = {"username": "porttestuser", "password": "testpass123"}

    tests.extend([
        Test(request="register", method="POST", data=reg_data, requirement=CREATED),

        Test(request="token", method="POST", data={"grant_type": "password", **login_data}, requirement=OK),

        # /check — доступен на обоих портах
        Test(request="check", method="GET",
             headers={**h, "Authorization": "Bearer {steps.1.access_token}"},
             requirement=OK),
        Test(request="check", method="GET",
             headers={**h, "Authorization": "Bearer {steps.1.access_token}"},
             requirement=OK, internal=True),

        # /reset-password/request — internal-only: блокируется на public порту
        Test(request="reset-password/request/1", method="POST",
             data={}, requirement=FORBID),

        # /reset-password/request — работает на internal порту
        Test(request="reset-password/request/1", method="POST",
             data={}, requirement=OK, internal=True),
    ])

    create_scenario("Internal Endpoint Protection", tests)
