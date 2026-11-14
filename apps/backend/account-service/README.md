# Account service

The account service validates external access tokens and maps `(issuer, subject)` identities to stable internal account IDs. It does not issue tokens, authenticate users with credentials, store profiles, PII, or email addresses, or expose account linking/unlinking APIs. The data model supports multiple external identities per account; linking behavior is not implemented.

## Identity and validation

`accounts` has a one-to-many relationship to `external_identities`. After successful token validation, the service atomically creates an account and its first external identity if the pair is not already present. Concurrent provisioning resolves to the same identity mapping.

`POST /internal/auth/validate` is a service-to-service endpoint, not a browser API. The caller supplies its own `X-Account-Service-Key` and forwards the user token as `Authorization: Bearer <access-token>`. A valid OIDC identity returns HTTP 200 with `valid: true` and `accountId`; an invalid token returns HTTP 200 with `valid: false`. When the optional legacy group-token mode validates a group token, the response instead contains `valid: true`, `groupId`, and `accessLevel` (no account ID). Missing/incorrect caller key returns 401; insufficient configured scopes return 403; unavailable validation dependencies return 503. Responses are `no-store`; the service does not cache validation results, provider metadata, or JWKS.

The gateway-to-domain `INTERNAL_SERVICE_KEY` and the gateway-to-account `ACCOUNT_SERVICE_KEY` are separate credentials with different purposes. Do not reuse one for the other.

Only signed JWT access tokens are currently supported. The JWT must have a non-empty `kid` matching a key in the trusted JWKS fetched for that validation request; missing or unknown `kid` values are rejected. Opaque access tokens are not supported. Configuration selects providers and validation constraints; it does not make the runtime protocol-neutral or permit switching to an arbitrary protocol by configuration alone. The service is not connected to the BFF or Web. Legacy browser login endpoints return 410 until a BFF implementation exists; this does not imply that all Web flows are operational.

Fetching metadata and JWKS for each request without caching does not check the account's current state at the identity provider and does not provide immediate JWT revocation. The service has no token introspection, userinfo, or account-block-status check. A correctly signed, unexpired token may therefore continue to validate after its account is disabled; the possible delay depends on access-token lifetime and identity-provider policy. No immediate lockout is implied.

## Configuration

The service requires `MYSQL_CONNECTION_STRING`. It loads `appsettings.json`, optionally a JSON file named by `ACCOUNT_CONFIG`, then environment variables. Environment variables use .NET's double-underscore nesting convention; arrays are indexed numerically.

| Setting | Meaning |
| --- | --- |
| `MYSQL_CONNECTION_STRING` | Required connection string for the accounts database. |
| `ACCOUNT_CONFIG` | Optional path to an additional JSON configuration file. |
| `InternalAuth:ApiKey` | Internal caller key; configure this or `ApiKeyFile`, not both. At least 32 UTF-8 bytes. |
| `InternalAuth:ApiKeyFile` | Optional path from which to read the internal caller key. |
| `Accounts:FirstAccountId` | Positive integer for the initial account auto-increment value; default `1`. It only affects an empty accounts table. |
| `Oidc:TimeoutSeconds` | Provider request timeout, 1–60 seconds; default 10. |
| `Oidc:Providers` | Required, non-empty provider array with unique exact issuer values. |
| `Oidc:Providers:{i}:Issuer` | Exact token issuer and default metadata discovery base. |
| `Oidc:Providers:{i}:MetadataAddress` | Optional discovery URL; otherwise issuer plus `/.well-known/openid-configuration`. |
| `Oidc:Providers:{i}:JwksUri` | Optional expected JWKS URL; if set, it must equal the discovered JWKS URL. Without it, discovered JWKS must share the metadata origin. |
| `Oidc:Providers:{i}:Audiences` | Required, non-empty list of accepted audiences. |
| `Oidc:Providers:{i}:AllowedAlgorithms` | Allowed asymmetric JWT algorithms; defaults to `RS256`. |
| `Oidc:Providers:{i}:ValidHeaderTypes` | Accepted JWT `typ` values; defaults to `at+jwt` and `application/at+jwt`. Other types require an access-token marker claim. |
| `Oidc:Providers:{i}:AccessTokenTypeClaim` | Optional claim name used to distinguish access tokens when accepting generic JWT types. |
| `Oidc:Providers:{i}:AccessTokenTypeValues` | Required accepted values when `AccessTokenTypeClaim` is configured. |
| `Oidc:Providers:{i}:RequiredScopes` | Optional scopes; all listed values must be present in the space-separated `scope` claim. |
| `Oidc:Providers:{i}:ClockSkewSeconds` | Lifetime clock skew, 0–300 seconds. |
| `Oidc:Providers:{i}:AllowHttpForDevelopment` | Explicitly permits HTTP for this provider; otherwise provider/discovery/JWKS URLs must use HTTPS. Insecure TLS certificate validation is not supported. |
| `LegacyGroups:Enabled` | Enables the separate legacy group-token validator; defaults to false. |
| `LegacyGroups:Issuer` | Required legacy token issuer when enabled; must differ from every OIDC issuer. |
| `LegacyGroups:Audience` | Required legacy token audience when enabled. |
| `LegacyGroups:PublicKeyPath` | Required path to the legacy group-token verification public key when enabled. |
| `LegacyGroups:ClockSkewSeconds` | Legacy token clock skew, 0–300 seconds. |

