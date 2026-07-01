# Uploads Service

## Общее описание

Сервис загрузки файлов (изображений). Принимает multipart/form-data, валидирует расширение (.jpg, .jpeg, .png, .gif, .bmp, .webp) и MIME-тип, проверяет токен через auth-service, сохраняет файл на диск в `wwwroot/uploads/{userId}/`. Максимальный размер файла: 10 MB.

## ENV

| Переменная | Описание | Обязательная |
|---|---|---|
| `AUTH_SERVICE_URL` | URL сервиса аутентификации | Да |

## Endpoints

### Загрузка файла

```
POST /uploads
```

- Body: multipart/form-data с полем `file`
- Header: `Authorization: Bearer <token>`

| Ответ | Описание |
|---|---|
| `200` | `{ "url": string, "fileName": string, "size": long }` |
| `400` | Bad Request |
| `401` | Unauthorized |
| `500` | Internal Server Error |
