from . import get_instance, instantiated, fields_to_string


_instance = get_instance()
_fields = ["group_id", "service_token", "privileges"]
_string_fields = fields_to_string(_fields)
_table = "group_bot_token"


def find(service_token):
    data = (service_token,)
    query = f"SELECT {_string_fields} FROM {_table} WHERE {_fields[1]} = %s"
    result = _instance.fetchone(query, data)
    return int(result is None), result
