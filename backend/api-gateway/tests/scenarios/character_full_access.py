from tests.templates import Test, Scenario, GatewayStep
from tests.test_variables import *
from .jwt_helper import generate_token

h = {"Content-Type": "application/json; charset=utf-8"}
scenarios: list[Scenario] = []


def register_character_full_access_scenario():
    admin_id = 11001
    reader_id = 11002
    writer_id = 11003

    admin_token = generate_token(admin_id)
    reader_token = generate_token(reader_id)
    writer_token = generate_token(writer_id)

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
        data={"firstName": "Admin", "lastName": "User", "nickname": "cfull_admin"}, requirement=CREATED))

    # 1. Create reader
    tests.append(Test(headers={**h, "Authorization": "{rt}"},
        request="users", method="POST",
        data={"firstName": "Reader", "lastName": "User", "nickname": "cfull_reader"}, requirement=CREATED))

    # 2. Create writer
    tests.append(Test(headers={**h, "Authorization": "{wt}"},
        request="users", method="POST",
        data={"firstName": "Writer", "lastName": "User", "nickname": "cfull_writer"}, requirement=CREATED))

    # 3. Create group
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups", method="POST",
        data={"name": "FullAccessGroup"}, requirement=CREATED))

    # 4. Create template
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.3.id}/characters/templates", method="POST",
        data={"name": "TestTemplate", "description": "",
              "fields": {"str": {"name": "Strength", "description": "", "value": 10}}},
        requirement=CREATED))

    # 5. Create char 1 (for read-only tests)
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.3.id}/characters", method="POST",
        data={"name": "ReadOnlyChar", "description": "", "templateId": "{steps.4.id}"},
        requirement=CREATED))

    # 6. Create char 2 (for write tests)
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.3.id}/characters", method="POST",
        data={"name": "WriteChar", "description": "", "templateId": "{steps.4.id}"},
        requirement=CREATED))

    # 7. Add reader to group
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.3.id}/users/{rid}", method="PUT",
        data={"isAdmin": False}, requirement=CREATED))

    # 8. Add writer to group
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.3.id}/users/{wid}", method="PUT",
        data={"isAdmin": False}, requirement=CREATED))

    # 9. Give reader read-only access to char 1
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.3.id}/characters/{steps.5.id}/users/{rid}", method="PUT",
        data={"canWrite": False}, requirement=CREATED))

    # 10. Give writer write access to char 2
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.3.id}/characters/{steps.6.id}/users/{wid}", method="PUT",
        data={"canWrite": True}, requirement=CREATED))

    # 11. PATCH char 1 (reader, read-only) → 403
    tests.append(Test(headers={**h, "Authorization": "{rt}"},
        request="groups/{steps.3.id}/characters/{steps.5.id}", method="PATCH",
        data={"name": "HackedName"}, requirement=FORBID))

    # 12. PATCH char 2 (writer, write access) → 200
    tests.append(Test(headers={**h, "Authorization": "{wt}"},
        request="groups/{steps.3.id}/characters/{steps.6.id}", method="PATCH",
        data={"name": "UpdatedName"}, requirement=OK))

    # 13. DELETE char 1 (reader, read-only) → 403
    tests.append(Test(headers={**h, "Authorization": "{rt}"},
        request="groups/{steps.3.id}/characters/{steps.5.id}", method="DELETE", requirement=FORBID))

    # 14. DELETE char 2 (writer, write access) → 200
    tests.append(Test(headers={**h, "Authorization": "{wt}"},
        request="groups/{steps.3.id}/characters/{steps.6.id}", method="DELETE", requirement=OK))

    # 15. Verify char 2 is gone
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.3.id}/characters/{steps.6.id}", method="GET", requirement=NOT_FOUND))

    steps = [GatewayStep(t) for t in tests]
    scenario = Scenario("CharacterFullAccess", steps, data)
    scenarios.append(scenario)
