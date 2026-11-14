import pathlib
import sys
import types
from unittest.mock import patch


GATEWAY = pathlib.Path(__file__).resolve().parents[1]
TEST_ENV = {
    "ACCOUNT_SERVICE_KEY": "synthetic-account-key-value-000001",
    "INTERNAL_SERVICE_KEY": "synthetic-internal-key-value-00001",
    "ACCOUNT_SERVICE_TIMEOUT_SECONDS": "10",
}
if str(GATEWAY) not in sys.path:
    sys.path.insert(0, str(GATEWAY))


registry = types.ModuleType("app.engine.registry")
registry.register_auth_strategy = lambda name: lambda value: value
registry.register_pre_request_handler = lambda name: lambda value: value
registry.register_response_handler = lambda name: lambda value: value
registry.register_access_handler = lambda name: lambda value: value
context = types.ModuleType("app.engine.context")
context.RouteContext = type("RouteContext", (), {})
proxy_request = types.ModuleType("app.engine.proxy_request")
proxy_request.RequestBuilder = type("RequestBuilder", (), {})
status = types.ModuleType("app.engine.status")
status.ok = lambda value=None: value
status.unauthorized = lambda: None
status.forbidden = lambda: None
status.not_found = lambda value=None: value

engine = types.ModuleType("app.engine")
engine.__path__ = []
app = types.ModuleType("app")
app.__path__ = []
app.engine = engine
engine.registry = registry
engine.context = context
engine.proxy_request = proxy_request
engine.status = status

sys.modules["app"] = app
sys.modules["app.engine"] = engine
sys.modules["app.engine.registry"] = registry
sys.modules["app.engine.context"] = context
sys.modules["app.engine.proxy_request"] = proxy_request
sys.modules["app.engine.status"] = status

with patch.dict("os.environ", TEST_ENV, clear=True):
    import handlers.auth_strategy as auth_strategy
    import handlers.trusted as trusted


class FakeResponse:
    def __init__(self, status_code=200, payload=None, error=None):
        self.status_code = status_code
        self.payload = payload
        self.error = error

    def json(self):
        if self.error:
            raise self.error
        return self.payload


class FakeAccountService:
    def __init__(self, response=None, error=None):
        self.response = response
        self.error = error
        self.calls = []

    def post(self, path, **kwargs):
        self.calls.append((path, kwargs))
        if self.error:
            raise self.error
        return self.response


class FakeRequest:
    def __init__(self, headers=None):
        self.headers = headers or {}
        self.cookies = {"access_token": "cookie-only"}


class FakeContext:
    def __init__(self, headers=None, response=None, error=None):
        self.request = FakeRequest(headers)
        self.services = types.SimpleNamespace(account=FakeAccountService(response, error))
        self.state = {}


def make_validator(ctx=None):
    with patch.dict("os.environ", TEST_ENV, clear=True):
        return auth_strategy.account_service_factory(None)
