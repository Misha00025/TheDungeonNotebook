from . import variables
from .request_tests import get_test, put_test, post_test, delete_test, rq, get_text
from .tests_data import tests



def start():
    for test in tests:
        res: rq.Response = None
        headers = test.headers
        params = test.params
        url = test.request
        data = test.data
        match test.method:
            case "GET":
                res = get_test(headers, params, url)
            case "PUT":
                res = put_test(headers, params, url, data)
            case "POST":
                res = post_test(headers, params, url, data)
            case "DELETE":
                res = delete_test(headers, params, url)

        if res == None or res.status_code != test.requirement:
            print("ERROR:", get_text(res, test.request, test.method, params=test.params))
        elif variables.debug:
            print(get_text(res, test.request, test.method, params=test.params))

