import base64
import concurrent.futures
import hashlib
import html
import json
import os
import re
import secrets
import sys
import time
import traceback
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import parse_qs, urljoin, urlparse

import pymysql
import requests


TIMEOUT = 10
DIR = Path(os.environ["OIDC_SMOKE_DIR"])
ISSUER_A = os.environ.get("OIDC_ISSUER_A", "http://idp:8080/realms/smoke-a")
ISSUER_B = os.environ.get("OIDC_ISSUER_B", "http://idp:8080/realms/smoke-b")
GATEWAY = os.environ.get("GATEWAY_URL", "http://api-gateway:5000")
ACCOUNT = os.environ.get("ACCOUNT_SERVICE_URL", "http://account-service:8080")
UPSTREAM = os.environ.get("UPSTREAM_URL", "http://upstream:8080")


class CheckFailure(Exception):
    pass


def require(condition, label):
    if not condition:
        raise CheckFailure(label)


class FormParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.action = None
        self.inputs = {}
        self.links = []

    def handle_starttag(self, tag, attrs):
        values = dict(attrs)
        if tag == "form" and self.action is None:
            self.action = html.unescape(values.get("action", ""))
        if tag == "input" and values.get("name"):
            self.inputs[values["name"]] = values.get("value", "")
        if tag == "a" and values.get("href"):
            self.links.append(html.unescape(values["href"]))


class RegistrationParser(FormParser):
    def __init__(self):
        super().__init__()
        self.forms = []
        self.current_action = None
        self.current_inputs = {}

    def handle_starttag(self, tag, attrs):
        values = dict(attrs)
        if tag == "form":
            self.current_action = html.unescape(values.get("action", ""))
            self.current_inputs = {}
        elif tag == "input" and self.current_action is not None and values.get("name"):
            self.current_inputs[values["name"]] = values.get("value", "")

    def handle_endtag(self, tag):
        if tag == "form" and self.current_action is not None:
            self.forms.append((self.current_action, self.current_inputs))
            self.current_action = None
            self.current_inputs = {}


def session():
    value = requests.Session()
    value.trust_env = False
    return value


def request(client, method, url, **kwargs):
    try:
        return client.request(method, url, timeout=kwargs.pop("timeout", TIMEOUT), **kwargs)
    except requests.RequestException as exc:
        raise CheckFailure("request failed") from None


def ready(url, label):
    deadline = time.monotonic() + 120
    while time.monotonic() < deadline:
        try:
            response = request(session(), "GET", url, timeout=min(5, max(0.1, deadline - time.monotonic())))
            if response.status_code == 200:
                return response
        except CheckFailure:
            pass
        time.sleep(1)
    raise CheckFailure(label)


def decode_claims(token):
    parts = token.split(".")
    require(len(parts) == 3, "token-format")
    raw = parts[1] + "=" * (-len(parts[1]) % 4)
    return json.loads(base64.urlsafe_b64decode(raw))


