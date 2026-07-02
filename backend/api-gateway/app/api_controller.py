"""
Контроллер API — хелперы для работы с ответами и схемой API.

Содержит только то, что используется движком и response-хендлерами.
Вся маршрутизация теперь в декларативном engine (app/engine/).
"""

_info: dict[str, list] = {}
import requests


def get_routers_info():
    """Возвращает схему всех зарегистрированных API-методов."""
    return _info


def make_response(result: requests.Response):
    """Конвертирует requests.Response в (data, status_code) для Flask."""
    try:
        return result.json(), result.status_code
    except requests.exceptions.JSONDecodeError:
        return result.content, result.status_code
