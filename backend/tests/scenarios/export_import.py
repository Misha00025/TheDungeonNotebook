from tests.templates import Test, Scenario, GatewayStep
from tests.test_variables import *
from tests.validators import has_id, has_list, has_keys
from .jwt_helper import generate_token

h = {"Content-Type": "application/json; charset=utf-8"}
scenarios: list[Scenario] = []


def register_export_import_scenario():
    admin_token, admin_id = generate_token()

    data = {
        "at": admin_token,
        "aid": admin_id,
    }

    tests = []

    # Create admin user
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="users", method="POST",
        data={"firstName": "ExportAdmin", "lastName": "Test", "nickname": "export_admin"}, requirement=CREATED,
        is_valid=has_id()))

    # Create group
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups", method="POST",
        data={"name": "ExportTestGroup", "description": "Group for export testing"},
        requirement=CREATED,
        is_valid=has_id()))

    # Create character template
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.1.id}/characters/templates", method="POST",
        data={"name": "Warrior", "description": "A strong fighter",
              "fields": {"strength": {"name": "Strength", "description": "Physical power", "value": 10}}},
        requirement=CREATED,
        is_valid=has_id()))

    # Create character
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.1.id}/characters", method="POST",
        data={"name": "Conan", "description": "Barbarian", "templateId": "{steps.2.id}"},
        requirement=CREATED,
        is_valid=has_id()))

    # Create group item
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.1.id}/items", method="POST",
        data={"name": "Excalibur", "description": "Legendary sword", "price": 100},
        requirement=CREATED,
        is_valid=has_id()))

    # Create group skill
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.1.id}/skills", method="POST",
        data={"name": "Fireball", "description": "FIRE!"},
        requirement=CREATED,
        is_valid=has_id()))

    # Export all data
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.1.id}/export", method="GET",
        params={"include": "templates,characters,items,skills"}, requirement=OK,
        is_valid=has_keys("version", "groupId", "exportedAt")))

    # Export only items,skills
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.1.id}/export", method="GET",
        params={"include": "items,skills"}, requirement=OK,
        is_valid=has_keys("version", "groupId", "exportedAt")))

    # Export without include parameter
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.1.id}/export", method="GET", requirement=OK,
        is_valid=has_keys("version", "groupId", "exportedAt")))

    # Create second group for import
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups", method="POST",
        data={"name": "ImportGroup", "description": "Group for import testing"},
        requirement=CREATED,
        is_valid=has_id()))

    # Import data into second group
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.9.id}/import", method="POST",
        data={
            "version": 1,
            "exportedAt": "2025-01-01T00:00:00Z",
            "groupId": "{steps.1.id}",
            "charlists": [
                {"oldId": 0, "name": "TestTemplate",
                 "description": "TestDescriptionOfTemplate",
                 "fields": {"strong": {"name": "Strong", "description": "Strong", "value": 10}}}
            ],
            "characters": [
                {"oldId": 0, "name": "TestCharacter",
                 "description": "", "templateOldId": 0, "ownerId": None, "fields": {}}
            ],
            "items": [
                {"oldId": 0, "name": "TestItem",
                 "description": "Test", "price": 10, "isSecret": False,
                 "imageLink": None, "attributes": []}
            ],
            "skills": [
                {"oldId": 0, "name": "Fireball",
                 "description": "FIRE!", "isSecret": False, "attributes": []}
            ]
        }, requirement=OK,
        is_valid=has_keys("success", "imported", "errors")))

    # Verify imported templates exist
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.9.id}/characters/templates", method="GET", requirement=OK,
        is_valid=has_list("templates")))

    # Verify imported characters exist
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.9.id}/characters", method="GET", requirement=OK,
        is_valid=has_keys()))

    # Verify imported items exist
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.9.id}/items", method="GET", requirement=OK,
        is_valid=has_list("items")))

    # Verify imported skills exist
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.9.id}/skills", method="GET", requirement=OK,
        is_valid=has_list("skills")))

    steps = [GatewayStep(t) for t in tests]
    scenario = Scenario("ExportImport", steps, data)
    scenarios.append(scenario)


def create_export_import_scenario():
    return scenarios
