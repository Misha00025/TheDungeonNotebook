import time
from functools import wraps

from config import connection_settings
from app.databases.MySQLDB import MySQLDB


_instance: MySQLDB | None = None


class SQLparser:
    def __init__(self, db: MySQLDB) -> None:
        self._db = db

    @staticmethod
    def _where(where: dict, data = ()):
        query = ""
        if len(where) > 0:
            query = " WHERE"
            rules = []
            data = ()
            for field, value in where.items():
                tp = "%s"
                rules.append(f" {field} = {tp}")
                data += (value, )
            while len(rules) > 0:
                rule = rules.pop(0)
                query += rule
                if len(rules) > 0:
                    query += " AND"
        return query, data

    def is_connected(self):
        return self._db.is_connected()

    def execute(self, query, data = ()):
        # print(f"{query}: {data}")
        return self._db.execute(query, data)
    
    def fetchone(self, query, data = ()):
        return self._db.fetchone(query, data)
    
    def fetchall(self, query, data = ()):
        return self._db.fetchall(query, data)

    def select(self, table, fields = "*", where: dict = None, many = False):
        query = f"SELECT {fields} FROM {table}"
        _where, data = self._where(where)
        query += _where
        if many:
            res = self.fetchall(query, data)
        else:
            res = self.fetchone(query, data)
        return res
    
    def insert(self, table, fields: dict):
        str_fields = ""
        params = ""
        data_v = ()
        while len(fields) > 0:
            name, value = fields.popitem()
            data_v += (value,)
            str_fields += name
            params += "%s"
            if len(fields) > 0:
                params += ", "
                str_fields += ", "
        data = data_v
        query = f"INSERT INTO {table} ({str_fields}) VALUES ({params})"
        return self.execute(query, data)
    
    def update(self, table, fields: dict, where):
        _where, w_data = self._where(where)
        query = f"UPDATE {table} SET "
        data = ()
        while len(fields) > 0:
            name, value = fields.popitem()
            query += f" {name} = %s "
            data += (value,)
            if len(fields) > 0:
                query += ","
        query += _where
        data += w_data
        self.execute(query, data)

    def delete(self, table, where):
        _where, data = self._where(where)
        query = f"DELETE FROM {table} {_where}"
        return self.execute(query, data)


def get_instance() -> SQLparser:
    global _instance
    if _instance is None:
        try:
            if connection_settings is not None:
                _dbname = connection_settings["DataBaseName"]
                _user = connection_settings["User"]
                _password = connection_settings["Password"]
                _host = connection_settings["Host"]
                _port = connection_settings["Port"]
                if "MaxPool" in connection_settings.keys():
                    _pool = int(connection_settings["MaxPool"])
                else:
                    _pool = 2000

                db = MySQLDB(
                    dbname=_dbname,
                    user=_user,
                    password=_password,
                    host=_host,
                    port=_port,
                    max_pool=_pool
                )
                _instance = SQLparser(db)
        except Exception as e:
            _instance = None
            print(f"Failed to connect to database: {e}")
            return None        
    return _instance


def create_tables():
    with open("create_tables.sql", 'r') as file:
        sql_script = file.read()
    scripts = sql_script.split('\n\n')
    for script in scripts:
        script = script.replace("\n", " ")
        instance = get_instance()
        if instance is None:
            raise Exception("Cannot connect to database")
        instance.execute(script)


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


def get_res(response, get_item) -> list[object] | object | None:
    # print(response)
    is_list = type(response) is list
    if response is None:
        return None
    result: list
    if is_list:
        result = []
        for raw in response:
            item = get_item(raw)
            result.append(item)
    else:
        result = get_item(response)
    return result


from . import vk_user, vk_group, vk_user_token, user_group, group_bot_token, note, item, item_inventory, inventory

