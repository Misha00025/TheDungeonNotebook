from requests import Response


def intro():
    write_header("Tests started")

def end():
    write_header("Tests ended")

def write_header(text: str):
    s = "#  {}  #".format(text)
    print()
    print("".join(["#" for _ in range(len(s))]))
    print(s)
    print("".join(["#" for _ in range(len(s))]))
    print()

def write_result(response: Response):
    rq = response.request
    text = f"Request: {rq.method} {rq.url}"
    text+= f"\n    |-- Headers: {rq.headers}"
    if (rq.body is not None):
        text+= f"\n    |-- Body: {rq.body}"
    text += f"\n    |-- Response: {response.status_code} {response.content}"
    print(text)
    