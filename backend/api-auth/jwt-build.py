import sys
from utils.token_utils import generate_jwt_token

try:
	id = sys.argv[1]
	access_type = sys.argv[2]
except IndexError:
	print("Не переданы все параметры: id и access_type")
	exit(1)

print(generate_jwt_token(id, access_type))