
from requests import Response
import requests as rq


class AuthService: 
    def __init__(self, url: str, headers):
        self._url: str = url + "/auth"
        self._headers = headers

    def register(self, data) -> Response:
        return rq.post(self._url + "/register", data=data, headers=self._headers)

    def login(self, data: dict[str, object]) -> Response:
        return rq.post(self._url + "/login", data=data, headers=self._headers)

    def refresh(self, token: str) -> Response:
        return rq.post(self._url + "/token/refresh", json={"RefreshToken": token}, headers=self._headers)

    def check(self, token: str) -> Response:
        return rq.get(self._url + "/check", params={"accessToken": token}, headers=self._headers)

    def service_token(self, group_id, data) -> Response:
        return rq.post(self._url + f"/groups/{group_id}/service-token/generate", data=data, headers=self._headers)

    def logout(self) -> Response:
        return rq.delete(self._url + f"/logout", headers=self._headers)
    
    