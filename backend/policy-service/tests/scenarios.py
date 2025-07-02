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


def with_rules_scenario():
    tests = []

    tests.extend([
        Test(headers=h, request=f"polices/groups"),
        Test(headers=h, request=f"polices/groups/characters", method="PUT", data={"userId": 1, "groupId": 1, "characterId": 1, "canWrite": True}, requirement=NOT_FOUND),
        Test(headers=h, request=f"polices/groups", method="PUT", data={"userId": 1, "groupId": 1, "isAdmin": True}, requirement=CREATED),
        Test(headers=h, request=f"polices/groups/characters", method="PUT", data={"userId": 1, "groupId": 1, "characterId": 1, "canWrite": True}, requirement=CREATED),
        Test(headers=h, request=f"polices/groups", method="PUT", data={"userId": 2, "groupId": 1, "isAdmin": False}, requirement=CREATED),
        Test(headers=h, request=f"polices/groups/characters", method="PUT", data={"userId": 2, "groupId": 1, "characterId": 1, "canWrite": False}, requirement=CREATED),
        Test(headers=h, request=f"polices/groups/characters", method="PUT", data={"userId": 2, "groupId": 1, "characterId": 1, "canWrite": True}, requirement=OK),
        Test(headers=h, request=f"polices/groups", method="PUT", data={"userId": 3, "groupId": 1}, requirement=CREATED),
        Test(headers=h, request=f"polices/groups", method="PUT", data={"userId": 4, "groupId": 1}, requirement=CREATED),
        Test(headers=h, request=f"polices/groups", method="PUT", data={"userId": 2, "groupId": 1, "isAdmin": True}, requirement=OK),
        Test(headers=h, request=f"polices/groups", method="PUT", data={"userId": 2, "groupId": 1, "isAdmin": False}, requirement=OK),
        Test(headers=h, request=f"polices/groups", method="PUT", data={"userId": 1, "groupId": 2, "isAdmin": True}, requirement=CREATED),
        Test(headers=h, request=f"polices/groups", method="PUT", data={"userId": 2, "groupId": 2}, requirement=CREATED),
        Test(headers=h, request=f"polices/groups", method="PUT", data={"userId": 2}, requirement=BAD),
        Test(headers=h, request=f"polices/groups"),
        Test(headers=h, request=f"polices/groups?userId=1"),
        Test(headers=h, request=f"polices/groups?userId=2"),
        Test(headers=h, request=f"polices/groups/characters", method="PUT", data={"userId": 2, "groupId": 1, "characterId": 1, "canWrite": False}, requirement=OK),
        Test(headers=h, request=f"polices/groups?userId=2"),
        Test(headers=h, request=f"polices/groups?groupId=1&userId=2", method="DELETE", requirement=OK),
        Test(headers=h, request=f"polices/groups?groupId=1&userId=2", method="DELETE", requirement=NOT_FOUND),
        Test(headers=h, request=f"polices/groups?groupId=1&userId=2&characterId=1", method="DELETE", requirement=NOT_FOUND),
        Test(headers=h, request=f"polices/groups?groupId=1&userId=1&characterId=1", method="DELETE", requirement=OK),
        Test(headers=h, request=f"polices/groups?groupId=1&userId=1&characterId=1", method="DELETE", requirement=NOT_FOUND),
        Test(headers=h, request=f"polices/groups?groupId=1&userId=1", method="DELETE", requirement=OK),
        Test(headers=h, request=f"polices/groups?groupId=1&userId=1", method="DELETE", requirement=NOT_FOUND),
    ])
    create_scenario("Rules", tests)


