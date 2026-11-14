#!/usr/bin/env bash
set -euo pipefail
umask 077

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd "$script_dir/../../../.." && pwd)"
mkdir -p /tmp/opencode
work_dir="$(mktemp -d /tmp/opencode/tdn-oidc.XXXXXX)"
chmod 700 "$work_dir"
project="tdn-oidc-${RANDOM}-$$"
compose=(docker compose --env-file "$work_dir/.env" -p "$project" -f "$script_dir/compose.yaml")
cleanup() {
  "${compose[@]}" down --volumes --remove-orphans >/dev/null 2>&1 || true
  rm -rf -- "$work_dir"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
python3 "$script_dir/generate_fixtures.py" --directory "$work_dir"
export OIDC_SMOKE_DIR="$work_dir"
cd "$repo_root"
"${compose[@]}" build runner upstream account-service api-gateway
"${compose[@]}" up -d mysql postgres idp account-service upstream api-gateway
"${compose[@]}" run --rm --no-deps runner python runner.py normal
"${compose[@]}" run --rm --no-deps runner python runner.py provider-checks
"${compose[@]}" exec -T postgres pg_dump -U keycloak keycloak > "$work_dir/idp.sql"
"${compose[@]}" stop idp >/dev/null
"${compose[@]}" exec -T postgres psql -U keycloak -d postgres -v ON_ERROR_STOP=1 -c 'CREATE DATABASE keycloak_restore OWNER keycloak;' >/dev/null
"${compose[@]}" exec -T postgres psql -U keycloak -d keycloak_restore -v ON_ERROR_STOP=1 < "$work_dir/idp.sql" >/dev/null
IDP_DATABASE=keycloak_restore "${compose[@]}" up -d --force-recreate idp
"${compose[@]}" run --rm --no-deps runner python runner.py restore-check
"${compose[@]}" stop account-service >/dev/null
"${compose[@]}" run --rm --no-deps runner python runner.py account-down
"${compose[@]}" start account-service >/dev/null
"${compose[@]}" run --rm --no-deps runner python runner.py account-ready
"${compose[@]}" stop idp >/dev/null
"${compose[@]}" run --rm --no-deps runner python runner.py idp-down
printf '%s\n' 'OIDC smoke phases completed.'