def login(issuer, username="smoke-user"):
    client = session()
    discovery = request(client, "GET", issuer + "/.well-known/openid-configuration")
    require(discovery.status_code == 200, "discovery")
    metadata = discovery.json()
    verifier = secrets.token_urlsafe(64)
    challenge = base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).rstrip(b"=").decode()
    state = secrets.token_urlsafe(24)
    params = {"client_id": "smoke-client", "response_type": "code", "scope": "openid",
              "redirect_uri": "http://runner:8080/callback", "state": state,
              "nonce": secrets.token_urlsafe(24), "code_challenge": challenge,
              "code_challenge_method": "S256"}
    page = request(client, "GET", metadata["authorization_endpoint"], params=params)
    require(page.status_code == 200, "authorization-page")
    parser = FormParser()
    parser.feed(page.text)
    require(parser.action is not None, "login-form")
    form = dict(parser.inputs)
    form.update({"username": username, "password": os.environ["SMOKE_PASSWORD"]})
    submitted = request(client, "POST", urljoin(page.url, parser.action), data=form, allow_redirects=False)
    require(submitted.status_code == 302 and "Location" in submitted.headers, "login-redirect")
    callback = urlparse(urljoin(submitted.url, submitted.headers["Location"]))
    values = parse_qs(callback.query)
    require(callback.scheme == "http" and callback.hostname == "runner" and callback.port == 8080 and
            callback.path == "/callback" and values.get("state") == [state] and values.get("code"), "callback")
    token_response = request(client, "POST", metadata["token_endpoint"], data={
        "grant_type": "authorization_code", "code": values["code"][0],
        "redirect_uri": "http://runner:8080/callback", "client_id": "smoke-client",
        "client_secret": os.environ["CLIENT_SECRET"], "code_verifier": verifier
    })
    require(token_response.status_code == 200, "token-exchange")
    tokens = token_response.json()
    require(tokens.get("access_token") and tokens.get("id_token"), "token-response")
    access_token = tokens["access_token"]
    claims = decode_claims(access_token)
    header = decode_header(access_token)
    require(claims.get("iss") == issuer, "fixture-token-issuer")
    audience = claims.get("aud")
    require("tdn-smoke-api" in audience if isinstance(audience, list) else audience == "tdn-smoke-api",
            "fixture-token-audience")
    require(isinstance(claims.get("sub"), str) and bool(claims["sub"]), "fixture-token-subject")
    require(isinstance(header.get("kid"), str) and bool(header["kid"]), "fixture-token-key-id")
    require(header.get("typ") == "JWT", "fixture-token-header-type")
    require(claims.get("typ") == "Bearer", "fixture-token-claim-type")
    expiration = claims.get("exp")
    require(type(expiration) in (int, float) and expiration > time.time(), "fixture-token-expiration")
    return access_token, tokens["id_token"], claims


def decode_header(token):
    part = token.split(".")[0]
    raw = part + "=" * (-len(part) % 4)
    return json.loads(base64.urlsafe_b64decode(raw))


def admin_session():
    client = session()
    response = request(client, "POST", "http://idp:8080/realms/master/protocol/openid-connect/token",
                       data={"grant_type": "password", "client_id": "admin-cli", "username": "admin",
                             "password": os.environ["ADMIN_PASSWORD"]})
    require(response.status_code == 200, "admin-authentication")
    value = response.json().get("access_token")
    require(value, "admin-token")
    client.headers["Authorization"] = "Bearer " + value
    return client


def admin_request(client, method, path, **kwargs):
    allowed = {"/admin/realms/smoke-a", "/admin/realms/smoke-a/components",
               "/admin/realms/smoke-b", "/admin/realms/smoke-b/users"}
    require(path in allowed, "admin-path")
    response = request(client, method, "http://idp:8080" + path, **kwargs)
    require(response.status_code < 400, "admin-operation")
    return response


def authorization_transaction(issuer):
    client = session()
    discovery = request(client, "GET", issuer + "/.well-known/openid-configuration")
    require(discovery.status_code == 200, "registration-discovery")
    metadata = discovery.json()
    verifier = secrets.token_urlsafe(64)
    challenge = base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).rstrip(b"=").decode()
    state = secrets.token_urlsafe(24)
    params = {"client_id": "smoke-client", "response_type": "code", "scope": "openid",
              "redirect_uri": "http://runner:8080/callback", "state": state,
              "nonce": secrets.token_urlsafe(24), "code_challenge": challenge,
              "code_challenge_method": "S256"}
    page = request(client, "GET", metadata["authorization_endpoint"], params=params)
    require(page.status_code == 200, "registration-authorization-page")
    parser = FormParser()
    parser.feed(page.text)
    registration_link = next((link for link in parser.links if "login-actions/registration" in link), None)
    require(registration_link, "registration-link")
    registration_page = request(client, "GET", urljoin(page.url, registration_link))
    require(registration_page.status_code == 200, "registration-page")
    forms = RegistrationParser()
    forms.feed(registration_page.text)
    require(len(forms.forms) == 1, "registration-form")
    action, fields = forms.forms[0]
    return client, urljoin(registration_page.url, action), fields


def registration_realm(client):
    response = admin_request(client, "GET", "/admin/realms/smoke-b")
    return response.json()


