import random
from .validation import *
from .templates import Test
from .test_variables import *

tests:list[Test]=[]

def user_extend(tests:list):
    tests.extend([
        Test(headers=uh, request=f"users/{mu}", is_valid=check_user_data),
        Test(headers=uh, request=f"users/{su}", requirement=FORBID),
        Test(headers=uh, request=f"users/{mu}/groups", is_valid=check_many_groups, check_access=True),
    ])

def group_extend(tests:list):
    tests.extend([
        Test(headers=uh, request=f"groups/{mg}"),
        Test(headers=uh, request=f"groups/{sg}"),
        Test(headers=uh, request=f"groups/{ssg}", requirement=FORBID),
        Test(headers=uh, request=f"groups/{mg}/characters", is_valid=check_many_characters),
        Test(headers=uh, request=f"groups/{sg}/characters", is_valid=check_many_characters),
        Test(headers=uh, request=f"groups/{ssg}/characters", requirement=FORBID),
        Test(headers=uh, request=f"groups/{mg}/characters", method="POST", data={"name": "Test", "description": "TestTest"}, requirement=CREATED),
        Test(headers=uh, request=f"groups/{sg}/characters", method="POST", data={"name": "Test2", "description": "Test2Test2"}, requirement=FORBID),
        Test(headers=uh, request=f"groups/{mg}", method="DELETE", requirement=OK),
        Test(headers=uh, request=f"groups/{sg}", method="DELETE", requirement=FORBID),
        Test(headers=uh, request=f"groups/{sg}", method="DELETE", requirement=FORBID),
        Test(headers=uh, request=f"groups/{mg}/users/{su}", method="POST", requirement=CREATED, debug=False),
        Test(headers=uh, request=f"groups/{mg}/users/{su}", method="DELETE", requirement=OK, debug=False),
    ])

def characters_extend(tests:list):
    tests.extend([
        Test(headers=uh, request=f"characters/{mc}", requirement=OK, is_valid=check_character_data),
        Test(headers=uh, request=f"characters/{sc}", requirement=OK, is_valid=check_character_data),
        Test(headers=uh, request=f"characters/{mc}", params={WITH_OWNERS:True}, requirement=OK, is_valid=check_character_data),
        Test(headers=uh, request=f"characters/{sc}", params={WITH_OWNERS:True}, is_valid=check_character_data),
        Test(headers=uh, request=f"characters/{ssc}", requirement=FORBID),
        Test(headers=uh, request=f"characters/{mc}", method="DELETE", requirement=OK), # OK
        Test(headers=uh, request=f"characters/{sc}", method="DELETE", requirement=FORBID),
        Test(headers=uh, request=f"characters/{ssc}", method="DELETE", requirement=FORBID),
        Test(headers=uh, request=f"characters/{sc}/owners", requirement=FORBID),
        Test(headers=uh, request=f"characters/{mc}/owners", requirement=OK),
        Test(headers=uh, request=f"characters/{mc}/owners", method="POST", requirement=NOT_ALLOW),
        Test(headers=uh, request=f"characters/{mc}/owners", method="DELETE", requirement=NOT_ALLOW),
        Test(headers=uh, request=f"characters/{mc}/owners/{su}", method="POST", requirement=CREATED, debug=False),
        Test(headers=uh, request=f"characters/{mc}/owners/{su}", method="DELETE", requirement=OK, debug=False),
    ])

def notes_extend(tests:list):
    tests.extend([
        Test(headers=uh, request=f"characters/{mc}/notes", requirement=OK),
        Test(headers=uh, request=f"characters/{sc}/notes", requirement=OK),
        Test(headers=uh, request=f"characters/{ssc}/notes", requirement=FORBID),
        Test(headers=uh, request=f"characters/{mc}/notes", method="POST", data={"header": "test1", "body": "testttttt2"}, requirement=CREATED, debug=False), # CREATED
        Test(headers=uh, request=f"characters/{sc}/notes", method="POST", requirement=FORBID),
        Test(headers=uh, request=f"characters/{ssc}/notes", method="POST", requirement=FORBID),
        Test(headers=uh, request=f"characters/{mc}/notes/1", requirement=OK),
        Test(headers=uh, request=f"characters/{mc}/notes/1", method="PUT", data={"header": f"test {random.randint(1, 100)}"}, requirement=OK, debug=False),
        Test(headers=uh, request=f"characters/{mc}/notes/2", method="PUT", data={"body": f"test {random.randint(1, 100)}"}, requirement=OK, debug=False),
        Test(headers=uh, request=f"characters/{mc}/notes/3", method="PUT", data={"header": f"test {random.randint(1, 100)}","body": f"test {random.randint(1, 100)}"}, requirement=OK, debug=False),
        Test(headers=uh, request=f"characters/{mc}/notes/1", method="DELETE", requirement=OK),
        Test(headers=uh, request=f"characters/{sc}/notes/1", requirement=OK),    
        Test(headers=uh, request=f"characters/{sc}/notes/1", method="PUT", requirement=FORBID),
    ])


def inventories_extend(tests:list):
    tests.extend([
        Test(headers=uh, request=f"characters/{mc}/inventories", requirement=OK),
        Test(headers=uh, request=f"characters/{sc}/inventories", requirement=OK),
        Test(headers=uh, request=f"characters/{ssc}/inventories", requirement=FORBID),
        Test(headers=uh, request=f"characters/{mc}/inventories", method="POST", requirement=CREATED),
        Test(headers=uh, request=f"characters/{sc}/inventories", method="POST", requirement=FORBID),
        Test(headers=uh, request=f"characters/{ssc}/inventories", method="POST", requirement=FORBID),
        Test(headers=uh, request=f"characters/{mc}/inventories/{1}", requirement=OK),
        Test(headers=uh, request=f"characters/{sc}/inventories/{2}", requirement=OK),
        Test(headers=uh, request=f"characters/{ssc}/inventories/{3}", requirement=FORBID),
        Test(headers=uh, request=f"characters/{mc}/inventories/{2}", requirement=NOT_FOUND),
        Test(headers=uh, request=f"characters/{mc}/inventories/{4}", method="DELETE", requirement=OK),
        Test(headers=uh, request=f"characters/{sc}/inventories/{2}", method="DELETE", requirement=FORBID),
    ])

# user_extend(tests)
# group_extend(tests)
# characters_extend(tests)
notes_extend(tests)
# inventories_extend(tests)