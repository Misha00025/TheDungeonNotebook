from tests.templates import Test, Scenario, GatewayStep
from tests.test_variables import *
from .jwt_helper import generate_token

h = {"Content-Type": "application/json; charset=utf-8"}
scenarios: list[Scenario] = []


def register_notes_scenario():
    admin_id = 8001
    user_id = 8002
    viewer_id = 8003

    admin_token = generate_token(admin_id)
    user_token = generate_token(user_id)
    viewer_token = generate_token(viewer_id)

    data = {
        "at": admin_token,
        "aid": admin_id,
        "ut": user_token,
        "uid": user_id,
        "vt": viewer_token,
        "vid": viewer_id,
    }

    tests = []

    # 0. Create admin user
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="users", method="POST",
        data={"firstName": "Notes", "lastName": "Admin", "nickname": "notes_admin"}, requirement=CREATED))

    # 1. Create user
    tests.append(Test(headers={**h, "Authorization": "{ut}"},
        request="users", method="POST",
        data={"firstName": "Notes", "lastName": "User", "nickname": "notes_user"}, requirement=CREATED))

    # 2. Create viewer
    tests.append(Test(headers={**h, "Authorization": "{vt}"},
        request="users", method="POST",
        data={"firstName": "Notes", "lastName": "Viewer", "nickname": "notes_viewer"}, requirement=CREATED))

    # 3. Create group (admin)
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups", method="POST",
        data={"name": "NotesTestGroup"}, requirement=CREATED))

    # 4. Create template
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.3.id}/characters/templates", method="POST",
        data={"name": "TestTemplate", "description": "For notes testing",
              "fields": {"str": {"name": "Strength", "description": "", "value": 10}}},
        requirement=CREATED))

    # 5. Create character 1 (admin)
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.3.id}/characters", method="POST",
        data={"name": "CharWithNotes", "description": "", "templateId": "{steps.4.id}"},
        requirement=CREATED))

    # 6. Create character 2 (admin)
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.3.id}/characters", method="POST",
        data={"name": "CharReadOnly", "description": "", "templateId": "{steps.4.id}"},
        requirement=CREATED))

    # 7. Add user to group
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.3.id}/users/{uid}", method="PUT",
        data={"isAdmin": False}, requirement=CREATED))

    # 8. Add viewer to group
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.3.id}/users/{vid}", method="PUT",
        data={"isAdmin": False}, requirement=CREATED))

    # 9. Give user write access to character 1
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.3.id}/characters/{steps.5.id}/users/{uid}", method="PUT",
        data={"canWrite": True}, requirement=CREATED))

    # 10. Give viewer read-only access to character 2
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.3.id}/characters/{steps.6.id}/users/{vid}", method="PUT",
        data={"canWrite": False}, requirement=CREATED))

    # === GROUP NOTES ===

    # 11. Admin creates group note → 201
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.3.id}/notes", method="POST",
        data={"header": "Group Note", "body": "Group body", "short_description": "Desc",
              "keywords": ["tag1", "tag2"]}, requirement=CREATED))

    # 12. Admin lists group notes → 200
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.3.id}/notes", method="GET", requirement=OK))

    # 13. Admin gets specific group note → 200
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.3.id}/notes/{steps.11.id}", method="GET", requirement=OK))

    # 14. Admin updates group note → 200
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.3.id}/notes/{steps.11.id}", method="PUT",
        data={"header": "Updated Group Note", "body": "Updated body"}, requirement=OK))

    # 15. Admin verifies update → 200
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.3.id}/notes/{steps.11.id}", method="GET", requirement=OK))

    # 16. Admin deletes group note → 200
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.3.id}/notes/{steps.11.id}", method="DELETE", requirement=OK))

    # 17. Admin verifies deletion → 404
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.3.id}/notes/{steps.11.id}", method="GET", requirement=NOT_FOUND))

    # 18. User creates group note (not admin) → 403
    tests.append(Test(headers={**h, "Authorization": "{ut}"},
        request="groups/{steps.3.id}/notes", method="POST",
        data={"header": "Should Fail", "body": "Nope"}, requirement=FORBID))

    # 19. Viewer creates group note (not admin) → 403
    tests.append(Test(headers={**h, "Authorization": "{vt}"},
        request="groups/{steps.3.id}/notes", method="POST",
        data={"header": "Should Fail", "body": "Nope"}, requirement=FORBID))

    # === CHARACTER NOTES ===

    # 20. Admin creates character note on char 1 → 201
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.3.id}/characters/{steps.5.id}/notes", method="POST",
        data={"header": "Char Note", "body": "Char body", "keywords": ["secret", "char"]},
        requirement=CREATED))

    # 21. User with write access creates note on char 1 → 201
    tests.append(Test(headers={**h, "Authorization": "{ut}"},
        request="groups/{steps.3.id}/characters/{steps.5.id}/notes", method="POST",
        data={"header": "User Note", "body": "User body"}, requirement=CREATED))

    # 22. Viewer (read-only) tries to create note on char 2 → 403
    tests.append(Test(headers={**h, "Authorization": "{vt}"},
        request="groups/{steps.3.id}/characters/{steps.6.id}/notes", method="POST",
        data={"header": "Evil Note", "body": "Nope"}, requirement=FORBID))

    # 23. Admin lists character notes → 200
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.3.id}/characters/{steps.5.id}/notes", method="GET", requirement=OK))

    # 24. Admin gets specific character note → 200
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.3.id}/characters/{steps.5.id}/notes/{steps.20.id}", method="GET", requirement=OK))

    # 25. Admin updates character note → 200
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.3.id}/characters/{steps.5.id}/notes/{steps.20.id}", method="PUT",
        data={"header": "Updated Char Note"}, requirement=OK))

    # 26. User with write access updates user's note → 200
    tests.append(Test(headers={**h, "Authorization": "{ut}"},
        request="groups/{steps.3.id}/characters/{steps.5.id}/notes/{steps.21.id}", method="PUT",
        data={"header": "User Updated"}, requirement=OK))

    # 27. Admin deletes character note → 200
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.3.id}/characters/{steps.5.id}/notes/{steps.20.id}", method="DELETE", requirement=OK))

    # 28. Admin verifies deletion → 404
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.3.id}/characters/{steps.5.id}/notes/{steps.20.id}", method="GET", requirement=NOT_FOUND))

    # === GROUP NOTES — member access ===

    # Admin creates a new group note for member access testing
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.3.id}/notes", method="POST",
        data={"header": "MemberNote", "body": "For member testing"}, requirement=CREATED))

    # GET /groups/{id}/notes (user, group_member) → 200
    tests.append(Test(headers={**h, "Authorization": "{ut}"},
        request="groups/{steps.3.id}/notes", method="GET", requirement=OK))

    # GET /groups/{id}/notes/{noteId} (user, not admin) → 403
    tests.append(Test(headers={**h, "Authorization": "{ut}"},
        request="groups/{steps.3.id}/notes/{steps.29.id}", method="GET", requirement=FORBID))

    # PUT /groups/{id}/notes/{noteId} (user, not admin) → 403
    tests.append(Test(headers={**h, "Authorization": "{ut}"},
        request="groups/{steps.3.id}/notes/{steps.29.id}", method="PUT",
        data={"header": "Stolen"}, requirement=FORBID))

    # DELETE /groups/{id}/notes/{noteId} (user, not admin) → 403
    tests.append(Test(headers={**h, "Authorization": "{ut}"},
        request="groups/{steps.3.id}/notes/{steps.29.id}", method="DELETE", requirement=FORBID))

    # === CHARACTER NOTES — viewer (read-only) access ===

    # Admin creates note on char_2 (viewer has read-only access)
    tests.append(Test(headers={**h, "Authorization": "{at}"},
        request="groups/{steps.3.id}/characters/{steps.6.id}/notes", method="POST",
        data={"header": "ViewerNote", "body": "For viewer testing"}, requirement=CREATED))

    # GET /.../characters/{charId}/notes (viewer, read-only) → 200
    tests.append(Test(headers={**h, "Authorization": "{vt}"},
        request="groups/{steps.3.id}/characters/{steps.6.id}/notes", method="GET", requirement=OK))

    # GET /.../notes/{noteId} (viewer, read-only) → 200
    tests.append(Test(headers={**h, "Authorization": "{vt}"},
        request="groups/{steps.3.id}/characters/{steps.6.id}/notes/{steps.34.id}", method="GET", requirement=OK))

    # PUT /.../notes/{noteId} (viewer, read-only) → 403
    tests.append(Test(headers={**h, "Authorization": "{vt}"},
        request="groups/{steps.3.id}/characters/{steps.6.id}/notes/{steps.34.id}", method="PUT",
        data={"header": "Stolen"}, requirement=FORBID))

    # DELETE /.../notes/{noteId} (viewer, read-only) → 403
    tests.append(Test(headers={**h, "Authorization": "{vt}"},
        request="groups/{steps.3.id}/characters/{steps.6.id}/notes/{steps.34.id}", method="DELETE", requirement=FORBID))

    # === CHARACTER NOTES — writer access ===

    # PUT /.../notes/{noteId} (write user on char_1) → 200
    tests.append(Test(headers={**h, "Authorization": "{ut}"},
        request="groups/{steps.3.id}/characters/{steps.5.id}/notes/{steps.21.id}", method="PUT",
        data={"header": "WriterUpdated"}, requirement=OK))

    # DELETE /.../notes/{noteId} (write user on char_1) → 200
    tests.append(Test(headers={**h, "Authorization": "{ut}"},
        request="groups/{steps.3.id}/characters/{steps.5.id}/notes/{steps.21.id}", method="DELETE", requirement=OK))

    steps = [GatewayStep(t) for t in tests]
    scenario = Scenario("Notes", steps, data)
    scenarios.append(scenario)


def create_notes_scenario():
    return scenarios
