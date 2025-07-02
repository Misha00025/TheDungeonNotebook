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


def with_user_scenario():
    tests = []
    new_user_1 = {"id": 1, "nickname": "Test"}
    new_user_2 = {"id": 2, "nickname": "Test 1", "visibleName":"LastTest"}
    new_user_3 = {"id": 3, "nickname": "Test 2", "imageLink":"LastTest"}
    wrong_user = {"id": 4, "visibleName": "LastTest", "imageLink":"LastTest"}

    tests.extend([
        Test(headers=h, request=f"users"),
        Test(headers=h, request=f"users/{10}", requirement=NOT_FOUND),
        Test(headers=h, request=f"users", method="POST", data=new_user_1, requirement=CREATED),
        Test(headers=h, request=f"users", method="POST", data=new_user_2, requirement=CREATED),
        Test(headers=h, request=f"users", method="POST", data=new_user_3, requirement=CREATED),
        Test(headers=h, request=f"users", method="POST", data=new_user_1, requirement=CONFLICT),
        Test(headers=h, request=f"users", method="POST", data=wrong_user, requirement=BAD),
        Test(headers=h, request=f"users", method="POST", requirement=BAD),
        Test(headers=h, request=f"users"),
        Test(headers=h, request="users/{steps.2.id}", requirement=OK),
        Test(headers=h, request="users/{steps.2.id}", method="PATCH", data={"visibleName": "New Test"}, requirement=OK),
        Test(headers=h, request="users/{steps.3.id}", method="PATCH", data={"imageLink": "New Test"}, requirement=OK),
        Test(headers=h, request="users/{steps.3.id}", method="PATCH", requirement=BAD),
        Test(headers=h, request="users/124", method="PATCH", data={"visibleName": "New Test"}, requirement=NOT_FOUND),
        Test(headers=h, request="users/{steps.4.id}", method="DELETE", requirement=OK),
        Test(headers=h, request="users/{steps.4.id}", method="DELETE", requirement=NOT_FOUND),
    ])
    create_scenario("Users", tests)


