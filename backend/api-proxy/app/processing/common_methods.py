from flask import request
import requests
from app import AUTH_SERVICE_URL, BACKEND_SERVICE_URL


def get_current_time():
	import time
	return time.strftime('%Y-%m-%d %H-%M-%S')

# Проверка токена и получение информации о пользователе или группе
def check_token(token):
	url = f"{AUTH_SERVICE_URL}/whoami"
	headers = {"token": token}
	try:
		response = requests.get(url, headers=headers)
		if response.status_code == 200:
			return response.json()
		else:
			return None
	except requests.RequestException as e:
		return None

# Метод для копирования всех данных из запроса
def get_request_meta_data(without_data=False):
	request_meta_data = {}
	# Копируем все заголовки
	request_meta_data["headers"] = {key: value for (key, value) in request.headers if key != 'Host'}
	# Копируем все cookies
	request_meta_data["cookies"] = request.cookies
	# Копируем данные из тела запроса
	if not without_data:
		request_meta_data["data"] = request.get_data()
	# Копируем IP-адрес клиента
	request_meta_data["remote_addr"] = request.remote_addr
	return request_meta_data
	
def get_character_id(group_id, meta_data):
	url = f"{BACKEND_SERVICE_URL}/groups/{group_id}/characters"
	response = requests.get(url, **meta_data)
	if response.status_code == 200:
		characters = response.json()["data"]["characters"]
		if len(characters) == 0:
				return None
		character_id = characters[0]["id"]
		return character_id
	return None