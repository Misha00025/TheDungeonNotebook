# Sync Service

Установка зависимостей и ручной запуск из корня репозитория:

```bash
make build-sync-service
pip install -r backend/sync-service/req.txt
cd backend/sync-service
uvicorn main:app --host 0.0.0.0 --port 8090
```

Для настройки используются переменные `GAME_SYSTEMS_SERVICE_URL`, `CAMPAIGN_SERVICE_URL`, `SYNC_X_SUBJECT` и `SYNC_STATE_FILE`. Задайте значения, подходящие вашему окружению; значения по умолчанию здесь не фиксируются.

[Публичная HTML-документация API](../../docs/api/sync.html)
