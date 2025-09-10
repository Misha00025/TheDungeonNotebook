from requests import Response
import requests as rq


class UsersService: 
    def __init__(self, url: str, headers, user_id: int = None):
        self._url: str = url + "/users"
        if user_id is not None:
            self._url += f"/{user_id}"
        self._headers = headers
    
    def post(self, data=None, json=None) -> Response:
        return rq.post(self._url, headers=self._headers, data=data, json=json)
    
    def get(self, params = None) -> Response:
        return rq.get(self._url, headers=self._headers, params=params)
    
    def patch(self, data) -> Response:
        return rq.patch(self._url, headers=self._headers, data=data)
    
    def delete(self) -> Response:
        return rq.delete(self._url)