The root `template.env` also provides these deployment settings. Fill the blank values before startup:

| Root environment variable | Purpose |
| --- | --- |
| `ACCOUNT_SERVICE_KEY` | Required confidential Gateway→Account service key; separate from `INTERNAL_SERVICE_KEY`. |
| `INTERNAL_SERVICE_KEY` | Required Gateway→domain-services key; not the Account service key. |
| `ACCOUNTS_DATABASE` | Dedicated accounts database name. |
| `ACCOUNTS_MYSQL_USER` | Dedicated accounts database user. |
| `ACCOUNTS_MYSQL_PASSWORD` | Password for that database user. |
| `ACCOUNT_SERVICE_URL` | Gateway's Account service URL. |
| `Oidc__Providers__0__Issuer` | Required first provider issuer; template value is blank. |
| `Oidc__Providers__0__Audiences__0` | Required first audience; template value is blank. |

The template also sets the first provider's valid header type and development-HTTP flag, plus `Accounts__FirstAccountId`. Configure additional providers with indexed `Oidc__Providers__{i}__...` variables. Choose a safe first account ID range as described below before enabling this flow against existing domain data.

Example configuration (replace example endpoints with the provider's actual values):

```json
{
  "InternalAuth": { "ApiKeyFile": "/run/secrets/account-service-key" },
  "Accounts": { "FirstAccountId": 1 },
  "Oidc": {
    "TimeoutSeconds": 10,
    "Providers": [
      {
        "Issuer": "https://idp.example/realms/tdn",
        "Audiences": ["tdn-api"],
        "RequiredScopes": ["openid"],
        "ClockSkewSeconds": 60
      }
    ]
  },
  "LegacyGroups": { "Enabled": false }
}
```

For example, a Keycloak provider can use a minimal basic client scope that provides `sub`; email and profile scopes are not needed for identity mapping. It can override `ValidHeaderTypes` with `["JWT"]` and set `AccessTokenTypeClaim` to `typ` with `AccessTokenTypeValues` `["Bearer"]` if that is how that provider marks access tokens. These are provider-configuration examples only; the service has no Keycloak code dependency.

Two-provider environment-variable example:

```dotenv
Oidc__Providers__0__Issuer=https://idp.example/realm-a
Oidc__Providers__0__Audiences__0=tdn-api
Oidc__Providers__1__Issuer=https://login.example/tenant-b
Oidc__Providers__1__Audiences__0=tdn-api
```

## Deployment and account ID allocation

The backend Compose configuration uses `ACCOUNTS_DATABASE`, `ACCOUNTS_MYSQL_USER`, and `ACCOUNTS_MYSQL_PASSWORD` for a separate database/user. `ACCOUNT_SERVICE_KEY` configures the gateway's confidential caller credential and is passed to the service as `InternalAuth:ApiKey`; keep it separate from `INTERNAL_SERVICE_KEY`. Provider settings are supplied through the account service configuration (for example a mounted configuration file or .NET environment variables).

The MySQL initialization script at `apps/backend/account-service/init-accounts.sh` is run automatically only when MySQL initializes a fresh data directory. An existing MySQL data volume is not initialized automatically. After explicitly configuring the account database/user variables in the MySQL service environment, run the script manually inside the MySQL container:

```sh
docker compose exec -T mysql bash /docker-entrypoint-initdb.d/3_accounts.sh
```

If the MySQL service's environment file changed, recreate that container using the deployment's normal safe procedure before running the command; do not bring the whole stack down with volume-removal options. Never delete `mysql_data` or its data. `CREATE USER IF NOT EXISTS` does not change the password of an existing MySQL user. An administrator must synchronize configured and server-side credentials separately.

`FirstAccountId` must be a positive integer in the database's supported integer range. Its default of `1` is appropriate only for a fresh, empty domain with no legacy ID collisions. Existing legacy profiles or campaign grants may reference the same integer IDs, including references outside the legacy authentication table. Do not enable the new account-ID flow until an operator allocates a free range above every legacy user reference and configures the initial ID accordingly. There is no automatic migration, merging, or deletion of legacy data. Changing `FirstAccountId` does not rename IDs already issued.

## Tests and integration checks

```sh
dotnet test apps/backend/account-service/Tests
dotnet test apps/backend/Tdn.Shared/Tests
```

Gateway Python unit tests should run in the gateway image with the complete gateway source mounted at `/workspace/apps/backend/api-gateway` and that directory as the working directory. The isolated real-identity-provider harness is `bash apps/backend/tests/oidc/run.sh`; it scopes its project, volumes, and temporary secrets, and exercises Code+PKCE, parallel MySQL provisioning, a test-only two-issuer binding, registration/rotation/restoration, and outages.

Do not use `apps/backend/tests/test.sh` or `test-ci.sh` for the current authentication flow: these are legacy password-grant harnesses with destructive behavior and are not suitable against valuable data.
