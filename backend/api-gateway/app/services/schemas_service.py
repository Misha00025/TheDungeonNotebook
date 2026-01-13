from requests import Response
import requests as rq


class ItemsEndpoints:
    def __init__(self, url: str, headers, item_id = None):
        self._url: str = url + "/items"
        self._headers = headers
        if item_id is not None:
            self._url += f"/{item_id}"
    
    def get(self, params = None) -> Response:
        if params is None:
            params = {}
        return rq.get(self._url, headers=self._headers, params=params)
    
    def put(self, data) -> Response:
        return rq.put(self._url, headers=self._headers, data=data)

class SkillsEndpoint:
    def __init__(self, url: str, headers, skill_id: int = None):
        self._url: str = url + "/skills"
        self._headers = headers
        if skill_id is not None:
            self._url += f"/{skill_id}"
    
    def get(self, params = None) -> Response:
        if params is None:
            params = {}
        return rq.get(self._url, headers=self._headers, params=params)
    
    def put(self, data = None) -> Response:
        if data is None:
            return rq.put(self._url, headers=self._headers)
        else:
            return rq.put(self._url, headers=self._headers, data=data)


class CampaignEndpoint: 
    def __init__(self, host: str, url: str, headers, group_id: int):
        self._host: str = host
        self._url: str = url + "/groups"
        self._headers = headers
        if group_id is not None:
            self._url += f"/{group_id}"

    @property
    def url(self):
        return self._host + self._url
    
    def items(self, item_id: int = None) -> ItemsEndpoints:
        return ItemsEndpoints(self.url, self._headers, item_id)
    
    def skills(self, skill_id: int = None) -> SkillsEndpoint:
        return SkillsEndpoint(self.url, self._headers, skill_id)

class SchemasService:
    def __init__(self, host: str, headers):
        self._host: str = host
        self._url: str = f"/schemas"
        self._headers = headers

    def groups(self, group_id) -> CampaignEndpoint:
        return CampaignEndpoint(self._host, self._url, self._headers, group_id)
