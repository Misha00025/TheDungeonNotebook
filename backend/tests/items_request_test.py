from .request_tests import test, get_test, headers_template, _st, _at, rq


def start():

    urls_get = [
        "items", "items/64", "items/65",
        "items/101_test", "items/100_test"
    ]


    @test
    def user_get_tests(user_token, groups = ["-100"], compact = False):
        headers = headers_template.copy()
        headers[_at] = user_token
        for url in urls_get:
            for group_id in groups:
                payload = {"group_id": group_id}
                get_test(headers, payload, url, compact)


    @test
    def user_get_user_tests(user_token, groups = ["-100"], owner_id="", compact = False):
        headers = headers_template.copy()
        headers[_at] = user_token
        for url in urls_get:
            for group_id in groups:
                payload = {"group_id": group_id, "owner_id": owner_id}
                get_test(headers, payload, url, compact)


    @test
    def group_get_tests(group_token, compact = False):
        headers = headers_template.copy()
        headers[_st] = group_token
        for url in urls_get:
            get_test(headers, None, url, compact)


    @test
    def group_get_user_tests(group_token, users = ["1"], compact = False):
        headers = headers_template.copy()
        headers[_st] = group_token
        for url in urls_get:
            for user in users:
                get_test(headers, {"user_id": user}, url, compact)

    compact = True
    user_get_tests("1", groups=["-100"], compact=compact)
    user_get_tests("1", groups=["-101"], compact=compact)
    user_get_tests("2", groups=["-100"], compact=compact)
    user_get_tests("2", groups=["-101"], compact=compact)
    user_get_user_tests("1", groups=["-100"], owner_id="test_user", compact=compact)
    user_get_user_tests("1", groups=["-100"], owner_id="tester", compact=compact)
    user_get_user_tests("1", groups=["-101"], owner_id="test_user", compact=compact)
    user_get_user_tests("1", groups=["-101"], owner_id="tester", compact=compact)
    user_get_user_tests("2", groups=["-100"], owner_id="test_user", compact=compact)
    user_get_user_tests("2", groups=["-100"], owner_id="tester", compact=compact)
    user_get_user_tests("2", groups=["-101"], owner_id="test_user", compact=compact)
    user_get_user_tests("2", groups=["-101"], owner_id="tester", compact=compact)
    group_get_tests("1", compact=compact)
    group_get_tests("2", compact=compact)
    group_get_user_tests("1", users=["test_user"], compact=compact)
    group_get_user_tests("1", users=["tester"], compact=compact)
    group_get_user_tests("2", users=["test_user"], compact=compact)
    group_get_user_tests("2", users=["tester"], compact=compact)
