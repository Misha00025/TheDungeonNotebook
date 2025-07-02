from requests import Response
import requests as rq


class UsersService: 
    def __init__(self, url: str):
        self._url: str = url + "/users"

    def all(self) -> Response:
        raise NotImplementedError()
    
    def post(self, data) -> Response:
        raise NotImplementedError()
    
    def get(self, user_id: int) -> Response:
        raise NotImplementedError()
    
    def patch(self, user_id: int, data) -> Response:
        raise NotImplementedError()
    
    def delete(self, user_id: int) -> Response:
        raise NotImplementedError()