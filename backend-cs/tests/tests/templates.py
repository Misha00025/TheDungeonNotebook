import requests
from .test_variables import DEBUG, default_debug
import tests.test_variables as tv


def get_http_status_message(status_code):
    # Создаем словарь для хранения сообщений по каждому статус-коду
    status_messages = {
        200: 'OK',
        201: 'Created',
        202: 'Accepted',
        204: 'No Content',
        301: 'Moved Permanently',
        302: 'Found',
        400: 'Bad Request',
        401: 'Unauthorized',
        403: 'Forbidden',
        404: 'Not Found',
        500: 'Internal Server Error'
    }
    
    return status_messages.get(status_code, 'Unknown Status Code')



class Test:
    def __init__(self,
                 request: str = "",
                 params: dict = {},
                 headers: dict = {},
                 data: dict = {},
                 method: str = "GET",
                 requirement: int = 200,
                 debug: bool = True,
                 is_valid: callable = None,
                 check_access: bool = False
                 ) -> None:
        self.request = request
        self.params = params.copy()
        if debug:
            self.params[DEBUG] = True 
        self.headers = headers.copy()
        self.method = method
        self.data = data
        self.check_access = check_access

        self.requirement = requirement
        self.message = "Nothing"
        # print(is_valid)
        self._is_valid = is_valid


    def check(self, res: requests.Response):
        correct_code = self.requirement == res.status_code
        if self._is_valid is None or not correct_code:
            self.message = get_http_status_message(res.status_code)
            return correct_code
        if tv.debug:
            print(f"DEBUG: Type of result: {type(res)} - {res.text}")
            print(f"DEBUG: Validation method name: {self._is_valid.__name__}")
        ok, self.message = self._is_valid(self, res)
        return ok