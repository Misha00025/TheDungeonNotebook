from flask import Flask
from flask_cors import CORS
from app.routes import routes

application = Flask(__name__)
CORS(application)

application.register_blueprint(routes)