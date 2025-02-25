
# Определяем имена переменных окружения для настроек подключения к базе данных
import os

DB_NAME = "MYSQL_DATABASE"
DB_USER = "MYSQL_USER"
DB_PASSWORD = "MYSQL_PASSWORD"
DB_HOST = "DB_HOST"
DB_PORT = "DB_PORT"
try:
	# Получаем значения переменных окружения и сохраняем их в словарь connection_settings
	connection_settings = {
		"database": os.environ.get(DB_NAME),
		"user": os.environ.get(DB_USER),
		"password": os.environ.get(DB_PASSWORD),
		"host": os.environ.get(DB_HOST),
		"port": int(os.environ.get(DB_PORT)),
	}
except:
	pass
# Получаем сервисный ключ для доступа к API VK   
token = os.environ.get("SERVICE_TOKEN")

secret_key = os.environ.get("JWT_SECRET_KEY")
