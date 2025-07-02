
from requests import Response
import requests as rq


class AuthService: 
    def __init__(self, url: str):
        self._url: str = url + "/auth"

    def register(self, data: dict[str, object]) -> Response:
        raise NotImplementedError()

    def login(self, data: dict[str, object]) -> Response:
        raise NotImplementedError()

    def refresh(self, token: str) -> Response:
        raise NotImplementedError()

    def check(self, token: str) -> Response:
        raise NotImplementedError()

    def service_token(self, group_id, access, years) -> Response:
        raise NotImplementedError()

    def logout(self, user_id) -> Response:
        raise NotImplementedError()
    
    