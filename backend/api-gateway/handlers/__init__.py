"""Автоматический импорт всех пользовательских хендлеров.

Любой .py файл, добавленный в эту директорию, будет автоматически
импортирован при старте API Gateway. Это позволяет пользователям
добавлять свои access-хендлеры, response-хендлеры и трансформеры
просто создавая файлы в папке handlers/.
"""
import importlib
import pkgutil
import logging

logger = logging.getLogger(__name__)

for _imp, _modname, _ispkg in pkgutil.iter_modules(__path__):
    if _modname != "__init__":
        try:
            importlib.import_module(f".{_modname}", __package__)
            logger.debug("Auto-imported handler module: %s", _modname)
        except Exception as exc:
            logger.warning("Failed to import handler module '%s': %s", _modname, exc)
