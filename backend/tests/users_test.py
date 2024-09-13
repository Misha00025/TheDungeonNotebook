from .request_tests import test, headers_template, _at, _st, get_test, post_test, delete_test

def start():
    urls_get = [
        "users", "users/test_user", "users/tester"
    ]
    @test
    def user_get_tests(user_token, compact = False):
        headers = headers_template.copy()
        headers[_at] = user_token
        for url in urls_get:
            get_test(headers, {}, url, compact)

    @test
    def group_get_tests(group_token, compact = False):
        headers = headers_template.copy()
        headers[_st] = group_token
        for url in urls_get:
            get_test(headers, None, url, compact)

    @test
    def group_pd_tests(group_token, compact = False):
        headers = headers_template.copy()
        headers[_st] = group_token
        get_test(headers, {}, "users", compact)
        post_test(headers, {}, "users", {"userId": "tester"}, compact)
        post_test(headers, {}, "users", {"userId": "tester"}, compact)
        get_test(headers, {}, "users", compact)
        delete_test(headers, {}, "users/tester", compact)
        delete_test(headers, {}, "users/tester", compact)
        get_test(headers, {}, "users", compact)


    compact = False
    user_get_tests("1", compact)
    user_get_tests("2", compact)
    group_get_tests("1", compact)
    group_get_tests("2", compact)

    group_pd_tests("1", compact)
    