from .request_tests import test, headers_template, _at, _st, get_test, post_test, delete_test

def start():
    urls_get = [
        "groups", "groups/-100", "groups/-101"
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

    compact = False
    user_get_tests("1", compact)
    user_get_tests("2", compact)
    group_get_tests("1", compact)
    group_get_tests("2", compact)