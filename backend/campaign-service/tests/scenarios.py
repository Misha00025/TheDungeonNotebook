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

def with_charlist_templates_scenario():
    tests = []
    new_template = {
        "name": "TestTemplate",
        "description": "TestTestTest",
        "fields":{
            "strong":{"name": "Strong", "description": "This is strong", "value": 10},
            "agility":{"name": "Agility", "description": "This is agility", "value": 12},
            "intellect":{"name": "Intellect", "description": "This is intellect", "value": 12},
        },
        "schema":{
            "categories": [
                {"key": "physics", "name": "Physics", "fields": ["strong", "agility"]},
                {"key": "mental", "name": "Mental", "fields": ["intellect"]}
            ]
        }
    }
    new_template_2 = new_template.copy()
    new_template["fields"]["intellect"] = {"name": "Intellect", "description": "This is intellect", "value": 100000}
    wrong_template = {"name": "WrongTemplate"}
    tests.extend([
        Test(headers=h, request="groups", method="POST", data={"name": "TestGroup"}, requirement=CREATED),
        Test(headers=h, request="groups/{steps.0.id}", requirement=OK),
        Test(headers=h, request="groups/{steps.0.id}/characters/templates", requirement=OK),
        Test(headers=h, request="groups/{steps.0.id}/characters/templates", method="POST", data=new_template, requirement=CREATED),
        Test(headers=h, request="groups/{steps.0.id}/characters/templates", method="POST", data=wrong_template, requirement=BAD),
        Test(headers=h, request="groups/{steps.0.id}/characters/templates/{steps.3.id}", requirement=OK),
        Test(headers=h, request="groups/{steps.0.id}/characters/templates/1244512133", requirement=NOT_FOUND),
        Test(headers=h, request="groups/{steps.0.id}/characters/templates/{steps.3.id}", method="PUT", data=new_template_2, requirement=OK),
        Test(headers=h, request="groups/{steps.0.id}/characters/templates/{steps.3.id}", method="PUT", data=wrong_template, requirement=BAD),
        Test(headers=h, request="groups/{steps.0.id}/characters/templates/{steps.3.id}", requirement=OK),
        Test(headers=h, request="groups/{steps.0.id}/characters/templates/{steps.3.id}", method="DELETE", requirement=OK),
        Test(headers=h, request="groups/{steps.0.id}/characters/templates/{steps.3.id}", method="DELETE", requirement=NOT_FOUND),
    ])
    create_scenario("Charlists", tests)
    
def with_characters_scenario():
    tests = []
    new_template = {
        "name": "TestTemplate",
        "description": "TestTestTest",
        "fields":{
            "strong":{"name": "Strong", "description": "This is strong", "value": 10},
            "agility":{"name": "Agility", "description": "This is agility", "value": 12},
        }
    }
    new_character = {
        "name": "Steve",
        "description": "Minecraft is my life",
        "templateId": "{steps.2.id}"
    }
    update_description = {
        "description": "Oh, no! My description is updated!"
    }
    update_stats = {
        "fields":{
            "strong": {"value": 15},
            "agility": None,
            "intellect": {"name": "Intellect", "description": "You stupid", "value": -1}
        }
    }
    wrong_update_1 = {
        "name": "Samson",
        "fields":{
            "agility": {"name": "Test"}
        }
    }
    wrong_update_2 = {}
    wrong_update_3 = {
        "fields":{}
    }
    wrong_update_4 = {
        "fields":{
            "strong": {}
        }
    }
    wrong_character = {
        "name": "Not Steve",
        "description": "Minecraft is not my life",
    }
    tests.extend([
        Test(headers=h, request="groups", method="POST", data={"name": "TestGroup"}, requirement=CREATED),
        Test(headers=h, request="groups/{steps.0.id}", requirement=OK),
        Test(headers=h, request="groups/{steps.0.id}/characters/templates", method="POST", data=new_template, requirement=CREATED),
        Test(headers=h, request="groups/{steps.0.id}/characters", method="POST", data=new_character, requirement=CREATED),
        Test(headers=h, request="groups/{steps.0.id}/characters", method="POST", data=wrong_character, requirement=BAD),
        Test(headers=h, request="groups/{steps.0.id}/characters/{steps.3.id}", requirement=OK),
        Test(headers=h, request="groups/{steps.0.id}/characters/1245313", requirement=NOT_FOUND),
        Test(headers=h, request="groups/{steps.0.id}/characters/{steps.3.id}", method="PATCH", data=update_description, requirement=OK),
        Test(headers=h, request="groups/{steps.0.id}/characters/{steps.3.id}", method="PATCH", data=update_stats, requirement=OK),
        Test(headers=h, request="groups/{steps.0.id}/characters/{steps.3.id}", method="PATCH", data=wrong_update_1, requirement=BAD),
        Test(headers=h, request="groups/{steps.0.id}/characters/{steps.3.id}", method="PATCH", data=wrong_update_2, requirement=BAD),
        Test(headers=h, request="groups/{steps.0.id}/characters/{steps.3.id}", method="PATCH", data=wrong_update_3, requirement=BAD),
        Test(headers=h, request="groups/{steps.0.id}/characters/{steps.3.id}", method="PATCH", data=wrong_update_4, requirement=BAD),
        Test(headers=h, request="groups/{steps.0.id}/characters/{steps.3.id}", requirement=OK),
        Test(headers=h, request="groups/{steps.0.id}/characters/{steps.3.id}", method="DELETE", requirement=OK),
        Test(headers=h, request="groups/{steps.0.id}/characters/{steps.3.id}", method="DELETE", requirement=NOT_FOUND),
    ])
    create_scenario("Characters", tests)

