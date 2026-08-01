import requests
import jwt
import variables


def register_or_auth(username, password):
    h = {"Content-Type": "application/json; charset=utf-8"}
    base = variables.server_url.rstrip("/")

    res = requests.post(f"{base}/auth/token", json={"grant_type": "password", "username": username, "password": password}, headers=h)

    if res.status_code == 401:
        res = requests.post(f"{base}/auth/register", json={"username": username, "password": password}, headers=h)
        user_id = res.json()["id"]
        res = requests.post(f"{base}/auth/token", json={"grant_type": "password", "username": username, "password": password}, headers=h)
    else:
        payload = jwt.decode(res.json()["access_token"], options={"verify_signature": False})
        user_id = int(payload["userId"])

    access_token = res.json()["access_token"]

    return {"id": user_id, "token": access_token, "accessToken": access_token}
