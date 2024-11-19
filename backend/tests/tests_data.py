from .request_tests import headers_template, _st, _at

DEBUG = "debug"


class Test:
    def __init__(self,
                 request: str = "",
                 params: dict = {},
                 headers: dict = {},
                 data: dict = {},
                 method: str = "GET",
                 requirement: int = 200,
                 debug: bool = True
                 ) -> None:
        self.request = request
        self.params = params
        self.params[DEBUG] = debug
        self.headers = headers
        self.method = method
        self.data = data

        self.requirement = requirement

uh = headers_template.copy()
uh[_at] = "1"

gh = headers_template.copy()
gh[_st] = "1"

mu = 1
su = 2

mg = -101
sg = -100
ssg = 218984657

mc = 10
sc = 9
ssc = 8

USER_ID = "user_id"
OWNER_ID = "owner_id"
GROUP_ID = "group_id"
CHARACTER_ID = "character_id"

OK = 200
FORBID = 403
CREATED = 201
NOT_ALLOW = 405
BAD = 400

tests:list[Test]=[
    Test(headers=uh, request=f"users/{mu}"),
    Test(headers=uh, request=f"users/{su}", requirement=FORBID),
    Test(headers=uh, request=f"users/{mu}/groups"),

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

    Test(headers=uh, request=f"characters/{mc}", requirement=OK),
    Test(headers=uh, request=f"characters/{sc}", requirement=OK),
    Test(headers=uh, request=f"characters/{ssc}", requirement=FORBID),
    Test(headers=uh, request=f"characters/{mc}", method="DELETE", requirement=FORBID), # OK
    Test(headers=uh, request=f"characters/{sc}", method="DELETE", requirement=FORBID),
    Test(headers=uh, request=f"characters/{ssc}", method="DELETE", requirement=FORBID),
    Test(headers=uh, request=f"characters/{mc}/notes", requirement=OK),
    Test(headers=uh, request=f"characters/{sc}/notes", requirement=OK),
    Test(headers=uh, request=f"characters/{ssc}/notes", requirement=FORBID),
    Test(headers=uh, request=f"characters/{mc}/inventories", requirement=OK),
    Test(headers=uh, request=f"characters/{sc}/inventories", requirement=OK),
    Test(headers=uh, request=f"characters/{ssc}/inventories", requirement=FORBID),
    Test(headers=uh, request=f"characters/{mc}/notes", method="POST", requirement=OK), # CREATED
    Test(headers=uh, request=f"characters/{sc}/notes", method="POST", requirement=FORBID),
    Test(headers=uh, request=f"characters/{ssc}/notes", method="POST", requirement=FORBID),
    Test(headers=uh, request=f"characters/{mc}/inventories", method="POST", requirement=CREATED),
    Test(headers=uh, request=f"characters/{sc}/inventories", method="POST", requirement=FORBID),
    Test(headers=uh, request=f"characters/{ssc}/inventories", method="POST", requirement=FORBID),
    Test(headers=uh, request=f"characters/{sc}/owners", requirement=FORBID),
    Test(headers=uh, request=f"characters/{mc}/owners", requirement=OK),
    Test(headers=uh, request=f"characters/{mc}/owners", method="POST", requirement=NOT_ALLOW),
    Test(headers=uh, request=f"characters/{mc}/owners", method="DELETE", requirement=NOT_ALLOW),
    Test(headers=uh, request=f"characters/{mc}/owners/{su}", method="POST", requirement=OK),
    Test(headers=uh, request=f"characters/{mc}/owners/{su}", method="DELETE", requirement=OK),

    Test(headers=uh, request=f"characters/{mc}/notes/1", requirement=OK),
    Test(headers=uh, request=f"characters/{mc}/notes/1", method="PUT", requirement=OK),
    Test(headers=uh, request=f"characters/{mc}/notes/1", method="DELETE", requirement=OK),
    Test(headers=uh, request=f"characters/{sc}/notes/1", requirement=OK),
    Test(headers=uh, request=f"characters/{sc}/notes/1", method="PUT", requirement=FORBID),
    Test(headers=uh, request=f"characters/{sc}/notes/1", method="DELETE", requirement=FORBID),
]