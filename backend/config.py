import configparser
import os

_conf = configparser.ConfigParser()
_conf.read("config.ini")

db_connection_file_name = _conf["DEFAULT"]["DbConnectionSettingsFile"]

try:
    _db_config = configparser.ConfigParser()
    _db_config.read(db_connection_file_name)
    connection_settings = _db_config["DATABASE"]
except:
    print(f"File \"{db_connection_file_name}\" do not exist!")
    connection_settings = None

token = os.environ.get("SERVICE_TOKEN")
