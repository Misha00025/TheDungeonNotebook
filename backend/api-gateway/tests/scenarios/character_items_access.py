from tests.templates import Test, Scenario, GatewayStep
from tests.test_variables import *
from tests.validators import has_id, has_fields, is_error
from .jwt_helper import generate_token

h = {"Content-Type": "application/json; charset=utf-8"}
scenarios: list[Scenario] = []


def register_character_items_access_scenario():
    admin_token, admin_id = generate_token()
    reader_token, reader_id = generate_token()
    writer_token, writer_id = generate_token()

    data = {
        "at": admin_token,
        "aid": admin_id,
        "rt": reader_token,
        "rid": reader_id,
        "wt": writer_token,
        "wid": writer_id,
    }

    tests = []

    # 0. Create admin user
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="users", method="POST",
        data={"firstName": "Admin", "lastName": "User", "nickname": "citems_admin"}, requirement=CREATED))

    # 1. Create reader
    tests.append(Test(headers={**h, "Authorization": "{rt}"},
        request="users", method="POST",
        data={"firstName": "Reader", "lastName": "User", "nickname": "citems_reader"}, requirement=CREATED))

    # 2. Create writer
    tests.append(Test(headers={**h, "Authorization": "{wt}"},
        request="users", method="POST",
        data={"firstName": "Writer", "lastName": "User", "nickname": "citems_writer"}, requirement=CREATED))

    # 3. Create group
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups", method="POST",
        data={"name": "CharItemsGroup"}, requirement=CREATED))

    # 4. Create template
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.3.id}/characters/templates", method="POST",
        data={"name": "Hero", "description": "Template for items testing",
              "fields": {"str": {"name": "Strength", "description": "", "value": 10}}},
        requirement=CREATED))

    # 5. Create character
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.3.id}/characters", method="POST",
        data={"name": "ItemTestChar", "description": "", "templateId": "{steps.4.id}"},
        requirement=CREATED))

    # 6. Add reader to group
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.3.id}/users/{rid}", method="PUT",
        data={"isAdmin": False}, requirement=CREATED))

    # 7. Add writer to group
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.3.id}/users/{wid}", method="PUT",
        data={"isAdmin": False}, requirement=CREATED))

    # 8. Give reader read-only access to character
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.3.id}/characters/{steps.5.id}/users/{rid}", method="PUT",
        data={"canWrite": False}, requirement=CREATED))

    # 9. Give writer write access to character
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.3.id}/characters/{steps.5.id}/users/{wid}", method="PUT",
        data={"canWrite": True}, requirement=CREATED))

    # 10. POST item (reader, read-only) → 403
    tests.append(Test(headers={**h, "Authorization": "{rt}"},
        request="groups/{steps.3.id}/characters/{steps.5.id}/items", method="POST",
        data={"name": "StolenItem", "description": "", "amount": 1}, requirement=FORBID,
        is_valid=is_error()))

    # 11. POST item (writer, write access) → 201
    tests.append(Test(headers={**h, "Authorization": "{wt}"},
        request="groups/{steps.3.id}/characters/{steps.5.id}/items", method="POST",
        data={"name": "LegitItem", "description": "Writer's item", "amount": 5}, requirement=CREATED,
        is_valid=has_id()))

    # 12. GET item by id (reader, read-only) → 200
    tests.append(Test(headers={**h, "Authorization": "{rt}"},
        request="groups/{steps.3.id}/characters/{steps.5.id}/items/{steps.11.id}", method="GET", requirement=OK,
        is_valid=has_id()))

    # 13. PUT item (reader, read-only) → 403
    tests.append(Test(headers={**h, "Authorization": "{rt}"},
        request="groups/{steps.3.id}/characters/{steps.5.id}/items/{steps.11.id}", method="PUT",
        data={"name": "HackedItem", "amount": 999}, requirement=FORBID,
        is_valid=is_error()))

    # 14. PUT item (writer, write access) → 200
    tests.append(Test(headers={**h, "Authorization": "{wt}"},
        request="groups/{steps.3.id}/characters/{steps.5.id}/items/{steps.11.id}", method="PUT",
        data={"name": "UpdatedItem", "description": "Updated description", "amount": 10}, requirement=OK,
        is_valid=has_fields(amount=10)))

    # 15. DELETE item (reader, read-only) → 403
    tests.append(Test(headers={**h, "Authorization": "{rt}"},
        request="groups/{steps.3.id}/characters/{steps.5.id}/items/{steps.11.id}", method="DELETE", requirement=FORBID,
        is_valid=is_error()))

    # 16. DELETE item (writer, write access) → 200
    tests.append(Test(headers={**h, "Authorization": "{wt}"},
        request="groups/{steps.3.id}/characters/{steps.5.id}/items/{steps.11.id}", method="DELETE", requirement=OK,
        is_valid=has_id()))

    steps = [GatewayStep(t) for t in tests]
    scenario = Scenario("CharacterItemsAccess", steps, data)
    scenarios.append(scenario)
