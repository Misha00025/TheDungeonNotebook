import requests
from . import test_variables
from .test_variables import DEBUG, default_debug
import re
import tests.test_variables as tv
from .request_tests import get_test, put_test, post_test, delete_test, rq, get_text


def get_http_status_message(status_code):
	# Создаем словарь для хранения сообщений по каждому статус-коду
	status_messages = {
		200: 'OK',
		201: 'Created',
		202: 'Accepted',
		204: 'No Content',
		301: 'Moved Permanently',
		302: 'Found',
		400: 'Bad Request',
		401: 'Unauthorized',
		403: 'Forbidden',
		404: 'Not Found',
		405: 'Method Not Allowed',
		500: 'Internal Server Error'
	}
	
	return status_messages.get(status_code, 'Unknown Status Code')



class Test:
	def __init__(self,
				 request: str = "",
				 params: dict = {},
				 headers: dict = {},
				 data: dict = {},
				 method: str = "GET",
				 requirement: int = 200,
				 debug: bool = True,
				 is_valid: callable = None,
				 check_access: bool = False
				 ) -> None:
		self.request = request
		self.params = params.copy()
		if debug:
			self.params[DEBUG] = True 
		self.headers = headers.copy()
		self.method = method
		self.data = data
		self.check_access = check_access

		self.requirement = requirement
		self.message = "Nothing"
		# print(is_valid)
		self._is_valid = is_valid


	def check(self, res: requests.Response):
		correct_code = self.requirement == res.status_code
		if self._is_valid is None or not correct_code:
			self.message = get_http_status_message(res.status_code)
			return correct_code
		if tv.debug:
			print(f"DEBUG: Type of result: {type(res)} - {res.text}")
			print(f"DEBUG: Validation method name: {self._is_valid.__name__}")
		ok, self.message = self._is_valid(self, res)
		return ok


def replace_placeholders(text, data):
	def replace_match(match):
		key = match.group(1)
		if test_variables.debug:
			print("DEBUG: Parse:", key)
		value = data
		for part in key.split('.'):
			if test_variables.debug:
				print("DEBUG: Part:", part)
				
			try:
				if part == "last":
					value = len(value)-1
					break
				index = int(part)  # Проверяем, является ли часть ключа индексом списка
				if index < 0:  # Обрабатываем отрицательные индексы
					index += len(value)  # Приводим отрицательный индекс к положительному
				value = value[index]
			except ValueError:
				try:
					value = value[part]  # Если не индекс, продолжаем искать как обычный ключ
				except:
					return match.group()
			except (KeyError, IndexError):
				return match.group()  # Если ключ или индекс отсутствуют, возвращаем исходный текст
			
		return str(value)
	
	# Найдем все вхождения вида {key}, где key может содержать точки для вложенных значений
	if test_variables.debug:
		print("DEBUG: Parse:", text)
	pattern = r'\{([-]?[a-zA-Z0-9-_.]+)\}'
	result = re.sub(pattern, replace_match, text)
	return result


def prepare_data(data: dict, results):
	result = data.copy()
	if data is not None:
		for key in data.keys():
			result[key] = replace_placeholders(data[key], results)
	return result


class Step:
	def __init__(self, test: Test):
		self.test: Test = test
		self.ok: bool = False
		self.message = ""

	def execute(self, _data):
		test = self.test
		res: rq.Response
		headers = test.headers
		url = replace_placeholders(self.test.request, _data)
		params = test.params
		data = prepare_data(test.data, _data)
		test.data = data
		match test.method:
			case "GET":
				res = get_test(headers, params, url)
			case "PUT":
				res = put_test(headers, params, url, data)
			case "POST":
				res = post_test(headers, params, url, data)
			case "DELETE":
				res = delete_test(headers, params, url)
		self.ok = test.check(res)
		self.message = get_text(res, url, test.method, params=test.params)
		return res


class Scenario:
	def __init__(self, name, steps: list[Step], data = None):
		self.name = name
		self.steps = steps
		self.data = data
		self.ok = True
		if self.data is None:
			self.data = {}

	def start(self):
		s = f"'{self.name}' Test Scenario"
		print("".join(["#" for _ in range(15 + len(s))]))
		print("#  Starting {}  #".format(s))
		print("".join(["#" for _ in range(15 + len(s))]))
		data = self.data
		data["steps"] = []
		for step in self.steps:
			res = None
			try:
				res = step.execute(data)
			except Exception as e:
				print("ERROR:", e)
			try:
				data["steps"].append(res.json())
			except:
				if res is None:
					data["steps"].append("")
				else:
					data["steps"].append(res.text)
			test = step.test
			if not step.ok:
				print("ERROR:", step.message, "\n   |- Headers:", test.headers, "\n   |- Data:", test.data, "\n   |- Message:", test.message)
				self.ok = False
			elif test_variables.debug:
				print(step.message)
