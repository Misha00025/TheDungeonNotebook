import sys
from utils.token_utils import verify_and_return_token_data

# Получаем токен из второго аргумента командной строки
try:
    token = sys.argv[1]
except IndexError:
    print("Токен не передан.")
    exit(1)

result = verify_and_return_token_data(token)
print(result)