import json
from .tests_data import *
from .templates import Scenario, Step, Test, replace_placeholders
from .validation import *
from .test_variables import *
from . import test_variables as tv

scenarios: list[Scenario] = []

def to_steps(tests):
	steps = []
	for test in tests:
		steps.append(Step(test))
	return steps

def create_scenario(name, tests, data = None):
	steps = to_steps(tests)
	scenario = Scenario(name, steps, data)
	scenarios.append(scenario)


def with_user_scenario():
	tests = []
	h = headers_template
	new_user = {"firstName": "Test", "lastName":"LastTest"}
	tests.extend([
        Test(headers=h, request=f"users"),
        Test(headers=h, request=f"users/{10}", requirement=NOT_FOUND),
        Test(headers=h, request=f"users", method="POST", data=new_user, requirement=CREATED),
        Test(headers=h, request=f"users", method="POST", data=new_user, requirement=CREATED),
        Test(headers=h, request=f"users", method="POST", data=new_user, requirement=CREATED),
        Test(headers=h, request=f"users", method="POST", requirement=BAD),
        Test(headers=h, request=f"users", method="POST", data={"firstName": "Bad"}, requirement=BAD),
        Test(headers=h, request=f"users", method="POST", data={"lastName": "Bad"}, requirement=BAD),
        Test(headers=h, request=f"users"),
        Test(headers=h, request="users/{steps.2.id}", requirement=OK),
        Test(headers=h, request="users/{steps.2.id}", method="PATCH", data={"firstName": "New Test"}, requirement=OK),
        Test(headers=h, request="users/{steps.3.id}", method="PATCH", requirement=BAD),
        Test(headers=h, request="users/124", method="PATCH", data={"firstName": "New Test"}, requirement=NOT_FOUND),
        Test(headers=h, request="users/{steps.4.id}", method="DELETE", requirement=OK),
        Test(headers=h, request="users/{steps.4.id}", method="DELETE", requirement=NOT_FOUND),
    ])
	create_scenario("Users", tests)


