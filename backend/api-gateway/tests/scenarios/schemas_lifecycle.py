from tests.templates import Test, Scenario, GatewayStep
from tests.test_variables import *
from .auth_helper import register_or_auth

h = {"Content-Type": "application/json; charset=utf-8"}
scenarios: list[Scenario] = []


def register_schemas_scenario():
    admin = register_or_auth("schema_admin", "Pass123")
    user = register_or_auth("schema_user", "Pass456")

    data = {
        "at": admin["accessToken"],
        "aid": admin["id"],
        "ut": user["accessToken"],
        "uid": user["id"],
    }

    tests = []

    # 0. Create group
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups", method="POST",
        data={"name": "SchemaGroup", "description": "For schemas testing"}, requirement=CREATED))

    # 0.5 Add user to group
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.0.id}/users/{uid}", method="PUT",
        data={"isAdmin": False}, requirement=CREATED))

    schema_items = {"groupBy": ["strength", "dexterity", "price"]}
    schema_skills = {"groupBy": ["stealth", "perception"]}
    schema_template = {"categories": [{"name": "Stats", "fields": ["Strength", "Dexterity", "Intellect"]}]}

    # 1. PUT /groups/{id}/schemas/items (admin) → 200
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.0.id}/schemas/items", method="PUT",
        data=schema_items, requirement=OK))

    # 2. GET /groups/{id}/schemas/items → 200
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.0.id}/schemas/items", method="GET", requirement=OK))

    # 3. PUT /groups/{id}/schemas/skills (admin) → 200
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.0.id}/schemas/skills", method="PUT",
        data=schema_skills, requirement=OK))

    # 4. GET /groups/{id}/schemas/skills → 200
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.0.id}/schemas/skills", method="GET", requirement=OK))

    # 5. PUT /groups/{id}/schemas/template (admin) → 200
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.0.id}/schemas/template", method="PUT",
        data=schema_template, requirement=OK))

    # 6. GET /groups/{id}/schemas/template → 200
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.0.id}/schemas/template", method="GET", requirement=OK))

    # 7. PUT /groups/{id}/schemas/items (user, not admin) → 403
    tests.append(Test(headers={**h, "Authorization": "{ut}"},
        request="groups/{steps.0.id}/schemas/items", method="PUT",
        data=schema_items, requirement=FORBID))

    # 8. PUT /groups/{id}/schemas/skills (user, not admin) → 403
    tests.append(Test(headers={**h, "Authorization": "{ut}"},
        request="groups/{steps.0.id}/schemas/skills", method="PUT",
        data=schema_skills, requirement=FORBID))

    # 9. PUT /groups/{id}/schemas/template (user, not admin) → 403
    tests.append(Test(headers={**h, "Authorization": "{ut}"},
        request="groups/{steps.0.id}/schemas/template", method="PUT",
        data=schema_template, requirement=FORBID))

    steps = [GatewayStep(t) for t in tests]
    scenario = Scenario("SchemasLifecycle", steps, data)
    scenarios.append(scenario)
