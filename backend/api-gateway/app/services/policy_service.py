import json
from requests import Response
import requests as rq


class CharacterPolicesEndpoints:
    def __init__(self, url, headers):
        self._url = url
        self._full_url = url + "/characters"
        self._headers = headers

    def put(self, group_id: int, user_id: int, character_id: int, data: bytes) -> Response:
        params = json.loads(data)
        params["groupId"] = group_id
        params["userId"] = user_id
        params["characterId"] = character_id
        return rq.put(self._url, headers=self._headers, json=params)

    def delete(self, group_id: int, user_id: int, character_id: int) -> Response:
        params = {}
        params["groupId"] = group_id
        params["userId"] = user_id
        params["characterId"] = character_id
        return rq.delete(self._url, headers=self._headers, params=params)


class GroupPolicesEndpoints:
    def __init__(self, url, headers):
        self._url = url + "/groups"
        self._headers = headers

    def all(self, group_id: int = None, user_id: int = None) -> Response:
        params = {}
        if group_id is not None:
            params["groupId"] = group_id
        if user_id is not None:
            params["userId"] = user_id
        return rq.get(self._url, headers=self._headers, params=params)

    def put(self, group_id: int, user_id: int, data: bytes) -> Response:
        params = json.loads(data)
        params["groupId"] = group_id
        params["userId"] = user_id
        return rq.put(self._url, headers=self._headers, json=params)

    def delete(self, group_id: int, user_id: int) -> Response:
        params = {}
        params["groupId"] = group_id
        params["userId"] = user_id
        return rq.delete(self._url, headers=self._headers, params=params)

    def characters(self) -> CharacterPolicesEndpoints:
        return CharacterPolicesEndpoints(self._url, self._headers)
    

class PolicyService:
    def __init__(self, url, headers):
        self._url = url + "/polices"
        self._headers = headers

    def groups(self) -> GroupPolicesEndpoints:
        return GroupPolicesEndpoints(self._url, self._headers)


