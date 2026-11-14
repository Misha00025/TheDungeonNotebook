#!/bin/sh
set -eu

app_dir=$(CDPATH= cd "$(dirname "$0")" && pwd)
cd "$app_dir"

mkdir -p "$app_dir/config"
if [ ! -e "$app_dir/config/appsettings.json" ]; then
    default_config="$app_dir/default-config/appsettings.json"
    if [ ! -r "$default_config" ]; then
        printf '%s\n' "BFF default config is unavailable: $default_config" >&2
        exit 1
    fi
    cp -n "$default_config" "$app_dir/config/appsettings.json"
fi

exec dotnet "$app_dir/bff-web.dll" "$@"
