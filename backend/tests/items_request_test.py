from .request_tests import test, get_test, post_test, put_test, delete_test, headers_template, _st, _at, rq


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


    def ppd_tests(headers, params_1, params_2, compact):
        url = "items/"
        create = url+"create"
        name = "Test"
        description = "TestTest"
        post_test(headers, params_1, create, {"name": name}, compact)
        post_test(headers, params_1, create, {"description": description}, compact)
        post_test(headers, params_1, create, {"name": name, "description": description}, compact)
        post_test(headers, params_1, create, {"name": name, "description": description}, compact)
        post_test(headers, params_2, url+name, {"amount": 10}, compact)
        put_test(headers, params_2, url+name, {"name": name+"_wrong", "amount": 3}, compact)
        put_test(headers, params_2, url+name, {"name": name+"_wrong", "amount": "heh"}, compact)
        post_test(headers, params_2, url+name, {"amount": 2}, compact)
        delete_test(headers, params_2, url+name, compact)
        delete_test(headers, params_2, url+name, compact)
        put_test(headers, params_1, url+name, {"description": description+"_new"}, compact)
        put_test(headers, params_1, url+name, {"name": name+"_new"}, compact)
        delete_test(headers, params_1, url+name, compact)
        delete_test(headers, params_1, url+name+"_new", compact)
        delete_test(headers, params_1, url+name+"_new", compact)


    @test
    def group_ppd_tests(group_token, user_id, compact = False):
        headers = headers_template.copy()
        headers[_st] = group_token
        ppd_tests(headers, {}, {"user_id": user_id}, compact)


    @test
    def user_ppd_tests(user_token, group_id, owner_id, compact = False):
        headers = headers_template.copy()
        headers[_at] = user_token
        field = "group_id"
        ppd_tests(headers, {field: group_id}, {field: group_id, "owner_id": owner_id}, compact)


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
    group_ppd_tests("1", "tester", compact)
    group_ppd_tests("2", "tester", compact)
    group_ppd_tests("2", "tester_2", compact)
    user_ppd_tests("1", "-100", "test_user", compact)
    user_ppd_tests("1", "-101", "test_user", compact)
    user_ppd_tests("1", "-100", "tester", compact)
    user_ppd_tests("1", "-101", "tester", compact)
    user_ppd_tests("2", "-100", "test_user", compact)
    user_ppd_tests("2", "-101", "test_user", compact)
    user_ppd_tests("2", "-100", "tester", compact)
    user_ppd_tests("2", "-101", "tester", compact)
    user_ppd_tests("2", "-101", "1", compact)
    

