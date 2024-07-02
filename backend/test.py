from typing import Mapping

import requests as rq
import json

from variables import _st


headers = {_st: "1", "Content-Type": "application/json"}


def get_info():
    url = "http://127.0.0.1:5000/api/v1/get_user_info/173745999"
    res = rq.get(url=url, headers=headers)
    print(res.json()[1])


def upd_user():
    data = {"user_id": "173745999", "group_id": "218984657"}
    json_data = json.dumps(data)  # Преобразование данных в формат JSON
    res = rq.request(
        method="PUT",
        url="http://127.0.0.1:5000/api/v1/update_user",
        data=json_data,
        headers=headers
    )
    print(res.content)


if __name__ == "__main__":
    get_info()
    upd_user()



