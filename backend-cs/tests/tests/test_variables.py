from variables import _st, _at
headers_template = {"Content-Type": "application/json; charset=utf-8"}


DEBUG = "debug"
USER_ID = "user_id"
OWNER_ID = "owner_id"
GROUP_ID = "group_id"
CHARACTER_ID = "character_id"

WITH_OWNERS = "with_owners"

OK = 200
CREATED = 201
BAD = 400
NOT_AUTH = 401
FORBID = 403
NOT_FOUND = 404
NOT_ALLOW = 405


default_debug = True
compact = False
debug = False

nah = headers_template.copy()

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

