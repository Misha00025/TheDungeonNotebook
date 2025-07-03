from requests import Response
import requests as rq


class CharacterPolicesEndpoints:
    def __init__(self, url):
        self._url = url
        self._full_url = url + "/characters"

    def put(self, group_id: int, user_id: int, character_id: int, data) -> Response:
        raise NotImplementedError()

    def delete(self, group_id: int, user_id: int, character_id: int) -> Response:
        raise NotImplementedError()


class GroupPolicesEndpoints:
    def __init__(self, url):
        self._url = url + "/groups"

    def all(self, group_id: int = None, user_id: int = None) -> Response:
        raise NotImplementedError()

    def put(self, group_id: int, user_id: int, data) -> Response:
        raise NotImplementedError()

    def delete(self, group_id: int, user_id: int) -> Response:
        raise NotImplementedError()

    def characters(self) -> CharacterPolicesEndpoints:
        return CharacterPolicesEndpoints(self._url)
    

class PolicyService:
    def __init__(self, url):
        self._url = url + "/polices"

    def groups(self) -> GroupPolicesEndpoints:
        return GroupPolicesEndpoints(self._url)


