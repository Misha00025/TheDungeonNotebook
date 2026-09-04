# sync-service

Оркестратор-мост между **game-systems** и **campaign**. Только синхронизация,
запускается явно пользователем (ГМ нажимает «Синхронизировать»). Функционал
схож с git, но не обязан быть быстрым.

## Что делает

Берёт версию игровой системы из game-systems (контент: `items`, `skills`,
`character_template`) и применяет её к группе в campaign:

- **сравнение** — по имени (предметы/навыки) и по ключу поля (шаблон);
- **обновление** существующих копий, **добавление** недостающих;
- **без удаления** — ничего не удаляется из группы;
- **связь со старой версией** — запоминается предыдущая синхронизированная
  версия системы для этой группы (история).

## API

| Метод | Путь | Описание |
|-------|------|----------|
| POST | `/sync` | Запустить синхронизацию (асинхронно). Body: `{system_id, version_id, group_id}` |
| GET  | `/sync/{job_id}` | Статус и результат задачи |
| GET  | `/sync` | Список всех запусков |

Ответ `POST /sync` возвращает `job_id` сразу; результат доступен по
`GET /sync/{job_id}` (статусы: `running` / `completed` / `failed`).

## Конфигурация (env)

| Переменная | По умолчанию | Описание |
|------------|--------------|----------|
| `GAME_SYSTEMS_SERVICE_URL` | `http://game-systems-service:8080` | URL game-systems |
| `CAMPAIGN_SERVICE_URL` | `http://campaign-service:8080` | URL campaign |
| `SYNC_X_SUBJECT` | `{"type":"admin","id":0}` | Субъект, от имени которого идёт синхронизация |
| `SYNC_STATE_FILE` | `/data/sync_state.json` | Файл состояния (какие версии применены к каким группам) |

## Запуск

```bash
cd backend/sync-service
pip install -r req.txt
uvicorn main:app --host 0.0.0.0 --port 8090
```

## Структура

```
sync-service/
├── main.py                 # FastAPI app + lifespan (инициализация клиентов/движка)
├── req.txt
├── Dockerfile
└── app/
    ├── config.py           # настройки из env
    ├── routes.py           # эндпоинты /sync
    ├── jobs.py             # асинхронный JobManager (фоновые задачи)
    ├── clients/
    │   ├── game_systems.py # HTTP-клиент к game-systems (X-Subject)
    │   └── campaign.py     # HTTP-клиент к campaign (X-Subject)
    └── core/
        ├── state.py        # SyncStateStore (файл состояния, thread-safe)
        └── sync.py         # SyncEngine — логика синхронизации
```
