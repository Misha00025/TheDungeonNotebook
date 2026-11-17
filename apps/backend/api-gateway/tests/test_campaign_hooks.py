import asyncio
import unittest
from unittest.mock import Mock, call

from test_support import FakeContext, FakeResponse, make_validator, auth_strategy
from handlers.responses import handle_campaign_response


class RequestBuilder:
    def __init__(self, headers):
        self.headers = dict(headers)

    def remove_header(self, name):
        self.headers.pop(name, None)

    def set_header(self, name, value):
        self.headers[name] = value


class CampaignHookTests(unittest.TestCase):
    def test_verified_user_and_group_subjects_are_forwarded_without_client_identity_or_service_key(self):
        for payload, expected_subject in (
            ({"valid": True, "accountId": 42}, '{"type": "user", "id": 42}'),
            ({"valid": True, "groupId": 23, "accessLevel": 0}, '{"type": "group", "id": 23}'),
        ):
            client_headers = {
                "Authorization": "Bearer verified-token",
                "aUtHoRiZaTiOn": "Bearer client-token",
                "cOoKiE": "client-cookie",
                "x-sUbJeCt": "spoofed-subject",
                "X-USER-ID": "spoofed-user",
                "x-Account-Id": "spoofed-account",
                "X-ACCOUNT-SERVICE-KEY": "spoofed-account-key",
                "x-internal-service-key": "spoofed-internal-key",
            }
            ctx = FakeContext(client_headers, FakeResponse(payload=payload))
            self.assertIsNotNone(make_validator(ctx)(ctx))
            request = RequestBuilder({
                **client_headers,
                "Authorization": "configured-token",
                "Cookie": "configured-cookie",
                "X-Subject": "configured-subject",
                "X-User-Id": "configured-user",
                "X-Account-Id": "configured-account",
                "X-Account-Service-Key": "configured-account-key",
                "X-Internal-Service-Key": "configured-internal-key",
                "Content-Type": "application/json",
                "X-Request-ID": "request-id",
            })
            asyncio.run(auth_strategy.campaign_upstream(ctx, request))
            self.assertEqual(request.headers, {
                "Content-Type": "application/json",
                "X-Request-ID": "request-id",
                "X-Subject": expected_subject,
            })

    def test_anonymous_campaign_hook_does_not_inject_subject_or_service_key(self):
        ctx = FakeContext({"X-Subject": "spoofed", "Authorization": "Bearer invalid"}, FakeResponse(payload={"valid": False}))
        self.assertIsNone(make_validator(ctx)(ctx))
        request = RequestBuilder({
            "X-Subject": "configured-spoof",
            "X-Internal-Service-Key": "configured-key",
            "x-account-service-key": "client-key",
            "Content-Type": "application/json",
        })
        asyncio.run(auth_strategy.campaign_upstream(ctx, request))
        self.assertEqual(request.headers, {"Content-Type": "application/json"})

    def test_response_hook_calls_only_passthrough(self):
        response = Mock(spec=["passthrough"])
        ctx = type("Context", (), {"response": response})()
        asyncio.run(handle_campaign_response(ctx))
        response.passthrough.assert_called_once_with()
        self.assertEqual(response.method_calls, [call.passthrough()])


if __name__ == "__main__":
    unittest.main()
