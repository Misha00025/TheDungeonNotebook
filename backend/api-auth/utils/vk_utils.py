import requests
import config


vk_api_version = "5.131"
service_token = config.token


def _get_response(res):
	# print(res.json())
	json: dict = res.json()
	if "response" in json.keys():
		return 0, json["response"]
	return 1, json["error"]


def get_payload(content: dict):
	if "payload" in content.keys():
		payload = content["payload"]
		return 0, payload
	return 1, "payload not found"


def get_authorize_data(payload: dict):
	if "uuid" in payload.keys() and "token" in payload.keys():
		uuid = payload["uuid"]
		silent_token = payload["token"]
		return uuid, silent_token
	return "", ""


def generate_access_token(uuid, silent_token):
	if uuid == "":
		return 300, f"uuid not found"
	data = f"v={vk_api_version}&token={silent_token}&access_token={service_token}&uuid={uuid}"
	res = requests.post('https://api.vk.com/method/auth.exchangeSilentAuthToken', data=data)
	if res.ok:
		err, response = _get_response(res)
		if not err:
			if "access_token" in response.keys():
				access_token = response["access_token"]
				return 0, access_token
			return 1, "access_token not found"
		return err, response
	return 400, "vk not found"


def get_account_info(user_id):
	data = f"v={vk_api_version}&user_ids={user_id}&fields=photo_100&access_token={service_token}&lang=0"
	res = requests.post('https://api.vk.com/method/users.get', data=data)
	if res.ok:
		err, response = _get_response(res)
		if not err:
			return 0, response[0]
		return 1, response
	return 1, "vk not found"
	

def access_to_user_token(access_token: str):
	user_token = str(hash(access_token))
	return user_token
