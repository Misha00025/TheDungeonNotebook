from requests import Response
import requests as rq


class UsersService: 
    def __init__(self, url: str, user_id: int = None):
        self._url: str = url + "/users"
        if user_id is not None:
            self._url += f"/{user_id}"
    
    def post(self, data) -> Response:
        raise NotImplementedError()
    
    def get(self) -> Response:
        raise NotImplementedError()
    
    def patch(self, data) -> Response:
        raise NotImplementedError()
    
    def delete(self) -> Response:
        raise NotImplementedError()