def set_registration(client, enabled):
    realm = registration_realm(client)
    realm["registrationAllowed"] = enabled
    response = admin_request(client, "PUT", "/admin/realms/smoke-b", json=realm)
    require(response.status_code == 204, "registration-setting")


def admin_user(client, username):
    response = admin_request(client, "GET", "/admin/realms/smoke-b/users",
                             params={"username": username, "exact": "true"})
    users = response.json()
    require(isinstance(users, list), "registration-user-search")
    return users


def registration_fields(fields, username):
    require(not {"email", "firstName", "lastName"}.intersection(fields), "registration-fields-profile")
    result = dict(fields)
    result.update({"username": username, "password": os.environ["SMOKE_PASSWORD"],
                   "password-confirm": os.environ["SMOKE_PASSWORD"]})
    return result


def registration_result(client, action, fields, username, label, allow_code=False):
    response = request(client, "POST", action, data=registration_fields(fields, username),
                       allow_redirects=False)
    location = response.headers.get("Location", "")
    query = parse_qs(urlparse(urljoin(response.url, location)).query) if location else {}
    require(allow_code or not query.get("code"), label + "-no-code")
    return response


def provider_checks():
    saved = json.loads((DIR / "session.json").read_text())
    admin = admin_session()
    realm = admin_request(admin, "GET", "/admin/realms/smoke-a").json()
    component = {"name": "smoke-rsa-rotation", "providerId": "rsa-generated",
                 "providerType": "org.keycloak.keys.KeyProvider", "parentId": realm["id"],
                 "config": {"priority": ["200"], "enabled": ["true"], "active": ["true"],
                            "keySize": ["2048"], "algorithm": ["RS256"]}}
    created = admin_request(admin, "POST", "/admin/realms/smoke-a/components", json=component)
    require(created.status_code == 201, "signing-component-created")
    old_token = saved["access_token"]
    new_token, _, _ = login(ISSUER_A)
    require(decode_header(old_token).get("kid") != decode_header(new_token).get("kid"), "signing-key-rotated")
    require(validate_one(new_token) == saved["account_id"] and validate_one(old_token) == saved["account_id"],
            "rotation-token-validation")
    require(counts() == (2, 3), "rotation-cardinality")
    saved["access_token"] = new_token
    artifact = DIR / "session.json"
    artifact.write_text(json.dumps(saved))
    artifact.chmod(0o600)

    set_registration(admin, True)
    disabled_client, disabled_action, disabled_fields = authorization_transaction(ISSUER_B)
    set_registration(admin, False)
    registration_result(disabled_client, disabled_action, disabled_fields,
                        "smoke-disabled-registration", "registration-disabled")
    require(admin_user(admin, "smoke-disabled-registration") == [], "registration-disabled-server-rejection")

    set_registration(admin, True)
    enabled_client, enabled_action, enabled_fields = authorization_transaction(ISSUER_B)
    registration_result(enabled_client, enabled_action, enabled_fields,
                        "smoke-enabled-registration", "registration-enabled", allow_code=True)
    users = admin_user(admin, "smoke-enabled-registration")
    require(len(users) == 1, "registration-enabled-user-created")
    user = users[0]
    require(not user.get("email") and not user.get("firstName") and not user.get("lastName"),
            "registration-user-profile-absent")
    require(counts() == (2, 3), "registration-no-account-created")


def restore_check():
    saved = json.loads((DIR / "session.json").read_text())
    for issuer in (ISSUER_A, ISSUER_B):
        ready(issuer + "/.well-known/openid-configuration", "restored-idp-readiness")
    access, _, claims = login(ISSUER_A)
    saved_claims = decode_claims(saved["access_token"])
    require(claims.get("sub") == saved_claims.get("sub"), "restored-user-subject")
    require(validate_one(access) == saved["account_id"], "restored-account-validation")
    require(validate_one(saved["access_token"]) == saved["account_id"], "restored-old-token-validation")
    require(counts() == (2, 3), "restored-mysql-cardinality")
    saved["access_token"] = access
    artifact = DIR / "session.json"
    artifact.write_text(json.dumps(saved))
    artifact.chmod(0o600)


