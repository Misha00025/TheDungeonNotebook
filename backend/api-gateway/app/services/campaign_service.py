from requests import Response
import requests as rq


class ItemsEndpoints:
    def __init__(self, url: str, owner_id: int):
        self._url: str = url + f"/{owner_id}/items"

    def all(self) -> Response:
        raise NotImplementedError()
    
    def post(self, data) -> Response:
        raise NotImplementedError()
    
    def get(self, item_id: int) -> Response:
        raise NotImplementedError()
    
    def put(self, item_id: int, data) -> Response:
        raise NotImplementedError()
    
    def delete(self, item_id: int) -> Response:
        raise NotImplementedError()


class NotesEndpoints:
    def __init__(self, url: str, character_id: int):
        self._url: str = url + f"/{character_id}/notes"

    def all(self) -> Response:
        raise NotImplementedError()
    
    def post(self, data) -> Response:
        raise NotImplementedError()
    
    def get(self, note_id: int) -> Response:
        raise NotImplementedError()
    
    def put(self, note_id: int, data) -> Response:
        raise NotImplementedError()
    
    def delete(self, note_id: int) -> Response:
        raise NotImplementedError()


class TemplatesEndpoints:
    def __init__(self, url: str):
        self._url: str = url + "/templates"

    def all(self) -> Response:
        raise NotImplementedError()
    
    def post(self, data) -> Response:
        raise NotImplementedError()
    
    def get(self, template_id: int) -> Response:
        raise NotImplementedError()
    
    def put(self, template_id: int, data) -> Response:
        raise NotImplementedError()
    
    def delete(self, template_id: int) -> Response:
        raise NotImplementedError()


class CharactersEndpoints:
    def __init__(self, url: str, group_id: int):
        self._url: str = url + f"/{group_id}/characters"

    def templates(self) -> TemplatesEndpoints:
        return TemplatesEndpoints(self._url)
    
    def notes(self, character_id) -> NotesEndpoints:
        return NotesEndpoints(self._url, character_id)
    
    def items(self, character_id) -> ItemsEndpoints:
        return ItemsEndpoints(self._url, character_id)

    def all(self) -> Response:
        raise NotImplementedError()
    
    def post(self, data) -> Response:
        raise NotImplementedError()
    
    def get(self, character_id: int) -> Response:
        raise NotImplementedError()
    
    def patch(self, character_id: int, data) -> Response:
        raise NotImplementedError()
    
    def delete(self, character_id: int) -> Response:
        raise NotImplementedError()


class CampaignService: 
    def __init__(self, url: str):
        self._url: str = url + "/groups"
    
    def characters(self, group_id) -> CharactersEndpoints:
        return CharactersEndpoints(self._url, group_id)
    
    def items(self, group_id) -> ItemsEndpoints:
        return ItemsEndpoints(self._url, group_id)

    def all(self) -> Response:
        raise NotImplementedError()
    
    def post(self, data) -> Response:
        raise NotImplementedError()
    
    def get(self, group_id: int) -> Response:
        raise NotImplementedError()
    
    def patch(self, group_id: int, data) -> Response:
        raise NotImplementedError()
    
    def delete(self, group_id: int) -> Response:
        raise NotImplementedError()