def with_notes_scenario():
    tests = []
    new_template = {
        "name": "TestTemplate",
        "description": "TestTestTest",
        "fields":{
            "strong":{"name": "Strong", "description": "This is strong", "value": 10},
            "agility":{"name": "Agility", "description": "This is agility", "value": 12},
        }
    }
    new_character = {
        "name": "Steve",
        "description": "Minecraft is my life",
        "templateId": "{steps.1.id}"
    }
    new_note = {
        "header": "TestNote",
        "body": "You is tested now :)"
    }
    updated_note = {
        "header": "{steps.5.header}",
        "body": "{steps.5.body} UPD: And updated too",
    }
    wrong_note = { "header": "I am wrong note :C" }
    tests.extend([
        Test(headers=h, request="groups", method="POST", data={"name": "TestGroup"}, requirement=CREATED),
        Test(headers=h, request="groups/{steps.0.id}/characters/templates", method="POST", data=new_template, requirement=CREATED),
        Test(headers=h, request="groups/{steps.0.id}/characters", method="POST", data=new_character, requirement=CREATED),
        Test(headers=h, request="groups/{steps.0.id}/characters/{steps.2.id}", requirement=OK),
        Test(headers=h, request="groups/{steps.0.id}/characters/{steps.2.id}/notes", requirement=OK),
        Test(headers=h, request="groups/{steps.0.id}/characters/{steps.2.id}/notes", method="POST", data=new_note, requirement=CREATED),
        Test(headers=h, request="groups/{steps.0.id}/characters/{steps.2.id}/notes", method="POST", data=new_note, requirement=CREATED),
        Test(headers=h, request="groups/{steps.0.id}/characters/{steps.2.id}/notes", method="POST", data=new_note, requirement=CREATED),
        Test(headers=h, request="groups/{steps.0.id}/characters/{steps.2.id}/notes", method="POST", data=wrong_note, requirement=BAD),
        Test(headers=h, request="groups/{steps.0.id}/characters/{steps.2.id}/notes/{steps.5.id}", requirement=OK),
        Test(headers=h, request="groups/{steps.0.id}/characters/{steps.2.id}/notes", requirement=OK),
        Test(headers=h, request="groups/{steps.0.id}/characters/{steps.2.id}/notes/{steps.5.id}", method="PUT", data=updated_note, requirement=OK),
        Test(headers=h, request="groups/{steps.0.id}/characters/{steps.2.id}/notes/1231353", method="PUT", data=updated_note, requirement=NOT_FOUND),
        Test(headers=h, request="groups/{steps.0.id}/characters/{steps.2.id}/notes/{steps.5.id}", method="PUT", data=wrong_note, requirement=BAD),
        Test(headers=h, request="groups/{steps.0.id}/characters/{steps.2.id}/notes/{steps.5.id}", method="PUT", requirement=BAD),
        Test(headers=h, request="groups/{steps.0.id}/characters/{steps.2.id}/notes/{steps.5.id}", method="DELETE", requirement=OK),
        Test(headers=h, request="groups/{steps.0.id}/characters/{steps.2.id}/notes/{steps.5.id}", method="DELETE", requirement=NOT_FOUND),
    ])
    create_scenario("Notes", tests)

