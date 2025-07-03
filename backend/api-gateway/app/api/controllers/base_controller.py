import requests


class BaseController:
    def __init__(self):
        pass

    def _parse_response(self, response: requests.Response) -> tuple[int, dict]:
        pass