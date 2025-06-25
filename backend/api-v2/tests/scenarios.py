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

def with_group_scenario():
    tests = []
    tests.extend([
        Test(headers=h, request="groups"),
        Test(headers=h, request="groups/1000000", requirement=NOT_FOUND),
        Test(headers=h, request="groups", method="POST", data={"name": "TestGroup"}, requirement=CREATED),
        Test(headers=h, request="groups", method="POST", data={"name": "TestGroup"}, requirement=CREATED),
        Test(headers=h, request="groups", method="POST", requirement=BAD),
        Test(headers=h, request="groups/{steps.2.id}", requirement=OK),
        Test(headers=h, request="groups/{steps.2.id}", method="PATCH", data={"name": "OldTestGroup"}),
        Test(headers=h, request="groups/100000", method="PATCH", data={"name": "OldTestGroup"}, requirement=NOT_FOUND),
        Test(headers=h, request="groups/{steps.2.id}", method="PATCH", requirement=BAD),
        Test(headers=h, request="groups/{steps.3.id}", method="DELETE"),
        Test(headers=h, request="groups/{steps.3.id}", method="DELETE", requirement=NOT_FOUND),
    ])
    create_scenario("Groups", tests)

def with_user_group_scenario():
    tests = []
    tests.extend(
    [
        Test(headers=h, request="groups", method="POST", data={"name": "TestGroup"}, requirement=CREATED),
        Test(headers=h, request="users", method="POST", data={"firstName": "TestUser", "lastName": "Tester"}, requirement=CREATED),
        Test(headers=h, request="users", method="POST", data={"firstName": "TestAdmin", "lastName": "Tester"}, requirement=CREATED),
        Test(headers=h, request="groups/{steps.0.id}", requirement=OK),
        Test(headers=h, request="groups/{steps.0.id}/users", requirement=OK),
        Test(headers=h, request="groups/{steps.0.id}/users", method="POST", data={"userId": "{steps.1.id}"}, requirement=CREATED),
        Test(headers=h, request="groups/{steps.0.id}/users", method="POST", data={"userId": "{steps.2.id}", "accessLevel": 2}, requirement=CREATED),
        Test(headers=h, request="groups/{steps.0.id}/users", method="POST", data={"userId": "{steps.1.id}"}, requirement=CONFLICT),
        Test(headers=h, request="groups/{steps.0.id}/users", method="POST", data={"userId": "{steps.1.id}", "accessLevel": 2}, requirement=CONFLICT),
        Test(headers=h, request="groups/{steps.0.id}/users", method="POST", data={"userId": "{steps.2.id}", "accessLevel": 2}, requirement=CONFLICT),
        Test(headers=h, request="groups/{steps.0.id}/users", method="POST", requirement=BAD),
        Test(headers=h, request="groups/{steps.0.id}/users", requirement=OK),
        Test(headers=h, request="groups/{steps.0.id}/users", method="PUT", data={"userId": "{steps.1.id}", "accessLevel": 2}, requirement=OK),
        Test(headers=h, request="groups/{steps.0.id}/users", method="PUT", data={"userId": "{steps.1.id}"}, requirement=BAD),
        Test(headers=h, request="groups/{steps.0.id}/users", method="PUT", requirement=BAD),
        Test(headers=h, request="groups/{steps.0.id}/users/{steps.-4.users.1.user.id}", method="DELETE", requirement=OK),
        Test(headers=h, request="groups/{steps.0.id}/users/{steps.-5.users.1.user.id}", method="DELETE", requirement=NOT_FOUND),

        Test(headers=h, request="groups/{steps.0.id}", method="DELETE", requirement=OK),
        Test(headers=h, request="groups/{steps.0.id}", requirement=NOT_FOUND),
        Test(headers=h, request="groups/{steps.0.id}/users", requirement=NOT_FOUND),
        Test(headers=h, request="groups/{steps.0.id}/users", method="POST", data={"userId": "{steps.1.id}"}, requirement=NOT_FOUND),
        Test(headers=h, request="groups/{steps.0.id}/users", method="POST", data={"userId": "{steps.2.id}", "accessLevel": 2}, requirement=NOT_FOUND),
        Test(headers=h, request="groups/{steps.0.id}/users", method="POST", data={"userId": "{steps.1.id}"}, requirement=NOT_FOUND),
        Test(headers=h, request="groups/{steps.0.id}/users", method="POST", data={"userId": "{steps.1.id}", "accessLevel": 2}, requirement=NOT_FOUND),
        Test(headers=h, request="groups/{steps.0.id}/users", method="POST", data={"userId": "{steps.2.id}", "accessLevel": 2}, requirement=NOT_FOUND),
        Test(headers=h, request="groups/{steps.0.id}/users", method="POST", requirement=NOT_FOUND),
        Test(headers=h, request="groups/{steps.0.id}/users", requirement=NOT_FOUND),
        Test(headers=h, request="groups/{steps.0.id}/users/1", method="DELETE", requirement=NOT_FOUND),
    ])
    create_scenario("UsersGroups", tests)