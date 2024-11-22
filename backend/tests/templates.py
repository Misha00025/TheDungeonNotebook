import requests
from .test_variables import DEBUG, default_debug


class Test:
    def __init__(self,
                 request: str = "",
                 params: dict = {},
                 headers: dict = {},
                 data: dict = {},
                 method: str = "GET",
                 requirement: int = 200,
                 debug: bool = None,
                 is_valid: callable = None
                 ) -> None:
        self.request = request
        self.params = params.copy()
        self.params[DEBUG] = default_debug == True if debug is None else debug
        self.headers = headers.copy()
        self.method = method
        self.data = data

        self.requirement = requirement
        self._is_valid = is_valid


    def check(self, res: requests.Response):
        correct_code = self.requirement == res.status_code
        if self._is_valid is None:
            return correct_code
        return self._is_valid(self, res) and correct_code