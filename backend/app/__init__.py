from flask import Flask
from flask_cors import CORS

application = Flask(__name__)
CORS(application)


from database import get_instance
from time import sleep
while get_instance() is None:
    print("Can't connect to database. Retrying after 10 seconds")
    sleep(10)
    continue


import app.api.v0.router
import app.api.v1


