from app import application


_prefix = "/api/"
_version = ""
_urls = {}


def version(version, clear = False):
    global _version
    print("Version change")
    _version = version + "/"
    if version == "":
        _version = version
    if clear:
        _urls.clear()
    for url in _urls.copy().keys():
        methods, func = _urls[url]
        dec = route(url, methods)
        dec(func)


def route(url, methods):
    full_url = _prefix+_version+url
    print(f"Set url {full_url}")
    def decorator(f):
        dec = application.route(full_url, methods=methods)
        _urls[url] = (methods, f)
        return dec(f)
    return decorator