from app.processing.common_methods import check_token
from variables import _st, _at
from flask import Request


def get_service_token(request: Request):
	service_token = request.headers.get(_st, None)
	return service_token


def get_access_token(request: Request):
	token = request.headers.get(_at, None)
	return str(token)


def from_bot(request: Request):
	st = get_service_token(request)
	return st is not None


def from_user(request: Request):
	at = get_access_token(request)
	return at is not None

_methods_without_json = ["GET", "DELETE"]

def get_my_id():
	whoami = get_whoami()
	if not whoami:
		return None
	return str(whoami["access"]["id"])

def get_user_id(request: Request):
	if from_bot(request):
		args = request.args
		user_id = args.get("user_id", None)
		if user_id is None and request.method not in _methods_without_json:
			user_id = request.json.get("user_id")
		if user_id is None:
			return None
		return str(user_id)
	else:
		return get_my_id()

def get_group_id(request: Request):
	if from_user(request):
		args = request.args
		group_id = args.get("group_id", None)
		if group_id is None and request.method not in _methods_without_json:
			group_id = request.json.get("group_id")
		return str(group_id)
	else:
		return get_my_id()

def get_admin_status(request: Request):
	is_admin = request.json.get("is_admin")
	return is_admin

def get_whoami(request: Request):
	token = request.headers.get("token")
	if not token:
		token = request.headers.get("serviceToken")
		if not token:
			return None
	whoami = check_token(token)
	return whoami

