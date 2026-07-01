from tests.templates import Test, Scenario, GatewayStep
from tests.test_variables import *

h = {"Content-Type": "application/json; charset=utf-8"}
scenarios: list[Scenario] = []


def register_export_import_scenario():
    tests = []

    # 0. Register admin user
    tests.append(Test(headers=h, request="auth/register", method="POST",
        data={"username": "export_admin", "password": "ExportPass"}, requirement=CREATED))

    # 1. Login admin
    tests.append(Test(headers=h, request="auth/login", method="POST",
        data={"username": "export_admin", "password": "ExportPass"}, requirement=OK))

    # 2. Refresh token
    tests.append(Test(headers={**h, "Refresh-Token": "{steps.1.token}"},
        request="auth/refresh", method="POST", requirement=OK))

    # 3. Create group
    tests.append(Test(headers={**h, "Authorization": "{steps.2.accessToken}"},
        request="groups", method="POST",
        data={"name": "ExportTestGroup", "description": "Group for export testing"},
        requirement=CREATED))

    # 4. Create character template
    tests.append(Test(headers={**h, "Authorization": "{steps.2.accessToken}"},
        request="groups/{steps.3.id}/characters/templates", method="POST",
        data={"name": "Warrior", "description": "A strong fighter",
              "fields": {"strength": {"name": "Strength", "description": "Physical power", "value": 10}}},
        requirement=CREATED))

    # 5. Create character
    tests.append(Test(headers={**h, "Authorization": "{steps.2.accessToken}"},
        request="groups/{steps.3.id}/characters", method="POST",
        data={"name": "Conan", "description": "Barbarian", "templateId": "{steps.4.id}"},
        requirement=CREATED))

    # 6. Create group item
    tests.append(Test(headers={**h, "Authorization": "{steps.2.accessToken}"},
        request="groups/{steps.3.id}/items", method="POST",
        data={"name": "Excalibur", "description": "Legendary sword", "price": 100},
        requirement=CREATED))

    # 7. Create group skill
    tests.append(Test(headers={**h, "Authorization": "{steps.2.accessToken}"},
        request="groups/{steps.3.id}/skills", method="POST",
        data={"name": "Fireball", "description": "FIRE!"},
        requirement=CREATED))

    # 8. Export all data (include=templates,characters,items,skills)
    tests.append(Test(headers={**h, "Authorization": "{steps.2.accessToken}"},
        request="groups/{steps.3.id}/export", method="GET",
        params={"include": "templates,characters,items,skills"}, requirement=OK))

    # 9. Export only items,skills
    tests.append(Test(headers={**h, "Authorization": "{steps.2.accessToken}"},
        request="groups/{steps.3.id}/export", method="GET",
        params={"include": "items,skills"}, requirement=OK))

    # 10. Export without include parameter
    tests.append(Test(headers={**h, "Authorization": "{steps.2.accessToken}"},
        request="groups/{steps.3.id}/export", method="GET", requirement=OK))

    # 11. Create second group for import
    tests.append(Test(headers={**h, "Authorization": "{steps.2.accessToken}"},
        request="groups", method="POST",
        data={"name": "ImportGroup", "description": "Group for import testing"},
        requirement=CREATED))

    # 12. Import data into second group
    tests.append(Test(headers={**h, "Authorization": "{steps.2.accessToken}"},
        request="groups/{steps.11.id}/import", method="POST",
        data={
            "version": 1,
            "exportedAt": "2025-01-01T00:00:00Z",
            "groupId": "{steps.3.id}",
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
        }, requirement=OK))

    # 13. Verify imported templates exist
    tests.append(Test(headers={**h, "Authorization": "{steps.2.accessToken}"},
        request="groups/{steps.11.id}/characters/templates", method="GET", requirement=OK))

    # 14. Verify imported characters exist
    tests.append(Test(headers={**h, "Authorization": "{steps.2.accessToken}"},
        request="groups/{steps.11.id}/characters", method="GET", requirement=OK))

    # 15. Verify imported items exist
    tests.append(Test(headers={**h, "Authorization": "{steps.2.accessToken}"},
        request="groups/{steps.11.id}/items", method="GET", requirement=OK))

    # 16. Verify imported skills exist
    tests.append(Test(headers={**h, "Authorization": "{steps.2.accessToken}"},
        request="groups/{steps.11.id}/skills", method="GET", requirement=OK))

    steps = [GatewayStep(t) for t in tests]
    scenario = Scenario("ExportImport", steps)
    scenarios.append(scenario)
