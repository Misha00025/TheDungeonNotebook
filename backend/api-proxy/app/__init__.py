import os
from flask import Flask
from flask_cors import CORS

application = Flask(__name__)
CORS(application)


AUTH_SERVICE_URL = os.environ.get("AUTH_SERVICE_URL")
BACKEND_SERVICE_URL = os.environ.get("BACKEND_URL")

import app.api.v0
import app.api.v1


