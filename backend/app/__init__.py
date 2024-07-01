from flask import Flask
from flask_cors import CORS

application = Flask(__name__)
CORS(application)

import app.api.v0.router
import app.api.v1
