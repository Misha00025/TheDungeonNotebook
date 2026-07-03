from tests.templates import Test, Scenario, GatewayStep
from tests.test_variables import *
from .auth_helper import register_or_auth

h = {"Content-Type": "application/json; charset=utf-8"}
scenarios: list[Scenario] = []


def register_notes_scenario():
    admin = register_or_auth("notes_admin", "Pass123")
    user = register_or_auth("notes_user", "Pass456")  
    viewer = register_or_auth("notes_viewer", "Pass789")

    data = {
        "at": admin["accessToken"],
        "aid": admin["id"],
        "ut": user["accessToken"],
        "uid": user["id"],
        "vt": viewer["accessToken"],
        "vid": viewer["id"],
    }

    tests = []

    # 0. Create group (admin)
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups", method="POST",
        data={"name": "NotesTestGroup"}, requirement=CREATED))

    # 1. Create template
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.0.id}/characters/templates", method="POST",
        data={"name": "TestTemplate", "description": "For notes testing",
              "fields": {"str": {"name": "Strength", "description": "", "value": 10}}},
        requirement=CREATED))

    # 2. Create character 1 (admin)
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.0.id}/characters", method="POST",
        data={"name": "CharWithNotes", "description": "", "templateId": "{steps.1.id}"},
        requirement=CREATED))

    # 3. Create character 2 (admin)
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.0.id}/characters", method="POST",
        data={"name": "CharReadOnly", "description": "", "templateId": "{steps.1.id}"},
        requirement=CREATED))

    # 4. Add user to group
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.0.id}/users/{uid}", method="PUT",
        data={"isAdmin": False}, requirement=CREATED))

    # 5. Add viewer to group
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.0.id}/users/{vid}", method="PUT",
        data={"isAdmin": False}, requirement=CREATED))

    # 6. Give user write access to character 1
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.0.id}/characters/{steps.2.id}/users/{uid}", method="PUT",
        data={"canWrite": True}, requirement=CREATED))

    # 7. Give viewer read-only access to character 2
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.0.id}/characters/{steps.3.id}/users/{vid}", method="PUT",
        data={"canWrite": False}, requirement=CREATED))

    # === GROUP NOTES ===

    # 8. Admin creates group note → 201
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.0.id}/notes", method="POST",
        data={"header": "Group Note", "body": "Group body", "short_description": "Desc",
              "keywords": ["tag1", "tag2"]}, requirement=CREATED))

    # 9. Admin lists group notes → 200
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.0.id}/notes", method="GET", requirement=OK))

    # 10. Admin gets specific group note → 200
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.0.id}/notes/{steps.8.id}", method="GET", requirement=OK))

    # 11. Admin updates group note → 200
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.0.id}/notes/{steps.8.id}", method="PUT",
        data={"header": "Updated Group Note", "body": "Updated body"}, requirement=OK))

    # 12. Admin verifies update → 200
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.0.id}/notes/{steps.8.id}", method="GET", requirement=OK))

    # 13. Admin deletes group note → 200
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.0.id}/notes/{steps.8.id}", method="DELETE", requirement=OK))

    # 14. Admin verifies deletion → 404
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.0.id}/notes/{steps.8.id}", method="GET", requirement=NOT_FOUND))

    # 15. User creates group note (not admin) → 403
    tests.append(Test(headers={**h, "Authorization": "{ut}"},
        request="groups/{steps.0.id}/notes", method="POST",
        data={"header": "Should Fail", "body": "Nope"}, requirement=FORBID))

    # 16. Viewer creates group note (not admin) → 403
    tests.append(Test(headers={**h, "Authorization": "{vt}"},
        request="groups/{steps.0.id}/notes", method="POST",
        data={"header": "Should Fail", "body": "Nope"}, requirement=FORBID))

    # === CHARACTER NOTES ===

    # 17. Admin creates character note on char 1 → 201
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.0.id}/characters/{steps.2.id}/notes", method="POST",
        data={"header": "Char Note", "body": "Char body", "keywords": ["secret", "char"]},
        requirement=CREATED))

    # 18. User with write access creates note on char 1 → 201
    tests.append(Test(headers={**h, "Authorization": "{ut}"},
        request="groups/{steps.0.id}/characters/{steps.2.id}/notes", method="POST",
        data={"header": "User Note", "body": "User body"}, requirement=CREATED))

    # 19. Viewer (read-only) tries to create note on char 2 → 403
    tests.append(Test(headers={**h, "Authorization": "{vt}"},
        request="groups/{steps.0.id}/characters/{steps.3.id}/notes", method="POST",
        data={"header": "Evil Note", "body": "Nope"}, requirement=FORBID))

    # 20. Admin lists character notes → 200
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.0.id}/characters/{steps.2.id}/notes", method="GET", requirement=OK))

    # 21. Admin gets specific character note → 200
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.0.id}/characters/{steps.2.id}/notes/{steps.17.id}", method="GET", requirement=OK))

    # 22. Admin updates character note → 200
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.0.id}/characters/{steps.2.id}/notes/{steps.17.id}", method="PUT",
        data={"header": "Updated Char Note"}, requirement=OK))

    # 23. User with write access updates user's note → 200
    tests.append(Test(headers={**h, "Authorization": "{ut}"},
        request="groups/{steps.0.id}/characters/{steps.2.id}/notes/{steps.18.id}", method="PUT",
        data={"header": "User Updated"}, requirement=OK))

    # 24. Admin deletes character note → 200
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.0.id}/characters/{steps.2.id}/notes/{steps.17.id}", method="DELETE", requirement=OK))

    # 25. Admin verifies deletion → 404
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.0.id}/characters/{steps.2.id}/notes/{steps.17.id}", method="GET", requirement=NOT_FOUND))

    # === GROUP NOTES — member access ===

    # Admin creates a new group note for member access testing
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.0.id}/notes", method="POST",
        data={"header": "MemberNote", "body": "For member testing"}, requirement=CREATED))

    # GET /groups/{id}/notes (user, group_member) → 200 — member может читать
    tests.append(Test(headers={**h, "Authorization": "{ut}"},
        request="groups/{steps.0.id}/notes", method="GET", requirement=OK))

    # GET /groups/{id}/notes/{noteId} (user, not admin) → 403
    tests.append(Test(headers={**h, "Authorization": "{ut}"},
        request="groups/{steps.0.id}/notes/{steps.26.id}", method="GET", requirement=FORBID))

    # PUT /groups/{id}/notes/{noteId} (user, not admin) → 403
    tests.append(Test(headers={**h, "Authorization": "{ut}"},
        request="groups/{steps.0.id}/notes/{steps.26.id}", method="PUT",
        data={"header": "Stolen"}, requirement=FORBID))

    # DELETE /groups/{id}/notes/{noteId} (user, not admin) → 403
    tests.append(Test(headers={**h, "Authorization": "{ut}"},
        request="groups/{steps.0.id}/notes/{steps.26.id}", method="DELETE", requirement=FORBID))

    # === CHARACTER NOTES — viewer (read-only) access ===

    # Admin creates note on char_2 (viewer has read-only access)
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.0.id}/characters/{steps.3.id}/notes", method="POST",
        data={"header": "ViewerNote", "body": "For viewer testing"}, requirement=CREATED))

    # GET /.../characters/{charId}/notes (viewer, read-only) → 200
    tests.append(Test(headers={**h, "Authorization": "{vt}"},
        request="groups/{steps.0.id}/characters/{steps.3.id}/notes", method="GET", requirement=OK))

    # GET /.../notes/{noteId} (viewer, read-only) → 200
    tests.append(Test(headers={**h, "Authorization": "{vt}"},
        request="groups/{steps.0.id}/characters/{steps.3.id}/notes/{steps.31.id}", method="GET", requirement=OK))

    # PUT /.../notes/{noteId} (viewer, read-only) → 403
    tests.append(Test(headers={**h, "Authorization": "{vt}"},
        request="groups/{steps.0.id}/characters/{steps.3.id}/notes/{steps.31.id}", method="PUT",
        data={"header": "Stolen"}, requirement=FORBID))

    # DELETE /.../notes/{noteId} (viewer, read-only) → 403
    tests.append(Test(headers={**h, "Authorization": "{vt}"},
        request="groups/{steps.0.id}/characters/{steps.3.id}/notes/{steps.31.id}", method="DELETE", requirement=FORBID))

    # === CHARACTER NOTES — writer access ===

    # PUT /.../notes/{noteId} (write user on char_1) → 200
    tests.append(Test(headers={**h, "Authorization": "{ut}"},
        request="groups/{steps.0.id}/characters/{steps.2.id}/notes/{steps.18.id}", method="PUT",
        data={"header": "WriterUpdated"}, requirement=OK))

    # DELETE /.../notes/{noteId} (write user on char_1) → 200
    tests.append(Test(headers={**h, "Authorization": "{ut}"},
        request="groups/{steps.0.id}/characters/{steps.2.id}/notes/{steps.18.id}", method="DELETE", requirement=OK))

    steps = [GatewayStep(t) for t in tests]
    scenario = Scenario("Notes", steps, data)
    scenarios.append(scenario)


def create_notes_scenario():
    return scenarios
