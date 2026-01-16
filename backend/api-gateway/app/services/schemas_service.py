from requests import Response
import requests as rq


class SchemaEndpoints:
    def __init__(self, url: str, target: str, headers, item_id = None):
        self._url: str = url + "/" + target
        self._headers = headers
        if item_id is not None:
            self._url += f"/{item_id}"
    
    def get(self, params = None) -> Response:
        if params is None:
            params = {}
        return rq.get(self._url, headers=self._headers, params=params)
    
    def put(self, data) -> Response:
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
    
    def items(self, item_id: int = None) -> SchemaEndpoints:
        return SchemaEndpoints(self.url, "items", self._headers, item_id)
    
    def skills(self, skill_id: int = None) -> SchemaEndpoints:
        return SchemaEndpoints(self.url, "skills", self._headers, skill_id)

    def template(self, skill_id: int = None) -> SchemaEndpoints:
        return SchemaEndpoints(self.url, "template", self._headers, skill_id)

class SchemasService:
    def __init__(self, host: str, headers):
        self._host: str = host
        self._url: str = f"/schemas"
        self._headers = headers

    def groups(self, group_id) -> CampaignEndpoint:
        return CampaignEndpoint(self._host, self._url, self._headers, group_id)
