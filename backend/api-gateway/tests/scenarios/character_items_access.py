from tests.templates import Test, Scenario, GatewayStep
from tests.test_variables import *
from .auth_helper import register_or_auth

h = {"Content-Type": "application/json; charset=utf-8"}
scenarios: list[Scenario] = []


def register_character_items_access_scenario():
    admin = register_or_auth("citems_admin", "Pass123")
    reader = register_or_auth("citems_reader", "Pass456")
    writer = register_or_auth("citems_writer", "Pass789")

    data = {
        "at": admin["accessToken"],
        "aid": admin["id"],
        "rt": reader["accessToken"],
        "rid": reader["id"],
        "wt": writer["accessToken"],
        "wid": writer["id"],
    }

    tests = []

    # 0. Create group
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups", method="POST",
        data={"name": "CharItemsGroup"}, requirement=CREATED))

    # 1. Create template
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.0.id}/characters/templates", method="POST",
        data={"name": "Hero", "description": "Template for items testing",
              "fields": {"str": {"name": "Strength", "description": "", "value": 10}}},
        requirement=CREATED))

    # 2. Create character
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.0.id}/characters", method="POST",
        data={"name": "ItemTestChar", "description": "", "templateId": "{steps.1.id}"},
        requirement=CREATED))

    # 3. Add reader to group
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.0.id}/users/{rid}", method="PUT",
        data={"isAdmin": False}, requirement=CREATED))

    # 4. Add writer to group
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.0.id}/users/{wid}", method="PUT",
        data={"isAdmin": False}, requirement=CREATED))

    # 5. Give reader read-only access to character
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.0.id}/characters/{steps.2.id}/users/{rid}", method="PUT",
        data={"canWrite": False}, requirement=CREATED))

    # 6. Give writer write access to character
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.0.id}/characters/{steps.2.id}/users/{wid}", method="PUT",
        data={"canWrite": True}, requirement=CREATED))

    # 7. POST item (reader, read-only) → 403
    tests.append(Test(headers={**h, "Authorization": "{rt}"},
        request="groups/{steps.0.id}/characters/{steps.2.id}/items", method="POST",
        data={"name": "StolenItem", "description": "", "amount": 1}, requirement=FORBID))

    # 8. POST item (writer, write access) → 201
    tests.append(Test(headers={**h, "Authorization": "{wt}"},
        request="groups/{steps.0.id}/characters/{steps.2.id}/items", method="POST",
        data={"name": "LegitItem", "description": "Writer's item", "amount": 5}, requirement=CREATED))

    # 9. GET item by id (reader, read-only) → 200 (чтение разрешено всем)
    tests.append(Test(headers={**h, "Authorization": "{rt}"},
        request="groups/{steps.0.id}/characters/{steps.2.id}/items/{steps.8.id}", method="GET", requirement=OK))

    # 10. PUT item (reader, read-only) → 403
    tests.append(Test(headers={**h, "Authorization": "{rt}"},
        request="groups/{steps.0.id}/characters/{steps.2.id}/items/{steps.8.id}", method="PUT",
        data={"name": "HackedItem", "amount": 999}, requirement=FORBID))

    # 11. PUT item (writer, write access) → 200
    tests.append(Test(headers={**h, "Authorization": "{wt}"},
        request="groups/{steps.0.id}/characters/{steps.2.id}/items/{steps.8.id}", method="PUT",
        data={"name": "UpdatedItem", "description": "Updated description", "amount": 10}, requirement=OK))

    # 12. DELETE item (reader, read-only) → 403
    tests.append(Test(headers={**h, "Authorization": "{rt}"},
        request="groups/{steps.0.id}/characters/{steps.2.id}/items/{steps.8.id}", method="DELETE", requirement=FORBID))

    # 13. DELETE item (writer, write access) → 200
    tests.append(Test(headers={**h, "Authorization": "{wt}"},
        request="groups/{steps.0.id}/characters/{steps.2.id}/items/{steps.8.id}", method="DELETE", requirement=OK))

    steps = [GatewayStep(t) for t in tests]
    scenario = Scenario("CharacterItemsAccess", steps, data)
    scenarios.append(scenario)