def db():
    return pymysql.connect(host="mysql", user="accounts", password=os.environ["MYSQL_PASSWORD"],
                           database="accounts", connect_timeout=TIMEOUT, cursorclass=pymysql.cursors.DictCursor)


def counts():
    connection = db()
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT COUNT(*) AS n FROM accounts")
            accounts = cursor.fetchone()["n"]
            cursor.execute("SELECT COUNT(*) AS n FROM external_identities")
            identities = cursor.fetchone()["n"]
        return accounts, identities
    finally:
        connection.close()


def validate_one(token):
    client = session()
    response = request(client, "POST", ACCOUNT + "/internal/auth/validate",
                       headers={"X-Account-Service-Key": os.environ["ACCOUNT_SERVICE_KEY"],
                                "Authorization": "Bearer " + token})
    require(response.status_code == 200, f"account-validation-http-{response.status_code}")
    payload = response.json()
    require(payload.get("valid") is not False, "account-validation-valid-false")
    require(payload.get("valid") is True, "account-validation-valid-missing-or-invalid")
    require("accountId" in payload, "account-validation-account-id-missing")
    require(type(payload["accountId"]) is int, "account-validation-account-id-type")
    require(payload["accountId"] > 0, "account-validation-account-id-nonpositive")
    return payload["accountId"]


def parallel_validate(token):
    with concurrent.futures.ThreadPoolExecutor(max_workers=12) as pool:
        ids = list(pool.map(validate_one, [token] * 12))
    require(len(set(ids)) == 1, "concurrent-account-stability")
    return ids[0]


def gateway(method, path, token=None, **kwargs):
    headers = dict(kwargs.pop("headers", {}))
    if token:
        headers["Authorization"] = "Bearer " + token
    return request(session(), method, GATEWAY + path, headers=headers, **kwargs)


def identity_row(issuer, subject):
    connection = db()
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT AccountId FROM external_identities WHERE Issuer=%s AND Subject=%s",
                           (issuer, subject))
            return cursor.fetchone()
    finally:
        connection.close()


def identity_fk_matches(issuer, subject, account_id):
    connection = db()
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT e.AccountId FROM external_identities e JOIN accounts a ON a.Id=e.AccountId WHERE e.Issuer=%s AND e.Subject=%s",
                           (issuer, subject))
            row = cursor.fetchone()
            return row is not None and row["AccountId"] == account_id
    finally:
        connection.close()


def seed_identity(account_id, issuer, subject):
    connection = db()
    try:
        with connection.cursor() as cursor:
            cursor.execute("INSERT INTO external_identities (AccountId, Issuer, Subject) VALUES (%s, %s, %s)",
                           (account_id, issuer, subject))
        connection.commit()
    finally:
        connection.close()


