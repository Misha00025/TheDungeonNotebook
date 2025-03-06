import sys
from utils.token_utils import generate_jwt_token

try:
	id = sys.argv[1]
	access_type = sys.argv[2]
except IndexError:
	print("Не переданы все параметры: id, access_type и days")
	exit(1)

try:
	days = int(sys.argv[3])
except:
	days = 7

print(generate_jwt_token(id, access_type, delta_time={"days": days}))