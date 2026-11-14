import unittest

from test_support import FakeContext, FakeResponse, make_validator, auth_strategy
from fastapi import HTTPException


class AccountAuthTests(unittest.TestCase):
    def validate(self, payload, token="opaque.expired.token"):
        ctx = FakeContext({"Authorization": "Bearer " + token}, FakeResponse(payload=payload))
        result = make_validator(ctx)(ctx)
        return result, ctx

    def test_valid_user_is_normalized_without_external_claims(self):
        result, ctx = self.validate({"valid": True, "accountId": 42, "iss": "external", "sub": "external-user", "email": "hidden"})
        self.assertEqual(result, {"accountId": 42, "userId": 42, "sub": "42"})
        self.assertEqual(ctx.state["x_subject"], '{"type": "user", "id": 42}')
        self.assertNotIn("iss", result)
        self.assertNotIn("email", result)
        self.assertEqual(ctx.services.account.calls[0][0], "/internal/auth/validate")
        self.assertEqual(set(ctx.services.account.calls[0][1]["headers"]), {"Authorization", "X-Account-Service-Key"})

    def test_valid_group_is_normalized(self):
        result, ctx = self.validate({"valid": True, "groupId": 23, "accessLevel": 0})
        self.assertEqual(result, {"groupId": 23, "access_level": 0, "sub": "23"})
        self.assertEqual(ctx.state["x_subject"], '{"type": "group", "id": 23}')

    def test_cookie_only_and_malformed_bearer_do_not_call_account_service(self):
        for headers in ({}, {"Authorization": "cookie-only"}, {"Authorization": "Bearer a b"}, {"Authorization": "Bearer "}):
            ctx = FakeContext(headers, FakeResponse(payload={"valid": True, "accountId": 1}))
            self.assertIsNone(make_validator(ctx)(ctx))
            self.assertEqual(ctx.services.account.calls, [])

    def test_invalid_account_ids_raise_unavailable(self):
        for account_id in (True, "12", 0, -1, 2147483648):
            ctx = FakeContext({"Authorization": "Bearer opaque"}, FakeResponse(payload={"valid": True, "accountId": account_id}))
            with self.subTest(account_id=account_id):
                with self.assertRaises(HTTPException) as raised:
                    make_validator(ctx)(ctx)
                self.assertEqual(raised.exception.status_code, 503)
                self.assertEqual(raised.exception.detail, {"error": "authentication_unavailable"})

    def test_ambiguous_user_and_group_is_unavailable(self):
        ctx = FakeContext({"Authorization": "Bearer opaque"}, FakeResponse(payload={"valid": True, "accountId": 1, "groupId": 2}))
        with self.assertRaises(HTTPException) as raised:
            make_validator(ctx)(ctx)
        self.assertEqual(raised.exception.status_code, 503)

    def test_invalid_token_response_returns_none(self):
        ctx = FakeContext({"Authorization": "Bearer opaque"}, FakeResponse(payload={"valid": False}))
        self.assertIsNone(make_validator(ctx)(ctx))

    def test_malformed_json_response_and_network_failure_are_safe_503(self):
        contexts = (
            FakeContext({"Authorization": "Bearer opaque"}, FakeResponse(error=ValueError("secret response"))),
            FakeContext({"Authorization": "Bearer opaque"}, FakeResponse(status_code=500, payload={"detail": "secret"})),
            FakeContext({"Authorization": "Bearer opaque"}, error=TimeoutError("secret host")),
        )
        for ctx in contexts:
            with self.assertRaises(HTTPException) as raised:
                make_validator(ctx)(ctx)
            self.assertEqual(raised.exception.status_code, 503)
            self.assertEqual(raised.exception.detail, {"error": "authentication_unavailable"})

    def test_forbidden_is_distinct(self):
        ctx = FakeContext({"Authorization": "Bearer opaque"}, FakeResponse(status_code=403))
        with self.assertRaises(HTTPException) as raised:
            make_validator(ctx)(ctx)
        self.assertEqual(raised.exception.status_code, 403)
        self.assertEqual(raised.exception.detail, {"error": "insufficient_scope"})

    def test_each_validation_calls_account_service_without_client_headers(self):
        contexts = [FakeContext({"Authorization": "Bearer opaque", "X-User-Id": "999", "Cookie": "secret"}, FakeResponse(payload={"valid": False})) for _ in range(2)]
        validator = make_validator()
        for ctx in contexts:
            self.assertIsNone(validator(ctx))
        self.assertEqual(len(contexts[0].services.account.calls), 1)
        self.assertEqual(len(contexts[1].services.account.calls), 1)
        call = contexts[0].services.account.calls[0][1]
        self.assertEqual(call["headers"], {
            "Authorization": "Bearer opaque",
            "X-Account-Service-Key": "synthetic-account-key-value-000001",
        })
        self.assertEqual(call["timeout"], 10.0)

    def test_opaque_expired_token_is_forwarded_without_local_jwt_decode(self):
        token = "expired-but-opaque-value"
        ctx = FakeContext({"Authorization": "Bearer " + token}, FakeResponse(payload={"valid": False}))
        self.assertIsNone(make_validator(ctx)(ctx))
        self.assertEqual(ctx.services.account.calls[0][1]["headers"]["Authorization"], "Bearer " + token)
        self.assertNotIn("jwt", auth_strategy.__dict__)


if __name__ == "__main__":
    unittest.main()
