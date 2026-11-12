from tests.templates import Test, Scenario, GatewayStep, Step, replace_placeholders, get_text
from tests.test_variables import *
from tests.validators import has_str_id, has_list, has_keys, is_error
from .jwt_helper import generate_token
import requests
import time
import variables

h = {"Content-Type": "application/json; charset=utf-8"}
scenarios: list[Scenario] = []


class SyncPollStep(Step):
    """Опрашивает GET /sync/{job_id} до завершения задачи (completed/failed)."""

    def __init__(self, test, timeout=30, interval=1):
        super().__init__(test)
        self.timeout = timeout
        self.interval = interval

    def execute(self, _data):
        test = self.test
        url = replace_placeholders(test.request, _data)
        processed_headers = {}
        for k, v in test.headers.items():
            processed_headers[k] = replace_placeholders(str(v), _data)
        base = variables.server_url.rstrip("/")
        start = time.time()
        last = None
        job = {}
        while time.time() - start < self.timeout:
            last = requests.get(f"{base}/{url}", headers=processed_headers)
            try:
                job = last.json()
            except Exception:
                job = {}
            if job.get("status") in ("completed", "failed"):
                break
            time.sleep(self.interval)
        self.ok = last is not None and last.status_code == 200 and job.get("status") == "completed"
        self.message = get_text(last, url, "GET")
        return last


# --- Валидаторы результата синхронизации ---

def job_status_completed():
    def validator(test, res):
        data = res.json()
        if data.get("status") != "completed":
            return False, f"Expected completed, got {data}"
        return True, "OK"
    return validator


def job_result_contains(field, *items):
    def validator(test, res):
        data = res.json()
        result = data.get("result") or {}
        lst = result.get(field, [])
        for it in items:
            if it not in lst:
                return False, f"Expected '{it}' in result.{field}, got {lst}"
        return True, "OK"
    return validator


def job_previous_version(expected):
    def validator(test, res):
        data = res.json()
        result = data.get("result") or {}
        if result.get("previous_version_id") != expected:
            return False, f"Expected previous_version_id={expected!r}, got {result.get('previous_version_id')!r}"
        return True, "OK"
    return validator


def items_count(n):
    def validator(test, res):
        data = res.json()
        items = data.get("items", [])
        if len(items) != n:
            return False, f"Expected {n} items, got {len(items)}: {items}"
        return True, "OK"
    return validator


def job_not_found():
    """sync-service возвращает FastAPI-ошибку вида {'detail': ...}."""
    def validator(test, res):
        data = res.json()
        if "detail" not in data:
            return False, f"Expected error detail, got {data}"
        return True, "OK"
    return validator


def register_sync_scenario():
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
        data={"firstName": "Admin", "lastName": "User", "nickname": "sync_admin"}, requirement=CREATED))

    # 1. Create regular user
    tests.append(Test(headers={**h, "Authorization": "{ut}"},
        request="users", method="POST",
        data={"firstName": "Regular", "lastName": "User", "nickname": "sync_user"}, requirement=CREATED))

    # 2. Create group (target of sync)
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups", method="POST",
        data={"name": "SyncGroup", "description": "Sync target"}, requirement=CREATED))

    # 3. Create game system
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="systems", method="POST",
        data={"name": "SyncSystem", "description": "For sync testing", "icon": "sync"},
        requirement=CREATED,
        is_valid=has_str_id()))

    # 4. Create version 1.0.0 with content
    version1 = {
        "version": "1.0.0",
        "content": {
            "items": [
                {"name": "Longsword", "description": "A versatile blade", "price": 15}
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
        request="systems/{steps.3.id}/versions", method="POST",
        data=version1, requirement=CREATED,
        is_valid=has_str_id()))

    # 5. POST /sync (version 1 -> group) -> 200, job_id
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="sync", method="POST",
        data={"system_id": "{steps.3.id}", "version_id": "{steps.4.id}", "group_id": "{steps.2.id}"},
        requirement=OK,
        is_valid=has_keys("job_id", "status")))

    # 6. Poll job -> completed, created items/skills/template, no previous version
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="sync/{steps.5.job_id}", method="GET", requirement=OK,
        is_valid=job_status_completed()))
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="sync/{steps.5.job_id}", method="GET", requirement=OK,
        is_valid=job_result_contains("created", "item:Longsword", "skill:Athletics", "template")))
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="sync/{steps.5.job_id}", method="GET", requirement=OK,
        is_valid=job_previous_version(None)))

    # 7. Verify copies landed in the group
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.2.id}/items", method="GET", requirement=OK,
        is_valid=has_list("items")))
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.2.id}/skills", method="GET", requirement=OK,
        is_valid=has_list("skills")))
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.2.id}/characters/templates", method="GET", requirement=OK,
        is_valid=has_list("templates")))

    # 8. Create version 2.0.0 with changed content (Longsword price up, +Shield, +Stealth, template +field)
    version2 = {
        "version": "2.0.0",
        "content": {
            "items": [
                {"name": "Longsword", "description": "A versatile blade", "price": 20},
                {"name": "Shield", "description": "Wooden shield", "price": 10}
            ],
            "skills": [
                {"name": "Athletics", "description": "Climb, jump, swim"},
                {"name": "Stealth", "description": "Move silently"}
            ],
            "character_template": {
                "fields": [
                    {"key": "strength", "label": "Strength", "type": "number", "formula": ""},
                    {"key": "dexterity", "label": "Dexterity", "type": "number", "formula": ""}
                ]
            }
        }
    }
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="systems/{steps.3.id}/versions", method="POST",
        data=version2, requirement=CREATED,
        is_valid=has_str_id()))

    # 9. POST /sync (version 2 -> same group)
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="sync", method="POST",
        data={"system_id": "{steps.3.id}", "version_id": "{steps.12.id}", "group_id": "{steps.2.id}"},
        requirement=OK,
        is_valid=has_keys("job_id", "status")))

    # 10. Poll job -> completed; Longsword updated, Shield/Stealth created, previous_version_id = v1
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="sync/{steps.13.job_id}", method="GET", requirement=OK,
        is_valid=job_status_completed()))
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="sync/{steps.13.job_id}", method="GET", requirement=OK,
        is_valid=job_result_contains("updated", "item:Longsword")))
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="sync/{steps.13.job_id}", method="GET", requirement=OK,
        is_valid=job_result_contains("created", "item:Shield", "skill:Stealth")))
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="sync/{steps.13.job_id}", method="GET", requirement=OK,
        is_valid=job_previous_version("{steps.4.id}")))

    # 11. Verify group now has 2 items (Longsword updated + Shield added, no duplicates)
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.2.id}/items", method="GET", requirement=OK,
        is_valid=items_count(2)))

    # 12. GET /sync (list) -> 200
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="sync", method="GET", requirement=OK,
        is_valid=has_keys("jobs")))

    # 13. GET /sync/{nonexistent} -> 404
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="sync/does-not-exist", method="GET", requirement=NOT_FOUND,
        is_valid=job_not_found()))

    steps = []
    for t in tests:
        if isinstance(t, Test) and t.request.startswith("sync/") and t.method == "GET" and "job_id" in t.request:
            steps.append(SyncPollStep(t))
        else:
            steps.append(GatewayStep(t))

    scenario = Scenario("Sync", steps, data)
    scenarios.append(scenario)
