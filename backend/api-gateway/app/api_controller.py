from enum import Enum
from app import application


_prefix = "/"
_url_prefix = ""
_version = ""
_urls = {}
_info: dict[str,list] = {}


class Access(Enum):
    all = None
    users = 1
    groups = 2
    users_and_groups = users + groups

def version(version, clear = False):
    global _url_prefix, _version, _info
    print("Version change")
    _url_prefix = version + "/"
    _version = version
    if version == "":
        _url_prefix = version
    if clear:
        _urls.clear()
    for url in _urls.copy().keys():
        methods, func = _urls[url]
        dec = route(url, methods)
        dec(func)
    if version == "":
        version = "v0"
    if not version in _info.keys():
        _info[version] = []
        

def get_routers_info():
    return _info
    

def route(url, methods, access: Access = Access.all):
    global _info
    full_url = _prefix+_url_prefix+url
    text = f"url with methods: {methods} {full_url}"
    v = _version
    if v == "":
        v = "v0"
    _info[v].append({"url": full_url,"methods": methods})
    print("Set " + text)
    def decorator(f):
        dec = application.route(full_url, methods=methods)
        _urls[url] = (methods, f)
        return dec(f)
    return decorator
