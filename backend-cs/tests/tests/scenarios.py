from .tests_data import *
from .templates import Scenario, Step, Test
from .validation import *
from .test_variables import *

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
    user_extend(tests)
    create_scenario("User Account GET", tests)


def with_group_scenario():
    tests = []
    group_extend(tests)
    create_scenario("Group GET", tests)


def with_character_scenario():
    tests = [
        Test(headers=uh, request="groups/{group}/characters", is_valid=check_many_characters),
        Test(headers=uh, request="characters/{steps.0.data.characters.0.id}", is_valid=check_character_data),
        Test(headers=uh, request="characters/{steps.1.data.id}/items", is_valid=check_many_amounted_items),
        Test(headers=uh, request="characters/{steps.1.data.id}/notes", is_valid=check_many_notes),
    ]
    characters_extend(tests)
    create_scenario("Character GET", tests, {"group": mg})

def with_notes_edit_scenario():
    character_id = "{steps.0.data.characters.0.id}"
    new_data = {"header":"Test data", "body":"Test data"}
    old_data = {"header":"{steps.-3.data.header}", "body":"{steps.-3.data.header}"}
    tests = [
        Test(headers=uh, request="groups/{group}/characters", is_valid=check_many_characters),
        Test(headers=uh, request=f"characters/{character_id}/notes/0", is_valid=check_note),
        Test(headers=uh, request=f"characters/{character_id}/notes/0", requirement=CREATED, method="PUT", data=new_data, is_valid=lambda a, b: eq(new_data, a, b)),
        Test(headers=uh, request=f"characters/{character_id}/notes/0", is_valid=lambda a, b: eq(new_data, a, b)),
        Test(headers=uh, request=f"characters/{character_id}/notes/0", requirement=CREATED, method="PUT", data=old_data, is_valid=check_note),
        Test(headers=uh, request=f"characters/{character_id}/notes/0", requirement=CREATED, method="POST", data=old_data, is_valid=check_note),
    ]
    create_scenario("Note Edit", tests, {"group": mg})


