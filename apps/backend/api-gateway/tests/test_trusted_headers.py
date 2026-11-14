import asyncio
import unittest

import yaml

from test_support import GATEWAY, FakeContext, trusted
from handlers.auth_strategy import trusted_upstream
from ingress import IngressIdentitySanitizer


class CaseSensitiveRequestBuilder:
    def __init__(self, headers):
        self.headers = dict(headers)

    def remove_header(self, name):
        self.headers.pop(name, None)

    def set_header(self, name, value):
        self.headers[name] = value


class TrustedHeaderTests(unittest.TestCase):
    def test_hook_removes_case_variants_and_replaces_trusted_identity(self):
        ctx = FakeContext({
            "aUtHoRiZaTiOn": "Bearer client-token",
            "cOoKiE": "access_token=client-cookie",
            "x-sUbJeCt": "spoofed-lower",
            "X-USER-ID": "spoofed-user",
            "x-Account-Id": "spoofed-account",
            "X-account-service-key": "spoofed-account-key",
            "x-internal-service-key": "spoofed-internal-key",
        })
        ctx.state["x_subject"] = '{"type":"user","id":12}'
        request = CaseSensitiveRequestBuilder({
            "Authorization": "configured-token",
            "authorization": "configured-lower-token",
            "Cookie": "configured-cookie",
            "X-Subject": "configured-subject",
            "x-subject": "configured-lower-subject",
            "X-User-Id": "configured-user",
            "X-Account-Id": "configured-account",
            "X-Account-Service-Key": "configured-account-key",
            "X-Internal-Service-Key": "configured-internal-key",
        })
        asyncio.run(trusted_upstream(ctx, request))
        self.assertEqual(request.headers, {
            "X-Subject": '{"type":"user","id":12}',
            "X-Internal-Service-Key": trusted.INTERNAL_SERVICE_KEY,
        })
        self.assertNotIn("Authorization", request.headers)
        self.assertNotIn("Cookie", request.headers)

    def test_anonymous_hook_does_not_inject_subject(self):
        ctx = FakeContext({"X-Subject": "client-subject", "Authorization": "Bearer client"})
        request = CaseSensitiveRequestBuilder({"X-Subject": "configured", "Authorization": "client"})
        asyncio.run(trusted_upstream(ctx, request))
        self.assertEqual(request.headers, {"X-Internal-Service-Key": trusted.INTERNAL_SERVICE_KEY})

    def test_direct_trusted_headers_do_not_use_client_identity(self):
        ctx = FakeContext({"X-Subject": "spoofed", "X-Internal-Service-Key": "spoofed-key"})
        headers = trusted.trusted_headers(ctx)
        self.assertEqual(headers, {"X-Internal-Service-Key": trusted.INTERNAL_SERVICE_KEY})
        self.assertNotIn("Authorization", headers)
        self.assertNotIn("Cookie", headers)

    def test_ingress_sanitizer_removes_identity_keys_case_insensitively(self):
        captured = {}

        async def downstream(scope, receive, send):
            captured["headers"] = scope["headers"]

        scope = {
            "type": "http",
            "headers": [
                (b"X-Subject", b"spoof"),
                (b"x-user-id", b"spoof"),
                (b"X-ACCOUNT-ID", b"spoof"),
                (b"x-account-service-key", b"spoof"),
                (b"X-Internal-Service-Key", b"spoof"),
                (b"Authorization", b"Bearer retained"),
                (b"Cookie", b"retained"),
            ],
        }
        async def receive():
            return {"type": "http.request", "body": b"", "more_body": False}
        async def send(message):
            return None
        asyncio.run(IngressIdentitySanitizer(downstream)(scope, receive, send))
        self.assertEqual(captured["headers"], [(b"Authorization", b"Bearer retained"), (b"Cookie", b"retained")])

    def test_every_proxy_mapping_has_adjacent_handler(self):
        config = yaml.safe_load((GATEWAY / "configs" / "routes.yaml").read_text())
        proxies = []

        def visit(value):
            if isinstance(value, dict):
                if "proxy" in value:
                    proxies.append(value)
                for nested in value.values():
                    visit(nested)
            elif isinstance(value, list):
                for nested in value:
                    visit(nested)

        visit(config)
        self.assertGreater(len(proxies), 0)
        self.assertTrue(all(node.get("pre_request_handler") == "trusted_upstream" for node in proxies))


if __name__ == "__main__":
    unittest.main()
