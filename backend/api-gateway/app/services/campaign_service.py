from requests import Response
import requests as rq


class ItemsEndpoints:
    def __init__(self, url: str, headers, item_id = None):
        self._url: str = url + "/items"
        self._headers = headers
        if item_id is not None:
            self._url += f"/{item_id}"
    
    def post(self, data) -> Response:
        return rq.post(self._url, headers=self._headers, data=data)
    
    def get(self) -> Response:
        return rq.get(self._url, headers=self._headers)
    
    def put(self, data) -> Response:
        return rq.put(self._url, headers=self._headers, data=data)
    
    def delete(self) -> Response:
        return rq.delete(self._url, headers=self._headers)


class NotesEndpoints:
    def __init__(self, url: str, headers, note_id: int = None):
        self._url: str = url + "/notes"
        self._headers = headers
        if note_id is not None:
            self._url += f"/{note_id}"
    
    def post(self, data) -> Response:
        return rq.post(self._url, headers=self._headers, data=data)
    
    def get(self) -> Response:
        return rq.get(self._url, headers=self._headers)
    
    def put(self, data) -> Response:
        return rq.put(self._url, headers=self._headers, data=data)
    
    def delete(self) -> Response:
        return rq.delete(self._url, headers=self._headers)


class TemplatesEndpoints:
    def __init__(self, url: str, headers, template_id: int = None):
        self._url: str = url + "/templates"
        self._headers = headers
        if template_id is not None:
            self._url += f"/{template_id}"

    def post(self, data) -> Response:
        return rq.post(self._url, headers=self._headers, data=data)
    
    def get(self) -> Response:
        return rq.get(self._url, headers=self._headers)
    
    def put(self, data) -> Response:
        return rq.put(self._url, headers=self._headers, data=data)
    
    def delete(self) -> Response:
        return rq.delete(self._url, headers=self._headers)


class CharactersEndpoints:
    def __init__(self, host: str, notes_host: str, url: str, headers, character_id: int = None):
        self._host: str = host
        self._notes_host: str = notes_host
        self._url: str = url + f"/characters"
        self._headers = headers
        if character_id is not None:
            self._url += f"/{character_id}"

    @property
    def url(self):
        return self._host + self._url

    def templates(self, template_id = None) -> TemplatesEndpoints:
        return TemplatesEndpoints(self.url, self._headers, template_id)
    
    def notes(self, note_id = None) -> NotesEndpoints:
        return NotesEndpoints(self._notes_host + self._url, self._headers, note_id)
    
    def items(self, item_id = None) -> ItemsEndpoints:
        return ItemsEndpoints(self.url, self._headers, item_id)
    
    def post(self, data) -> Response:
        return rq.post(self.url, headers=self._headers, data=data)
    
    def get(self) -> Response:
        return rq.get(self.url, headers=self._headers)
    
    def patch(self, data) -> Response:
        return rq.patch(self.url, headers=self._headers, data=data)
    
    def delete(self) -> Response:
        return rq.delete(self.url, headers=self._headers)


class CampaignService: 
    def __init__(self, host: str, notes_host: str, headers, group_id: int = None):
        self._host: str = host
        self._notes_host: str = notes_host
        self._url: str = "/groups"
        self._headers = headers
        if group_id is not None:
            self._url += f"/{group_id}"

    @property
    def url(self):
        return self._host + self._url
    
    def notes(self, note_id = None) -> NotesEndpoints:
        return NotesEndpoints(self._notes_host+self._url, note_id)

    def characters(self, character_id: int = None) -> CharactersEndpoints:
        return CharactersEndpoints(self._host, self._notes_host, self._url, self._headers, character_id)
    
    def items(self, item_id: int = None) -> ItemsEndpoints:
        return ItemsEndpoints(self.url, self._headers, item_id)
    
    def post(self, data) -> Response:
        return rq.post(self.url, headers=self._headers, data=data)
    
    def get(self) -> Response:
        return rq.get(self.url, headers=self._headers)
    
    def patch(self, data) -> Response:
        return rq.patch(self.url, headers=self._headers, data=data)
    
    def delete(self) -> Response:
        return rq.delete(self.url, headers=self._headers)