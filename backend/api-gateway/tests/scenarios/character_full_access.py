from tests.templates import Test, Scenario, GatewayStep
from tests.test_variables import *
from .auth_helper import register_or_auth

h = {"Content-Type": "application/json; charset=utf-8"}
scenarios: list[Scenario] = []


def register_character_full_access_scenario():
    admin = register_or_auth("cfull_admin", "Pass123")
    reader = register_or_auth("cfull_reader", "Pass456")
    writer = register_or_auth("cfull_writer", "Pass789")

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
        data={"name": "FullAccessGroup"}, requirement=CREATED))

    # 1. Create template
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.0.id}/characters/templates", method="POST",
        data={"name": "TestTemplate", "description": "",
              "fields": {"str": {"name": "Strength", "description": "", "value": 10}}},
        requirement=CREATED))

    # 2. Create char 1 (for read-only tests)
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.0.id}/characters", method="POST",
        data={"name": "ReadOnlyChar", "description": "", "templateId": "{steps.1.id}"},
        requirement=CREATED))

    # 3. Create char 2 (for write tests)
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.0.id}/characters", method="POST",
        data={"name": "WriteChar", "description": "", "templateId": "{steps.1.id}"},
        requirement=CREATED))

    # 4. Add reader to group
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.0.id}/users/{rid}", method="PUT",
        data={"isAdmin": False}, requirement=CREATED))

    # 5. Add writer to group
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.0.id}/users/{wid}", method="PUT",
        data={"isAdmin": False}, requirement=CREATED))

    # 6. Give reader read-only access to char 1
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.0.id}/characters/{steps.2.id}/users/{rid}", method="PUT",
        data={"canWrite": False}, requirement=CREATED))

    # 7. Give writer write access to char 2
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.0.id}/characters/{steps.3.id}/users/{wid}", method="PUT",
        data={"canWrite": True}, requirement=CREATED))

    # 8. PATCH char 1 (reader, read-only) → 403
    tests.append(Test(headers={**h, "Authorization": "{rt}"},
        request="groups/{steps.0.id}/characters/{steps.2.id}", method="PATCH",
        data={"name": "HackedName"}, requirement=FORBID))

    # 9. PATCH char 2 (writer, write access) → 200
    tests.append(Test(headers={**h, "Authorization": "{wt}"},
        request="groups/{steps.0.id}/characters/{steps.3.id}", method="PATCH",
        data={"name": "UpdatedName"}, requirement=OK))

    # 10. DELETE char 1 (reader, read-only) → 403
    tests.append(Test(headers={**h, "Authorization": "{rt}"},
        request="groups/{steps.0.id}/characters/{steps.2.id}", method="DELETE", requirement=FORBID))

    # 11. DELETE char 2 (writer, write access) → 200
    tests.append(Test(headers={**h, "Authorization": "{wt}"},
        request="groups/{steps.0.id}/characters/{steps.3.id}", method="DELETE", requirement=OK))

    # 12. Verify char 2 is gone
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.0.id}/characters/{steps.3.id}", method="GET", requirement=NOT_FOUND))

    steps = [GatewayStep(t) for t in tests]
    scenario = Scenario("CharacterFullAccess", steps, data)
    scenarios.append(scenario)