def normal():
    for issuer in (ISSUER_A, ISSUER_B):
        ready(issuer + "/.well-known/openid-configuration", "idp-discovery")
    ready(ACCOUNT + "/health/ready", "account-readiness")
    response = ready(GATEWAY + "/get_api", "gateway-readiness")
    require(response.status_code == 200, "gateway-api")
    access, id_token, claims = login(ISSUER_A)
    account_id = parallel_validate(access)
    require(counts() == (1, 1), "initial-mysql-cardinality")
    row = identity_row(ISSUER_A, claims["sub"])
    require(row and row["AccountId"] == account_id and identity_fk_matches(ISSUER_A, claims["sub"], account_id),
            "initial-account-link")
    who = gateway("GET", "/whoami", access)
    require(who.status_code == 200, "gateway-whoami")
    require(not re.search(re.escape(access), who.text), "gateway-token-leak")
    body = who.json()
    require(body.get("accountId", body.get("userId")) == account_id, "gateway-identity")
    require(gateway("GET", "/whoami", headers={"Cookie": "access_token=" + access}).status_code == 401,
            "cookie-only-denied")
    forged = gateway("GET", "/whoami", access, headers={"X-User-Id": "999999", "X-Subject": "forged"})
    require(forged.status_code == 200 and forged.json().get("accountId", forged.json().get("userId")) == account_id,
            "forged-identity-ignored")
    parts_bad = access.split(".")
    signature = parts_bad[2]
    tampered_signature = ("A" if signature[0] != "A" else "B") + signature[1:]
    tampered = ".".join((parts_bad[0], parts_bad[1], tampered_signature))
    for bad, label in ((id_token, "id-token-rejected"), (tampered, "signature-rejected")):
        require(gateway("GET", "/whoami", bad).status_code == 401, label)
    parts = access.split(".")
    claims_payload = json.loads(base64.urlsafe_b64decode(parts[1] + "=" * (-len(parts[1]) % 4)))
    claims_payload["iss"] = "http://invalid-issuer.example/realm"
    encoded = base64.urlsafe_b64encode(json.dumps(claims_payload, separators=(",", ":")).encode()).rstrip(b"=").decode()
    foreign = parts[0] + "." + encoded + "." + parts[2]
    require(gateway("GET", "/whoami", foreign).status_code == 401, "foreign-issuer-rejected")
    require(counts() == (1, 1), "invalid-token-no-account")
    upstream_response = gateway("GET", f"/users/{account_id}", access, headers={
        "X-Subject": '{"type":"user","id":999999}', "X-Internal-Service-Key": "forged",
        "Authorization": "Bearer forged", "Cookie": "forged=value"})
    require(upstream_response.status_code == 200, "trusted-upstream-response")
    upstream_body = upstream_response.json()
    require(upstream_body.get("subject") == {"type": "user", "id": account_id} and
            upstream_body.get("authorizationPresent") is False and upstream_body.get("cookiePresent") is False,
            "trusted-upstream-headers")
    direct = request(session(), "GET", UPSTREAM + f"/users/{account_id}",
                     headers={"X-Subject": '{"type":"user","id":999999}'})
    require(direct.status_code == 401, "direct-upstream-denied")
    access_b, _, claims_b = login(ISSUER_B)
    existing = identity_row(ISSUER_B, claims_b["sub"])
    require(existing is None, "realm-b-not-prelinked")
    seed_identity(account_id, ISSUER_B, claims_b["sub"])
    require(validate_one(access_b) == account_id and counts() == (1, 2), "cross-issuer-account-link")
    other_access, _, other_claims = login(ISSUER_A, "smoke-other")
    other_id = validate_one(other_access)
    require(other_id != account_id and counts() == (2, 3), "second-user-account")
    require(validate_one(other_access) == other_id and counts() == (2, 3), "second-user-stability")
    artifact = DIR / "session.json"
    artifact.write_text(json.dumps({"access_token": access, "account_id": account_id}))
    artifact.chmod(0o600)


def load_saved():
    return json.loads((DIR / "session.json").read_text())


def phase_account_down():
    data = load_saved()
    response = gateway("GET", "/whoami", data["access_token"])
    require(response.status_code == 503, "account-down-unavailable")


def phase_account_ready():
    ready(ACCOUNT + "/health/ready", "account-readiness")


def phase_idp_down():
    data = load_saved()
    response = gateway("GET", "/whoami", data["access_token"])
    require(response.status_code == 503, "idp-down-unavailable")


PHASES = {"normal": normal, "account-down": phase_account_down,
          "account-ready": phase_account_ready, "idp-down": phase_idp_down,
          "provider-checks": provider_checks, "restore-check": restore_check}


def main():
    phase = sys.argv[1] if len(sys.argv) == 2 else ""
    require(phase in PHASES, "unknown-phase")
    PHASES[phase]()
    print(f"OIDC phase passed: {phase}")


if __name__ == "__main__":
    try:
        main()
    except CheckFailure as failure:
        print(f"OIDC check failed: {failure}", file=sys.stderr)
        sys.exit(1)
    except Exception:
        frames = traceback.extract_tb(sys.exc_info()[2])
        if frames:
            frame = frames[-1]
            print(f"OIDC check failed: {type(sys.exc_info()[1]).__name__} at {Path(frame.filename).name}:{frame.lineno}",
                  file=sys.stderr)
        else:
            print(f"OIDC check failed: {type(sys.exc_info()[1]).__name__}", file=sys.stderr)
        sys.exit(1)
