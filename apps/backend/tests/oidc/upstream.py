import hmac
import json
import os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import unquote


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == "/health/live":
            self.send_response(200)
            self.end_headers()
            return
        expected = os.environ.get("INTERNAL_SERVICE_KEY", "").encode()
        supplied = self.headers.get("X-Internal-Service-Key", "").encode()
        if not expected or not hmac.compare_digest(supplied, expected):
            self.send_response(401)
            self.end_headers()
            return
        parts = self.path.split("?", 1)[0].strip("/").split("/")
        if len(parts) != 2 or parts[0] != "users":
            self.send_response(404)
            self.end_headers()
            return
        try:
            subject = json.loads(unquote(self.headers.get("X-Subject", "")))
        except (json.JSONDecodeError, TypeError):
            subject = None
        payload = json.dumps({"subject": subject, "authorizationPresent": bool(self.headers.get("Authorization")),
                              "cookiePresent": bool(self.headers.get("Cookie"))}).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def log_message(self, format, *args):
        return


ThreadingHTTPServer(("0.0.0.0", 8080), Handler).serve_forever()
