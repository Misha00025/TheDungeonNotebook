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

def with_notes_edit_scenario(headers = uh.copy(), character_number = 1):
	character_id = "{steps.0.data.characters."+str(character_number)+".id}"
	new_data = {"header":"Test data", "body":"Test data"}
	old_data = {"header":"{steps.-3.data.header}", "body":"{steps.-3.data.header}"}
	last_id = "{steps.6.data.notes.last}"
	tests = [
		Test(headers=headers, request="groups/{group}/characters", is_valid=check_many_characters),
		Test(headers=headers, request=f"characters/{character_id}/notes/0", is_valid=check_note),
		Test(headers=headers, request=f"characters/{character_id}/notes/0", requirement=CREATED, method="PUT", data=new_data, is_valid=lambda a, b: eq(new_data, a, b)),
		Test(headers=headers, request=f"characters/{character_id}/notes/0", is_valid=lambda a, b: eq(new_data, a, b)),
		Test(headers=headers, request=f"characters/{character_id}/notes/0", requirement=CREATED, method="PUT", data=old_data, is_valid=check_note),
		Test(headers=headers, request=f"characters/{character_id}/notes", requirement=CREATED, method="POST", data=new_data, is_valid=lambda a, b: eq(new_data, a, b)),
		Test(headers=headers, request=f"characters/{character_id}/notes", is_valid=check_many_notes),
		Test(headers=headers, request=f"characters/{character_id}/notes/{last_id}", is_valid=lambda a, b: eq(new_data, a, b)),
		Test(headers=headers, request=f"characters/{character_id}/notes/{last_id}", method="DELETE"),
		Test(headers=headers, request=f"characters/{character_id}/notes/{last_id}", requirement=NOT_FOUND),

	]
	create_scenario("Note Edit", tests, {"group": mg})
	
def with_items_edit_scenario(headers = uh.copy(), character_number = 1):
	character_id = "{steps.0.data.characters."+str(character_number)+".id}"
	new_data = {"name": "Some item", "description": "some some item", "amount": '5'}
	old_data = {"name": "{steps.2.data.name}", "description": "{steps.2.data.description}", "amount": "{steps.2.data.amount}"}
	last_id = "{steps.7.data.items.last}"
	data = {"group": mg}
	def test_data(path, a, b):
		res = replace_placeholders(path, data)
		res = res.replace("'", '"')
		res: dict = json.loads(res)
		if tv.debug:
			print(type(res), res)
		return eq(res, a, b)
	
	tests = [
		Test(headers=headers, request="groups/{group}/characters", is_valid=check_many_characters),
		Test(headers=headers, request=f"characters/{character_id}/items", is_valid=check_many_amounted_items),
		Test(headers=headers, request=f"characters/{character_id}/items/0", is_valid=lambda a,b: test_data("{steps.1.data.items.0}", a,b)),
		Test(headers=headers, request=f"characters/{character_id}/items/0", requirement=CREATED, method="PUT", data=new_data, is_valid=lambda a, b: eq(new_data, a, b)),
		Test(headers=headers, request=f"characters/{character_id}/items/0", is_valid=lambda a, b: eq(new_data, a, b)),
		Test(headers=headers, request=f"characters/{character_id}/items/0", requirement=CREATED, method="PUT", data=old_data, is_valid=lambda a,b: test_data("{steps.1.data.items.0}", a,b)),
		Test(headers=headers, request=f"characters/{character_id}/items", requirement=CREATED, method="POST", data=new_data, is_valid=lambda a, b: eq(new_data, a, b)),
		Test(headers=headers, request=f"characters/{character_id}/items", is_valid=check_many_amounted_items),
		Test(headers=headers, request=f"characters/{character_id}/items/{last_id}", is_valid=lambda a, b: eq(new_data, a, b)),
		Test(headers=headers, request=f"characters/{character_id}/items/{last_id}", method="DELETE"),
		Test(headers=headers, request=f"characters/{character_id}/items/{last_id}", requirement=NOT_FOUND),
	]
	create_scenario("Items Edit", tests, data)


def with_group_items_edit_scenario(headers = uh.copy()):
	data = {"group": -101}
	old_data = {"name": "test_item", "description": "test description"}
	new_data = {"name": "test_item_new", "description": "test description new"}
	last_id="{steps.2.data.items.last-v.id}"
	tests = [
		Test(headers=headers, request="groups/{group}/items", is_valid=check_many_items),
		Test(headers=headers, request="groups/{group}/items", method="POST", data=old_data, requirement=CREATED, is_valid=lambda a,b: eq(old_data, a,b)),
		Test(headers=headers, request="groups/{group}/items", is_valid=check_many_items),
		Test(headers=headers, request="groups/{group}/items/"+last_id, is_valid=lambda a,b: eq(old_data, a,b)),
		Test(headers=headers, request="groups/{group}/items/"+last_id, method="PUT", data=new_data, requirement=CREATED , is_valid=lambda a,b: eq(new_data, a,b)),
		Test(headers=headers, request="groups/{group}/items/"+last_id, is_valid=lambda a,b: eq(new_data, a,b)),
		Test(headers=headers, request="groups/{group}/items/"+last_id, method="DELETE"),
		Test(headers=headers, request="groups/{group}/items/"+last_id, requirement=NOT_FOUND),
		
	]
	create_scenario("Group Items Edit", tests, data)