def with_group_items_scenario():
    tests = []
    new_item = {
        "name": "TestItem",
        "description": "TestDescription",
    }
    new_item_2 = {
        "name": "TestItem 2",
        "description": "TestDescription 2",
        "price": 10,
    }
    wrong_item = {
        "description": "Test Wrong"
    }
    tests.extend([
        Test(headers=h, request="groups", method="POST", data={"name": "TestGroup"}, requirement=CREATED),
        Test(headers=h, request="groups/{steps.0.id}/items", requirement=OK),
        Test(headers=h, request="groups/{steps.0.id}/items", method="POST", data=new_item, requirement=CREATED),
        Test(headers=h, request="groups/{steps.0.id}/items", method="POST", data=new_item_2, requirement=CREATED),
        Test(headers=h, request="groups/{steps.0.id}/items", method="POST", data=wrong_item, requirement=BAD),
        Test(headers=h, request="groups/{steps.0.id}/items", method="POST", requirement=BAD),
        Test(headers=h, request="groups/{steps.0.id}/items/{steps.2.id}", requirement=OK),
        Test(headers=h, request="groups/{steps.0.id}/items/{steps.3.id}", requirement=OK),
        Test(headers=h, request="groups/{steps.0.id}/items/{steps.3.id}", method="DELETE", requirement=OK),
        Test(headers=h, request="groups/{steps.0.id}/items/{steps.3.id}", requirement=NOT_FOUND),
        Test(headers=h, request="groups/{steps.0.id}/items/124324184", requirement=NOT_FOUND),
        Test(headers=h, request="groups/{steps.0.id}/items/{steps.2.id}", method="PUT", data=new_item_2, requirement=OK),
        Test(headers=h, request="groups/{steps.0.id}/items/{steps.2.id}", method="PUT", data=wrong_item, requirement=BAD),
        Test(headers=h, request="groups/{steps.0.id}/items/{steps.2.id}", method="DELETE", requirement=OK),
        Test(headers=h, request="groups/{steps.0.id}/items/{steps.2.id}", method="DELETE", requirement=NOT_FOUND),
    ])
    create_scenario("Groups Items", tests)

def with_character_items_scenario():
    tests = []
    new_template = {
        "name": "TestTemplate",
        "description": "TestTestTest",
        "fields":{
            "strong":{"name": "Strong", "description": "This is strong", "value": 10},
            "agility":{"name": "Agility", "description": "This is agility", "value": 12},
        }
    }
    new_character = {
        "name": "Steve",
        "description": "Minecraft is my life",
        "templateId": "{steps.1.id}"
    }
    new_item = {
        "name": "TestItem",
        "description": "TestDescription",
    }
    new_item_2 = {
        "name": "TestItem 2",
        "description": "TestDescription 2",
        "amount": 10,
    }
    wrong_item = {
        "description": "Test Wrong"
    }
    tests.extend([
        Test(headers=h, request="groups", method="POST", data={"name": "TestGroup"}, requirement=CREATED),
        Test(headers=h, request="groups/{steps.0.id}/characters/templates", method="POST", data=new_template, requirement=CREATED),
        Test(headers=h, request="groups/{steps.0.id}/characters", method="POST", data=new_character, requirement=CREATED),
        Test(headers=h, request="groups/{steps.0.id}/characters/{steps.2.id}/items", requirement=OK),
        Test(headers=h, request="groups/{steps.0.id}/characters/{steps.2.id}/items", method="POST", data=new_item, requirement=CREATED),
        Test(headers=h, request="groups/{steps.0.id}/characters/{steps.2.id}/items", method="POST", data=new_item_2, requirement=CREATED),
        Test(headers=h, request="groups/{steps.0.id}/characters/{steps.2.id}/items", method="POST", data=wrong_item, requirement=BAD),
        Test(headers=h, request="groups/{steps.0.id}/characters/{steps.2.id}/items", method="POST", requirement=BAD),
        Test(headers=h, request="groups/{steps.0.id}/characters/{steps.2.id}/items/{steps.4.id}", requirement=OK),
        Test(headers=h, request="groups/{steps.0.id}/characters/{steps.2.id}/items/{steps.5.id}", requirement=OK),
        Test(headers=h, request="groups/{steps.0.id}/characters/{steps.2.id}/items/{steps.5.id}", method="DELETE", requirement=OK),
        Test(headers=h, request="groups/{steps.0.id}/characters/{steps.2.id}/items/{steps.5.id}", requirement=NOT_FOUND),
        Test(headers=h, request="groups/{steps.0.id}/characters/{steps.2.id}/items/124324184", requirement=NOT_FOUND),
        Test(headers=h, request="groups/{steps.0.id}/characters/{steps.2.id}/items/{steps.4.id}", method="PUT", data=new_item_2, requirement=OK),
        Test(headers=h, request="groups/{steps.0.id}/characters/{steps.2.id}/items/{steps.4.id}", method="PUT", data=wrong_item, requirement=BAD),
        Test(headers=h, request="groups/{steps.0.id}/characters/{steps.2.id}/items/{steps.4.id}", method="DELETE", requirement=OK),
        Test(headers=h, request="groups/{steps.0.id}/characters/{steps.2.id}/items/{steps.4.id}", method="DELETE", requirement=NOT_FOUND),
    ])
    create_scenario("Character Items", tests)

