from flask import Flask
from flask_cors import CORS
from app.routes import login_routes

application = Flask(__name__)
CORS(application)

application.register_blueprint(login_routes)
