from .request_tests import headers_template, _st, _at

class Test:
    def __init__(self,
                 request: str = "",
                 params: dict = {},
                 headers: dict = {},
                 data: dict = {},
                 method: str = "GET",
                 requirement: int = 200
                 ) -> None:
        self.request = request
        self.params = params
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
DEBUG = "debug"

OK = 200
FORBID = 403
CREATED = 201
BAD = 400

tests:list[Test]=[
    Test(headers=uh, request="user/", params={USER_ID:mu}),
    Test(headers=uh, request="user/", params={USER_ID:su}, requirement=FORBID),
    Test(headers=uh, request="user/groups", params={USER_ID:mu}),

    Test(headers=uh, request="group", params={GROUP_ID:mg}),
    Test(headers=uh, request="group", params={GROUP_ID:sg}),
    Test(headers=uh, request="group", params={GROUP_ID:ssg}, requirement=FORBID),
    Test(headers=uh, request="group/characters", params={GROUP_ID:mg}),
    Test(headers=uh, request="group/characters", params={GROUP_ID:sg}),
    Test(headers=uh, request="group/characters", params={GROUP_ID:ssg}, requirement=FORBID),
    Test(headers=uh, request="group/characters", params={GROUP_ID:mg}, method="POST", requirement=CREATED),
    Test(headers=uh, request="group/characters", params={GROUP_ID:sg}, method="POST", requirement=FORBID),
    Test(headers=uh, request="group", params={GROUP_ID:mg, DEBUG:True}, method="DELETE", requirement=OK),
    Test(headers=uh, request="group", params={GROUP_ID:sg}, method="DELETE", requirement=FORBID),
    Test(headers=uh, request="group", params={GROUP_ID:sg, DEBUG:True}, method="DELETE", requirement=FORBID),

    Test(headers=uh, request="character", params={CHARACTER_ID:mc}, requirement=OK),
    Test(headers=uh, request="character", params={CHARACTER_ID:sc}, requirement=OK),
    Test(headers=uh, request="character", params={CHARACTER_ID:ssc}, requirement=FORBID),
    Test(headers=uh, request="character", params={CHARACTER_ID:mc, DEBUG:True}, method="DELETE", requirement=OK),
    Test(headers=uh, request="character", params={CHARACTER_ID:sc, DEBUG:True}, method="DELETE", requirement=FORBID),
    Test(headers=uh, request="character", params={CHARACTER_ID:ssc, DEBUG:True}, method="DELETE", requirement=FORBID),
    Test(headers=uh, request="character/notes", params={CHARACTER_ID:mc}, requirement=OK),
    Test(headers=uh, request="character/notes", params={CHARACTER_ID:sc}, requirement=OK),
    Test(headers=uh, request="character/notes", params={CHARACTER_ID:ssc}, requirement=FORBID),
    Test(headers=uh, request="character/inventories", params={CHARACTER_ID:mc}, requirement=OK),
    Test(headers=uh, request="character/inventories", params={CHARACTER_ID:sc}, requirement=OK),
    Test(headers=uh, request="character/inventories", params={CHARACTER_ID:ssc}, requirement=FORBID),
    Test(headers=uh, request="character/notes", params={CHARACTER_ID:mc}, method="POST", requirement=CREATED),
    Test(headers=uh, request="character/notes", params={CHARACTER_ID:sc}, method="POST", requirement=FORBID),
    Test(headers=uh, request="character/notes", params={CHARACTER_ID:ssc}, method="POST", requirement=FORBID),
    Test(headers=uh, request="character/inventories", params={CHARACTER_ID:mc}, method="POST", requirement=CREATED),
    Test(headers=uh, request="character/inventories", params={CHARACTER_ID:sc}, method="POST", requirement=FORBID),
    Test(headers=uh, request="character/inventories", params={CHARACTER_ID:ssc}, method="POST", requirement=FORBID),
    Test(headers=uh, request="character/owners", params={CHARACTER_ID:sc}, requirement=FORBID),
    Test(headers=uh, request="character/owners", params={CHARACTER_ID:mc}, requirement=OK),
    Test(headers=uh, request="character/owners", params={CHARACTER_ID:mc}, method="POST", requirement=BAD),
    Test(headers=uh, request="character/owners", params={CHARACTER_ID:mc}, method="DELETE", requirement=BAD),
    Test(headers=uh, request="character/owners", params={CHARACTER_ID:mc, OWNER_ID: su}, method="POST", requirement=OK),
    Test(headers=uh, request="character/owners", params={CHARACTER_ID:mc, OWNER_ID: su}, method="DELETE", requirement=OK),

    Test(headers=uh, request="character/note/1", params={CHARACTER_ID:mc}, requirement=OK),
    Test(headers=uh, request="character/note/1", params={CHARACTER_ID:mc}, method="PUT", requirement=OK),
    Test(headers=uh, request="character/note/1", params={CHARACTER_ID:mc}, method="DELETE", requirement=OK),
    Test(headers=uh, request="character/note/1", params={CHARACTER_ID:sc}, requirement=OK),
    Test(headers=uh, request="character/note/1", params={CHARACTER_ID:sc}, method="PUT", requirement=FORBID),
    Test(headers=uh, request="character/note/1", params={CHARACTER_ID:sc}, method="DELETE", requirement=FORBID),
]