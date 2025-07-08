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

        Test(request="auth/check?accessToken={steps.3.token}", method="GET", requirement=OK),
        Test(request="auth/check?accessToken={steps.5.accessToken}", method="GET", requirement=OK),

        Test(request="auth/groups/1/service-token/generate", method="POST", data={"access":3, "years":5}, requirement=OK),
        Test(request="auth/check?accessToken={steps.-1.token}", method="GET", requirement=OK),

        # Test(request="auth/logout", method="DELETE", requirement=OK),
        # Test(request="auth/logout", method="DELETE", requirement=NOT_AUTH),
    ])

    create_scenario("Auth Service Scenarios", tests)
