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

OWNER_ID = "owner_id"
GROUP_ID = "group_id"

tests:list[Test]=[
    Test(headers=uh, request="user/", params={OWNER_ID:1}),
    Test(headers=uh, request="user/", params={OWNER_ID:2}, requirement=403),
    Test(headers=gh, request="user/", params={OWNER_ID:1}, requirement=403),
    Test(headers=gh, request="user/", params={OWNER_ID:2}, requirement=403),
    Test(headers=uh, request="user/groups", params={OWNER_ID:1}),
    Test(headers=uh, request="group", params={GROUP_ID:-101}),
    Test(headers=uh, request="group", params={GROUP_ID:-100}),
    Test(headers=uh, request="group", params={GROUP_ID:218984657}, requirement=403),
    Test(headers=uh, request="group/characters", params={GROUP_ID:-101}),
    Test(headers=uh, request="group/characters", params={GROUP_ID:-100}),
    Test(headers=uh, request="group/characters", params={GROUP_ID:218984657}, requirement=403),
    Test(headers=uh, request="group/characters", params={GROUP_ID:-101}, method="POST", requirement=201),
    Test(headers=uh, request="group/characters", params={GROUP_ID:-100}, method="POST", requirement=403),

]