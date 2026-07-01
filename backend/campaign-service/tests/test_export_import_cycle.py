#!/usr/bin/env python3
"""
Сквозной тест экспорта → импорта.
1. Создаёт группу с данными (шаблон, персонаж, предмет, навык)
2. Экспортирует их
3. Создаёт новую группу
4. Импортирует туда JSON из шага 2 (с заменой groupId)
5. Проверяет GET-запросами, что данные появились в новой группе
"""

import sys
import json
import requests as rq

BASE = "http://127.0.0.1:5077"
h = {"Content-Type": "application/json; charset=utf-8"}

ok = True
test_num = 0

def check(label, res, expected_status):
    global ok, test_num
    test_num += 1
    status = res.status_code
    if status != expected_status:
        print(f"  FAIL [{test_num}] {label}: expected {expected_status}, got {status}")
        print(f"    Response: {res.text[:200]}")
        ok = False
    else:
        print(f"  PASS [{test_num}] {label}: {status}")
    return res

# ====== 1. Создаём группу и наполняем данными ======

res = check("Create group", rq.post(f"{BASE}/groups", headers=h, json={"name": "SrcGroup"}), 201)
src_group_id = res.json()["id"]

res = check("Create template", rq.post(f"{BASE}/groups/{src_group_id}/characters/templates", headers=h, json={
    "name": "Warrior", "description": "Strong fighter",
    "fields": {
        "strength": {"name": "Strength", "description": "Physical power", "value": 10},
        "agility": {"name": "Agility", "description": "Dexterity", "value": 12, "maxValue": 20}
    },
    "schema": {
        "categories": [
            {"key": "physical", "name": "Physical", "fields": ["strength", "agility"]}
        ]
    }
}), 201)
template_id = res.json()["id"]

res = check("Create character", rq.post(f"{BASE}/groups/{src_group_id}/characters", headers=h, json={
    "name": "Conan", "description": "Barbarian", "templateId": template_id
}), 201)

res = check("Create item", rq.post(f"{BASE}/groups/{src_group_id}/items", headers=h, json={
    "name": "Excalibur", "description": "Legendary sword", "price": 100,
    "attributes": [{"key": "type", "name": "Type", "value": "weapon"}]
}), 201)

res = check("Create skill", rq.post(f"{BASE}/groups/{src_group_id}/skills", headers=h, json={
    "name": "Fireball", "description": "FIRE!",
    "attributes": [{"key": "damage", "name": "Damage", "value": "10d8"}]
}), 201)

# ====== 2. Экспорт ======

res = check("Export all data", rq.get(f"{BASE}/groups/{src_group_id}/export", headers=h,
    params={"include": "templates,characters,items,skills"}), 200)

export_data = res.json()

# Дополнительная проверка: структура export_data
if "charlists" not in export_data:
    print("  FAIL: export_data missing 'charlists'")
    ok = False
elif len(export_data["charlists"]) == 0:
    print("  FAIL: export_data.charlists is empty")
    ok = False
else:
    print(f"  PASS: export contains {len(export_data.get('charlists', []))} templates, "
          f"{len(export_data.get('characters', []))} characters, "
          f"{len(export_data.get('items', []))} items, "
          f"{len(export_data.get('skills', []))} skills")
    # Проверяем что в exported data есть имена
    assert export_data["charlists"][0]["name"] == "Warrior"
    assert export_data["characters"][0]["name"] == "Conan"
    assert export_data["items"][0]["name"] == "Excalibur"
    assert export_data["skills"][0]["name"] == "Fireball"
    print("  PASS: exported data contains correct entity names")

# ====== 3. Создаём целевую группу ======

res = check("Create target group", rq.post(f"{BASE}/groups", headers=h, json={"name": "DstGroup"}), 201)
dst_group_id = res.json()["id"]

# ====== 4. Импорт — подставляем реальный JSON из экспорта, меняем groupId ======

import_body = dict(export_data)
import_body["groupId"] = dst_group_id

res = check("Import all data", rq.post(f"{BASE}/groups/{dst_group_id}/import", headers=h, json=import_body), 200)

import_result = res.json()
if not import_result.get("success", False):
    print(f"  FAIL: import reported errors: {import_result.get('errors', [])}")
    ok = False
else:
    print(f"  PASS: import successful: {import_result.get('imported', {})}")

# ====== 5. Верификация — проверяем что данные реально появились в целевой группе ======

res = check("Verify templates in dst", rq.get(f"{BASE}/groups/{dst_group_id}/characters/templates", headers=h), 200)
templates = res.json().get("templates", []) if isinstance(res.json(), dict) else res.json()
if len(templates) == 0:
    print("  FAIL: no templates found in target group after import")
    ok = False
else:
    # Проверяем что содержимое совпадает
    names = [t.get("name", "") for t in templates]
    if "Warrior" not in names:
        print(f"  FAIL: expected 'Warrior' in templates, got {names}")
        ok = False
    else:
        print(f"  PASS: verified template 'Warrior' in target group ({len(templates)} templates)")

res = check("Verify characters in dst", rq.get(f"{BASE}/groups/{dst_group_id}/characters", headers=h), 200)
chars = res.json().get("characters", []) if isinstance(res.json(), dict) else res.json()
if len(chars) == 0:
    print("  FAIL: no characters found in target group after import")
    ok = False
else:
    names = [c.get("name", "") for c in chars]
    if "Conan" not in names:
        print(f"  FAIL: expected 'Conan' in characters, got {names}")
        ok = False
    else:
        print(f"  PASS: verified character 'Conan' in target group ({len(chars)} characters)")

res = check("Verify items in dst", rq.get(f"{BASE}/groups/{dst_group_id}/items", headers=h), 200)
items = res.json().get("items", []) if isinstance(res.json(), dict) else res.json()
if len(items) == 0:
    print("  FAIL: no items found in target group after import")
    ok = False
else:
    names = [i.get("name", "") for i in items]
    if "Excalibur" not in names:
        print(f"  FAIL: expected 'Excalibur' in items, got {names}")
        ok = False
    else:
        print(f"  PASS: verified item 'Excalibur' in target group ({len(items)} items)")

res = check("Verify skills in dst", rq.get(f"{BASE}/groups/{dst_group_id}/skills", headers=h), 200)
skills = res.json().get("skills", []) if isinstance(res.json(), dict) else res.json()
if len(skills) == 0:
    print("  FAIL: no skills found in target group after import")
    ok = False
else:
    names = [s.get("name", "") for s in skills]
    if "Fireball" not in names:
        print(f"  FAIL: expected 'Fireball' in skills, got {names}")
        ok = False
    else:
        print(f"  PASS: verified skill 'Fireball' in target group ({len(skills)} skills)")

# ====== Итог ======
print()
if ok:
    print("ALL TESTS PASSED")
    sys.exit(0)
else:
    print("SOME TESTS FAILED")
    sys.exit(1)
