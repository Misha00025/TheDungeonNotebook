from tests.templates import Test, Scenario, GatewayStep
from tests.test_variables import *
from tests.validators import has_str_id, has_fields, has_keys, is_list, is_error
from .jwt_helper import generate_token

h = {"Content-Type": "application/json; charset=utf-8"}
scenarios: list[Scenario] = []


def register_game_systems_scenario():
    admin_token, admin_id = generate_token()
    user_token, user_id = generate_token()

    data = {
        "at": admin_token,
        "aid": admin_id,
        "ut": user_token,
        "uid": user_id,
    }

    tests = []

    # 0. Create admin user (creator of the system -> becomes system admin)
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="users", method="POST",
        data={"firstName": "Admin", "lastName": "User", "nickname": "gs_admin"}, requirement=CREATED))

    # 1. Create regular user (not admin of the system)
    tests.append(Test(headers={**h, "Authorization": "{ut}"},
        request="users", method="POST",
        data={"firstName": "Regular", "lastName": "User", "nickname": "gs_user"}, requirement=CREATED))

    # === CRUD систем ===

    # 2. POST /systems (admin) -> 201, string id
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="systems", method="POST",
        data={"name": "DnD 5e", "description": "Dungeons & Dragons 5th edition", "icon": "d20"},
        requirement=CREATED,
        is_valid=has_str_id()))

    # 3. GET /systems -> 200, bare JSON list
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="systems", method="GET", requirement=OK,
        is_valid=is_list()))

    # 4. GET /systems/{id} -> 200
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="systems/{steps.2.id}", method="GET", requirement=OK,
        is_valid=has_str_id()))

    # 5. PATCH /systems/{id} (admin) -> 200, name updated
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="systems/{steps.2.id}", method="PATCH",
        data={"name": "DnD 5e (2024)"}, requirement=OK,
        is_valid=has_fields(name="DnD 5e (2024)")))

    # 6. POST /systems (user, not admin) -> 201 (collection-level allowed for any authenticated subject)
    tests.append(Test(headers={**h, "Authorization": "{ut}"},
        request="systems", method="POST",
        data={"name": "UserSystem", "description": "Created by regular user"},
        requirement=CREATED,
        is_valid=has_str_id()))

    # 7. PATCH /systems/{adminSystem} (user, not admin) -> 403
    tests.append(Test(headers={**h, "Authorization": "{ut}"},
        request="systems/{steps.2.id}", method="PATCH",
        data={"name": "Hacked"}, requirement=FORBID,
        is_valid=is_error()))

    # 8. DELETE /systems/{userSystem} (admin, not owner) -> 403
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="systems/{steps.6.id}", method="DELETE", requirement=FORBID,
        is_valid=is_error()))

    # 9. DELETE /systems/{adminSystem} (admin, owner) -> 200
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="systems/{steps.2.id}", method="DELETE", requirement=OK,
        is_valid=has_str_id()))

    # 10. GET /systems/{id} (after delete) -> 404
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="systems/{steps.2.id}", method="GET", requirement=NOT_FOUND,
        is_valid=is_error()))

    # === Версии и снимки ===

    # 11. Create a fresh system for version testing
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="systems", method="POST",
        data={"name": "Pathfinder 2e", "description": "PF2", "icon": "pf2"},
        requirement=CREATED,
        is_valid=has_str_id()))

    # 12. POST /systems/{id}/versions (admin) -> 201
    version_content = {
        "version": "1.0.0",
        "content": {
            "items": [
                {"name": "Longsword", "description": "A versatile blade", "price": 15, "rarity": "common",
                 "properties": {"damage": "1d8", "weight": 3, "magical": True, "bonuses": {"attack": 1}}}
            ],
            "skills": [
                {"name": "Athletics", "description": "Climb, jump, swim"}
            ],
            "character_template": {
                "fields": [
                    {"key": "strength", "label": "Strength", "type": "number", "formula": ""}
                ]
            }
        }
    }
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="systems/{steps.11.id}/versions", method="POST",
        data=version_content, requirement=CREATED,
        is_valid=has_str_id()))

    # 13. GET /systems/{id}/versions -> 200, bare list
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="systems/{steps.11.id}/versions", method="GET", requirement=OK,
        is_valid=is_list()))

    # 14. GET /systems/{id}/versions/{vid} -> 200
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="systems/{steps.11.id}/versions/{steps.12.id}", method="GET", requirement=OK,
        is_valid=has_str_id()))

    # 15. GET /systems/{id}/versions/{vid}/snapshot -> 200
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="systems/{steps.11.id}/versions/{steps.12.id}/snapshot", method="GET", requirement=OK,
        is_valid=has_keys("id", "content")))

    # 16. POST duplicate version -> 422 (version already exists)
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="systems/{steps.11.id}/versions", method="POST",
        data=version_content, requirement=UNPROCESSABLE,
        is_valid=is_error()))

    # 17. GET /systems/{id}/versions/{vid}/content -> 200
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="systems/{steps.11.id}/versions/{steps.12.id}/content", method="GET", requirement=OK,
        is_valid=has_keys("items", "skills", "character_template")))

    # === CRUD контента внутри версии ===

    # 18. PUT /content/items (replace list) -> 200
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="systems/{steps.11.id}/versions/{steps.12.id}/content/items", method="PUT",
        data=[
            {"name": "Longsword", "description": "A versatile blade", "price": 15,
             "properties": {"damage": "1d8", "weight": 3}},
            {"name": "Shield", "description": "Wooden shield", "price": 10}
        ],
        requirement=OK,
        is_valid=has_keys("items", "skills", "character_template")))

    # 19. GET /content -> 200, items now has 2 entries
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="systems/{steps.11.id}/versions/{steps.12.id}/content", method="GET", requirement=OK,
        is_valid=has_keys("items", "skills", "character_template")))

    # 20. PUT /content/skills (replace list) -> 200
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="systems/{steps.11.id}/versions/{steps.12.id}/content/skills", method="PUT",
        data=[
            {"name": "Athletics", "description": "Climb, jump, swim"},
            {"name": "Stealth", "description": "Move silently"}
        ],
        requirement=OK,
        is_valid=has_keys("items", "skills", "character_template")))

    # 21. PUT /content/character_template (replace) -> 200
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="systems/{steps.11.id}/versions/{steps.12.id}/content/character_template", method="PUT",
        data={"fields": [
            {"key": "strength", "label": "Strength", "type": "number", "formula": ""},
            {"key": "dexterity", "label": "Dexterity", "type": "number", "formula": ""}
        ]},
        requirement=OK,
        is_valid=has_keys("items", "skills", "character_template")))

    # 22. PUT /content/items (user, not admin) -> 403
    tests.append(Test(headers={**h, "Authorization": "{ut}"},
        request="systems/{steps.11.id}/versions/{steps.12.id}/content/items", method="PUT",
        data=[{"name": "Stolen", "price": 999}], requirement=FORBID,
        is_valid=is_error()))

    # 23. GET /systems/{id}/versions/{vid}/content (user, not admin) -> 403
    tests.append(Test(headers={**h, "Authorization": "{ut}"},
        request="systems/{steps.11.id}/versions/{steps.12.id}/content", method="GET", requirement=FORBID,
        is_valid=is_error()))

    steps = [GatewayStep(t) for t in tests]
    scenario = Scenario("GameSystems", steps, data)
    scenarios.append(scenario)
