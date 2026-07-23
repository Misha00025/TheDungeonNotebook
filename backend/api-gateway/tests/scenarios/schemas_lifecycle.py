from tests.templates import Test, Scenario, GatewayStep
from tests.test_variables import *
from .jwt_helper import generate_token

h = {"Content-Type": "application/json; charset=utf-8"}
scenarios: list[Scenario] = []


def register_schemas_scenario():
    admin_token, admin_id = generate_token()
    user_token, user_id = generate_token()

    data = {
        "at": admin_token,
        "aid": admin_id,
        "ut": user_token,
        "uid": user_id,
    }

    tests = []

    # 0. Create admin user
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="users", method="POST",
        data={"firstName": "Admin", "lastName": "User", "nickname": "schema_admin"}, requirement=CREATED))

    # 1. Create regular user
    tests.append(Test(headers={**h, "Authorization": "{ut}"},
        request="users", method="POST",
        data={"firstName": "Regular", "lastName": "User", "nickname": "schema_user"}, requirement=CREATED))

    # 2. Create group
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups", method="POST",
        data={"name": "SchemaGroup", "description": "For schemas testing"}, requirement=CREATED))

    # 3. Add user to group
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.2.id}/users/{uid}", method="PUT",
        data={"isAdmin": False}, requirement=CREATED))

    schema_items = {"groupBy": ["strength", "dexterity", "price"]}
    schema_skills = {"groupBy": ["stealth", "perception"]}
    schema_template = {"categories": [{"name": "Stats", "fields": ["Strength", "Dexterity", "Intellect"]}]}

    # 4. PUT /groups/{id}/schemas/items (admin) → 200
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.2.id}/schemas/items", method="PUT",
        data=schema_items, requirement=OK))

    # 5. GET /groups/{id}/schemas/items → 200
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.2.id}/schemas/items", method="GET", requirement=OK))

    # 6. PUT /groups/{id}/schemas/skills (admin) → 200
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.2.id}/schemas/skills", method="PUT",
        data=schema_skills, requirement=OK))

    # 7. GET /groups/{id}/schemas/skills → 200
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.2.id}/schemas/skills", method="GET", requirement=OK))

    # 8. PUT /groups/{id}/schemas/template (admin) → 200
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.2.id}/schemas/template", method="PUT",
        data=schema_template, requirement=OK))

    # 9. GET /groups/{id}/schemas/template → 200
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.2.id}/schemas/template", method="GET", requirement=OK))

    # 10. PUT /groups/{id}/schemas/items (user, not admin) → 403
    tests.append(Test(headers={**h, "Authorization": "{ut}"},
        request="groups/{steps.2.id}/schemas/items", method="PUT",
        data=schema_items, requirement=FORBID))

    # 11. PUT /groups/{id}/schemas/skills (user, not admin) → 403
    tests.append(Test(headers={**h, "Authorization": "{ut}"},
        request="groups/{steps.2.id}/schemas/skills", method="PUT",
        data=schema_skills, requirement=FORBID))

    # 12. PUT /groups/{id}/schemas/template (user, not admin) → 403
    tests.append(Test(headers={**h, "Authorization": "{ut}"},
        request="groups/{steps.2.id}/schemas/template", method="PUT",
        data=schema_template, requirement=FORBID))

    steps = [GatewayStep(t) for t in tests]
    scenario = Scenario("SchemasLifecycle", steps, data)
    scenarios.append(scenario)
