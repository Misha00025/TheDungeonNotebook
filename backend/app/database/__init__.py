import time
from functools import wraps

from config import connection_settings
from app.databases.MySQLDB import MySQLDB


_instance: MySQLDB = None


def get_instance() -> MySQLDB:
    global _instance
    if _instance is None:
        try:
            if connection_settings is not None:
                _dbname = connection_settings["DataBaseName"]
                _user = connection_settings["User"]
                _password = connection_settings["Password"]
                _host = connection_settings["Host"]
                _port = connection_settings["Port"]

                _instance = MySQLDB(
                    dbname=_dbname,
                    user=_user,
                    password=_password,
                    host=_host,
                    port=_port
                )
                with open("create_tables.sql", 'r') as file:
                    sql_script = file.read()
                sql_script = sql_script.replace("\n", " ")
                _instance.execute(sql_script)
        except:
            _instance = None
            return None        
    return _instance


def instantiated(func):
    @wraps(func)
    def wrapper(*args, **kwargs):
        if _instance is None:
            return 1, "No connection to database"
        return func(*args, **kwargs)
    return wrapper


def fields_to_string(fields: list):
    string = ""
    for field in fields:
        string += field + ", "
    string = string[:len(string) - 2]
    return string


from . import vk_user, vk_group, vk_user_token, user_group, group_bot_token, note

