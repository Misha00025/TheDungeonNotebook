
# Определяем имена переменных окружения для настроек подключения к базе данных
import os

DB_NAME = "MYSQL_DATABASE"
DB_USER = "MYSQL_USER"
DB_PASSWORD = "MYSQL_PASSWORD"
DB_HOST = "DB_HOST"
DB_PORT = "DB_PORT"

# Получаем значения переменных окружения и сохраняем их в словарь connection_settings
connection_settings = {
    "DataBaseName": os.environ.get(DB_NAME),
    "User": os.environ.get(DB_USER),
    "Password": os.environ.get(DB_PASSWORD),
    "Host": os.environ.get(DB_HOST),
    "Port": os.environ.get(DB_PORT)
}

token = os.environ.get("SERVICE_TOKEN")
