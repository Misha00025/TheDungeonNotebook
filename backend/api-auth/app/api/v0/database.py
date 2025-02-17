import time
from functools import wraps

from config import connection_settings
from app.databases.MySQLDB import MySQLDB


_instance: MySQLDB = None


def _instantiated(func):
	@wraps(func)
	def wrapper(*args, **kwargs):
		if _instance is None:
			return 1, "No connection to database"
		return func(*args, **kwargs)
	return wrapper


def _to_string(fields: list):
	string = ""
	for field in fields:
		string += field + ", "
	string = string[:len(string) - 2]
	return string


@_instantiated
def find_user_id_from_token(token):
	field = "user_id"
	query = f"SELECT {field} FROM user_token WHERE token = '{token}'"
	result = _instance.fetchone(query)
	if result is not None:
		return 0, result[0]
	return 1, "user not found"


@_instantiated
def find_group_id_from_token(token):
	field = "group_id"
	query = f"SELECT {field} FROM group_token WHERE token = '{token}'"
	result = _instance.fetchone(query)
	if result is not None:
		return 0, result[0]
	return 1, "group not found"


@_instantiated
def get_last_authorise(token):
	field = "last_date"
	query = f"SELECT {field} FROM user_token WHERE token = %s"
	data = (token,)
	result = _instance.fetchone(query, data)
	if result is not None:
		return 0, result[0]
	return 1, "user not found"


@_instantiated
def check_admin(user_id, group_id):
	query = f"SELECT is_admin FROM user_group WHERE vk_user_id = '{user_id}' AND vk_group_id = '{group_id}'"
	res = _instance.fetchone(query)
	if res is None:
		return 1, "link between user and group not found"
	return 0, res[0]


if connection_settings is not None:
	_dbname = connection_settings["DataBaseName"]
	_user = connection_settings["User"]
	_password = connection_settings["Password"]
	_host = connection_settings["Host"]
	_port = connection_settings["Port"]

	_instance = MySQLDB(
		dbname=_dbname,
		user=_user,
		password=_password,
		host=_host,
		port=_port
	)


