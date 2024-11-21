from .templates import Test
from .test_variables import *




tests:list[Test]=[]
tests.extend([
    Test(headers=uh, request=f"users/{mu}"),
    Test(headers=uh, request=f"users/{su}", requirement=FORBID),
    Test(headers=uh, request=f"users/{mu}/groups"),
])
tests.extend([
    Test(headers=uh, request=f"groups/{mg}"),
    Test(headers=uh, request=f"groups/{sg}"),
    Test(headers=uh, request=f"groups/{ssg}", requirement=FORBID),
    Test(headers=uh, request=f"groups/{mg}/characters"),
    Test(headers=uh, request=f"groups/{sg}/characters"),
    Test(headers=uh, request=f"groups/{ssg}/characters", requirement=FORBID),
    Test(headers=uh, request=f"groups/{mg}/characters", method="POST", requirement=CREATED),
    Test(headers=uh, request=f"groups/{sg}/characters", method="POST", requirement=FORBID),
    Test(headers=uh, request=f"groups/{mg}", method="DELETE", requirement=OK),
    Test(headers=uh, request=f"groups/{sg}", method="DELETE", requirement=FORBID),
    Test(headers=uh, request=f"groups/{sg}", method="DELETE", requirement=FORBID),
])
tests.extend([
    Test(headers=uh, request=f"characters/{mc}", requirement=OK),
    Test(headers=uh, request=f"characters/{sc}", requirement=OK),
    Test(headers=uh, request=f"characters/{ssc}", requirement=FORBID),
    Test(headers=uh, request=f"characters/{mc}", method="DELETE", requirement=OK), # OK
    Test(headers=uh, request=f"characters/{sc}", method="DELETE", requirement=FORBID),
    Test(headers=uh, request=f"characters/{ssc}", method="DELETE", requirement=FORBID),
    Test(headers=uh, request=f"characters/{mc}/inventories", requirement=OK),
    Test(headers=uh, request=f"characters/{sc}/inventories", requirement=OK),
    Test(headers=uh, request=f"characters/{ssc}/inventories", requirement=FORBID),
    Test(headers=uh, request=f"characters/{mc}/inventories", method="POST", requirement=CREATED),
    Test(headers=uh, request=f"characters/{sc}/inventories", method="POST", requirement=FORBID),
    Test(headers=uh, request=f"characters/{ssc}/inventories", method="POST", requirement=FORBID),
    Test(headers=uh, request=f"characters/{sc}/owners", requirement=FORBID),
    Test(headers=uh, request=f"characters/{mc}/owners", requirement=OK),
    Test(headers=uh, request=f"characters/{mc}/owners", method="POST", requirement=NOT_ALLOW),
    Test(headers=uh, request=f"characters/{mc}/owners", method="DELETE", requirement=NOT_ALLOW),
    Test(headers=uh, request=f"characters/{mc}/owners/{su}", method="POST", requirement=OK),
    Test(headers=uh, request=f"characters/{mc}/owners/{su}", method="DELETE", requirement=OK),
])
tests.extend([
    Test(headers=uh, request=f"characters/{mc}/notes", requirement=OK),
    Test(headers=uh, request=f"characters/{sc}/notes", requirement=OK),
    Test(headers=uh, request=f"characters/{ssc}/notes", requirement=FORBID),
    Test(headers=uh, request=f"characters/{mc}/notes", method="POST", requirement=CREATED), # CREATED
    Test(headers=uh, request=f"characters/{sc}/notes", method="POST", requirement=FORBID),
    Test(headers=uh, request=f"characters/{ssc}/notes", method="POST", requirement=FORBID),
    Test(headers=uh, request=f"characters/{mc}/notes/1", requirement=OK),
    Test(headers=uh, request=f"characters/{mc}/notes/1", method="PUT", requirement=OK),
    Test(headers=uh, request=f"characters/{mc}/notes/1", method="DELETE", requirement=OK),
    Test(headers=uh, request=f"characters/{sc}/notes/1", requirement=OK),    
    Test(headers=uh, request=f"characters/{sc}/notes/1", method="PUT", requirement=FORBID),
])