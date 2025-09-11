import os
from flask import Flask

application = Flask(__name__)
application.config['JSON_AS_ASCII'] = False
from flask import json
json.provider.DefaultJSONProvider.ensure_ascii = False

AUTH_SERVICE_URL = os.environ.get("AUTH_SERVICE_URL")
POLICY_SERVICE_URL = os.environ.get("POLICY_SERVICE_URL")
USERS_SERVICE_URL = os.environ.get("USERS_SERVICE_URL")
CAMPAIGN_SERVICE_URL = os.environ.get("CAMPAIGN_SERVICE_URL")
NOTES_SERVICE_URL = os.environ.get("NOTES_SERVICE_URL")

import app.api


