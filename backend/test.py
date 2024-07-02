from typing import Mapping

import requests as rq
from app.access_managment import _st


headers = {_st: "1"}


def get_info():
    url = "http://127.0.0.1:5000/api/v1/get_user_info/173745999"
    res = rq.get(url=url, headers=headers)
    print(res.json()[1])


if __name__ == "__main__":
    get_info()



