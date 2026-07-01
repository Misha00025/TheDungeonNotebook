import requests
import jwt
import variables


def register_or_auth(username, password):
    h = {"Content-Type": "application/json; charset=utf-8"}
    base = variables.server_url.rstrip("/")

    res = requests.post(f"{base}/auth/login", json={"username": username, "password": password}, headers=h)

    if res.status_code == 401:
        res = requests.post(f"{base}/auth/register", json={"username": username, "password": password}, headers=h)
        user_id = res.json()["id"]
        res = requests.post(f"{base}/auth/login", json={"username": username, "password": password}, headers=h)
    else:
        payload = jwt.decode(res.json()["token"], options={"verify_signature": False})
        user_id = int(payload["userId"])

    token = res.json()["token"]

    res = requests.post(f"{base}/auth/refresh", headers={**h, "Refresh-Token": token})
    access_token = res.json()["accessToken"]

    return {"id": user_id, "token": token, "accessToken": access_token}
