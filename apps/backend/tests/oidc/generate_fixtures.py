import argparse
import json
import secrets
from pathlib import Path


def write_secret(path, content):
    path.write_text(content)
    path.chmod(0o600)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--directory", required=True, type=Path)
    directory = parser.parse_args().directory
    if directory.is_symlink():
        raise SystemExit("fixture directory must not be a symlink")
    if directory.exists():
        if not directory.is_dir() or any(directory.iterdir()):
            raise SystemExit("fixture directory must be empty")
    else:
        directory.mkdir(mode=0o700, parents=True, exist_ok=False)
    directory.chmod(0o700)
    realms = directory / "realms"
    realms.mkdir(mode=0o755)
    root = Path(__file__).resolve().parents[4]
    base = json.loads((root / "deploy/keycloak/import/shared-local-realm.json").read_text())
    values = {name: secrets.token_urlsafe(32) for name in (
        "MYSQL_ROOT_PASSWORD", "MYSQL_PASSWORD", "POSTGRES_PASSWORD", "ACCOUNT_SERVICE_KEY",
        "INTERNAL_SERVICE_KEY", "CLIENT_SECRET", "SMOKE_PASSWORD", "ADMIN_PASSWORD"
    )}
    lines = [f"{key}={value}" for key, value in values.items()]
    lines += ["MYSQL_DATABASE=accounts", "MYSQL_USER=accounts", "POSTGRES_DB=keycloak",
              "KEYCLOAK_ADMIN=admin", f"KEYCLOAK_ADMIN_PASSWORD={values['ADMIN_PASSWORD']}"]
    write_secret(directory / ".env", "\n".join(lines) + "\n")
    for realm_name in ("smoke-a", "smoke-b"):
        realm = json.loads(json.dumps(base))
        realm["realm"] = realm_name
        realm["displayName"] = realm_name
        realm["accessTokenLifespan"] = 900
        realm["clients"] = realm.get("clients", []) + [{
            "clientId": "smoke-client", "name": "smoke-client", "enabled": True,
            "publicClient": False, "secret": values["CLIENT_SECRET"],
            "standardFlowEnabled": True, "directAccessGrantsEnabled": False,
            "implicitFlowEnabled": False, "serviceAccountsEnabled": False,
            "redirectUris": ["http://runner:8080/callback"], "webOrigins": [],
            "defaultClientScopes": ["basic"], "optionalClientScopes": [],
            "attributes": {"pkce.code.challenge.method": "S256"},
            "protocolMappers": [{"name": "tdn-smoke-api-audience", "protocol": "openid-connect",
                "protocolMapper": "oidc-audience-mapper", "consentRequired": False,
                "config": {"included.custom.audience": "tdn-smoke-api",
                           "access.token.claim": "true", "id.token.claim": "false"}}
            ]
        }]
        realm["users"] = [{"username": username, "enabled": True, "emailVerified": False,
                            "requiredActions": [], "credentials": [{"type": "password",
                            "value": values["SMOKE_PASSWORD"], "temporary": False}]}
                           for username in ("smoke-user", "smoke-other")]
        write_secret(realms / f"{realm_name}.json", json.dumps(realm, indent=2) + "\n")
        (realms / f"{realm_name}.json").chmod(0o644)


if __name__ == "__main__":
    main()
