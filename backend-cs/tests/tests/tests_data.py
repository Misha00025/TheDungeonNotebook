import random
from .validation import *
from .templates import Test
from .test_variables import *


def user_extend(tests:list):
    tests.extend([
        Test(headers=gh, request=f"account", requirement=FORBID),
        Test(headers=nah, request=f"account", requirement=NOT_AUTH),
        Test(headers=uh, request=f"account", is_valid=check_user_data),
        Test(headers=uh, request=f"account/groups", is_valid=check_many_groups),
    ])

def group_extend(tests:list):
    tests.extend([
        Test(headers=uh, request=f"groups/{ssg}", requirement=FORBID),
        Test(headers=gh, request=f"groups/{sg}", requirement=FORBID),
        Test(headers=uh, request=f"groups/{sg}/users", requirement=FORBID),
        Test(headers=uh, request=f"groups/{sg}/items", requirement=FORBID),

        Test(headers=gh, request=f"groups/{mg}", is_valid=check_group_data),
        Test(headers=uh, request=f"groups/{mg}", is_valid=check_group_data),
        Test(headers=uh, request=f"groups/{mg}/users", is_valid=check_many_users),
        Test(headers=uh, request=f"groups/{mg}/characters", is_valid=check_many_characters),
        Test(headers=uh, request=f"groups/{mg}/characters/templates", is_valid=check_many_templates),
        Test(headers=uh, request=f"groups/{sg}/characters/templates", is_valid=check_many_templates),
        Test(headers=uh, request=f"groups/{mg}/items", is_valid=check_many_items),
    ])

def characters_extend(tests:list):
    tests.extend([
        Test(headers=uh, request=f"characters/{mc}", requirement=OK, is_valid=check_character_data),
        Test(headers=uh, request=f"characters/{mc}/items", requirement=OK, is_valid=check_many_amounted_items),
        Test(headers=uh, request=f"characters/{mc}/notes", requirement=OK, is_valid=check_many_notes),
    ])