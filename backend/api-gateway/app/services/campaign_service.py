from requests import Response
import requests as rq


class ItemsEndpoints:
    def __init__(self, url: str, item_id = None):
        self._url: str = url + "/items"
        if item_id is not None:
            self._url += f"/{item_id}"
    
    def post(self, data) -> Response:
        raise NotImplementedError()
    
    def get(self) -> Response:
        raise NotImplementedError()
    
    def put(self, data) -> Response:
        raise NotImplementedError()
    
    def delete(self) -> Response:
        raise NotImplementedError()


class NotesEndpoints:
    def __init__(self, url: str, note_id: int = None):
        self._url: str = url + "/notes"
        if note_id is not None:
            self._url += f"/{note_id}"
    
    def post(self, data) -> Response:
        raise NotImplementedError()
    
    def get(self) -> Response:
        raise NotImplementedError()
    
    def put(self, data) -> Response:
        raise NotImplementedError()
    
    def delete(self) -> Response:
        raise NotImplementedError()


class TemplatesEndpoints:
    def __init__(self, url: str, template_id: int = None):
        self._url: str = url + "/templates"
        if template_id is not None:
            self._url += f"/{template_id}"
    
    def post(self, data) -> Response:
        raise NotImplementedError()
    
    def get(self) -> Response:
        raise NotImplementedError()
    
    def put(self, data) -> Response:
        raise NotImplementedError()
    
    def delete(self) -> Response:
        raise NotImplementedError()


class CharactersEndpoints:
    def __init__(self, url: str, character_id: int = None):
        self._url: str = url + f"/{character_id}/characters"
        if character_id is not None:
            self._url += f"/{character_id}"

    def templates(self, template_id = None) -> TemplatesEndpoints:
        return TemplatesEndpoints(self._url, template_id)
    
    def notes(self, note_id = None) -> NotesEndpoints:
        return NotesEndpoints(self._url, note_id)
    
    def items(self, item_id = None) -> ItemsEndpoints:
        return ItemsEndpoints(self._url, item_id)
    
    def post(self, data) -> Response:
        raise NotImplementedError()
    
    def get(self) -> Response:
        raise NotImplementedError()
    
    def patch(self, data) -> Response:
        raise NotImplementedError()
    
    def delete(self) -> Response:
        raise NotImplementedError()


class CampaignService: 
    def __init__(self, url: str, group_id: int = None):
        self._url: str = url + "/groups"
        if group_id is not None:
            self._url += f"/{group_id}"

    
    def characters(self, character_id: int = None) -> CharactersEndpoints:
        return CharactersEndpoints(self._url, character_id)
    
    def items(self, item_id: int = None) -> ItemsEndpoints:
        return ItemsEndpoints(self._url, item_id)
    
    def post(self, user_id, data) -> Response:
        raise NotImplementedError()
    
    def get(self) -> Response:
        raise NotImplementedError()
    
    def patch(self, data) -> Response:
        raise NotImplementedError()
    
    def delete(self) -> Response:
        raise NotImplementedError()