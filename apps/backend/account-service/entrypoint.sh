#!/bin/sh
set -eu

ACCOUNT_CONFIG=${ACCOUNT_CONFIG:-/run/account-config/accounts.json}
export ACCOUNT_CONFIG

config_dir=$(dirname "$ACCOUNT_CONFIG")
script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
template="$script_dir/config/accounts.template.json"
tmp=

cleanup() {
    if [ -n "$tmp" ]; then
        rm -f -- "$tmp"
    fi
}

trap cleanup 0
trap 'exit 1' INT TERM

if [ -L "$ACCOUNT_CONFIG" ]; then
    printf '%s\n' "account configuration must be a regular readable file: $ACCOUNT_CONFIG" >&2
    exit 1
fi

if [ -e "$ACCOUNT_CONFIG" ]; then
    if [ ! -f "$ACCOUNT_CONFIG" ] || [ ! -r "$ACCOUNT_CONFIG" ]; then
        printf '%s\n' "account configuration must be a regular readable file: $ACCOUNT_CONFIG" >&2
        exit 1
    fi
else
    if [ ! -f "$template" ] || [ ! -r "$template" ]; then
        printf '%s\n' "account configuration template is unavailable" >&2
        exit 1
    fi

    if [ ! -d "$config_dir" ]; then
        mkdir -p -- "$config_dir"
    fi
    umask 077
    tmp=$(mktemp "$config_dir/.accounts.json.XXXXXX") || {
        printf '%s\n' "unable to create account configuration in: $config_dir" >&2
        exit 1
    }
    if ! cp "$template" "$tmp"; then
        printf '%s\n' "unable to prepare account configuration: $ACCOUNT_CONFIG" >&2
        exit 1
    fi
    created=false
    if ln "$tmp" "$ACCOUNT_CONFIG" 2>/dev/null; then
        created=true
    else
        if [ -L "$ACCOUNT_CONFIG" ] || [ ! -f "$ACCOUNT_CONFIG" ] || [ ! -r "$ACCOUNT_CONFIG" ]; then
            printf '%s\n' "unable to publish account configuration: $ACCOUNT_CONFIG" >&2
            exit 1
        fi
    fi
    if [ "$created" = true ]; then
        printf '%s\n' "created account configuration: $ACCOUNT_CONFIG; required OIDC settings must be configured" >&2
    fi
fi

if [ -L "$ACCOUNT_CONFIG" ] || [ ! -f "$ACCOUNT_CONFIG" ] || [ ! -r "$ACCOUNT_CONFIG" ]; then
    printf '%s\n' "account configuration must be a regular readable file: $ACCOUNT_CONFIG" >&2
    exit 1
fi

if [ "$#" -eq 0 ]; then
    set -- dotnet /app/account-service.dll
fi
cleanup
tmp=
exec "$@"
