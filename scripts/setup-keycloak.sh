#!/bin/sh
set -eu
set +x
LC_ALL=C
export LC_ALL

fail() {
    printf '%s\n' "Keycloak setup failed: $*" >&2
    exit 1
}

usage() {
    printf '%s\n' 'Usage: sh scripts/setup-keycloak.sh [--directory PATH] [--source-dir PATH | --ref REF] [--start | --no-start] [--local] (default: current working directory; starts public HTTP)'
}

directory=$(pwd)
source_dir=
ref=
start=yes
local_only=no
source_set=no
ref_set=no

while [ "$#" -gt 0 ]; do
    case $1 in
        --directory)
            [ "$#" -ge 2 ] && [ -n "$2" ] || fail '--directory requires a non-empty path'
            case $2 in --*) fail '--directory requires a path value' ;; esac
            directory=$2
            shift 2
            ;;
        --source-dir)
            [ "$#" -ge 2 ] && [ -n "$2" ] || fail '--source-dir requires a non-empty path'
            case $2 in --*) fail '--source-dir requires a path value' ;; esac
            source_dir=$2
            source_set=yes
            shift 2
            ;;
        --ref)
            [ "$#" -ge 2 ] && [ -n "$2" ] || fail '--ref requires a non-empty value'
            case $2 in --*) fail '--ref requires a value' ;; esac
            ref=$2
            ref_set=yes
            shift 2
            ;;
        --start)
            start=yes
            shift
            ;;
        --no-start)
            start=no
            shift
            ;;
        --local)
            local_only=yes
            shift
            ;;
        --help)
            usage
            exit 0
            ;;
        *)
            fail "unknown argument: $1"
            ;;
    esac
done

[ "$source_set" = no ] || [ "$ref_set" = no ] || fail '--source-dir and --ref cannot be used together'
if [ "$ref_set" = yes ]; then
    case $ref in ''|/*|*/|*//*|*..*) fail 'unsafe --ref value' ;; esac
    case $ref in *[!A-Za-z0-9._/-]*) fail 'unsafe --ref value' ;; esac
fi

while [ "$directory" != / ] && [ "${directory%/}" != "$directory" ]; do directory=${directory%/}; done
[ "$directory" != / ] || fail 'target directory cannot be /'
[ ! -L "$directory" ] || fail 'target directory cannot be a symlink'
[ ! -e "$directory" ] || [ -d "$directory" ] || fail 'target must be a directory'

tmpbase=${TMPDIR:-/tmp}
stage=$(mktemp -d "$tmpbase/tdn-keycloak-setup.XXXXXX") || fail 'could not create secure staging directory'
cleanup() { rm -rf "$stage"; }
trap cleanup 0
trap 'exit 1' HUP INT TERM
managed_dirs='import themes themes/tdn themes/tdn/login themes/tdn/login/resources themes/tdn/login/resources/css themes/tdn/login/resources/img themes/tdn/login/messages'
for name in $managed_dirs; do mkdir -p "$stage/$name" || fail "could not create staging directory: $name"; done

artifacts='docker-compose.yml import/shared-local-realm.json .env.example .gitignore README.md themes/tdn/login/theme.properties themes/tdn/login/register.ftl themes/tdn/login/resources/css/tdn.css themes/tdn/login/resources/img/tdn-mark.svg themes/tdn/login/messages/messages_ru.properties themes/tdn/login/messages/messages_en.properties'
if [ "$ref_set" = yes ]; then
    fetch_ref=$ref
elif [ "$source_set" = yes ]; then
    fetch_ref=
else
    fetch_ref=
    case $0 in
        /*|*/*)
            script_dir=$(dirname "$0")
            bundle=$script_dir/../deploy/keycloak
            if [ -d "$bundle" ]; then source_dir=$bundle; else fetch_ref=master; fi
            ;;
        *) fetch_ref=master ;;
    esac
fi
if [ -n "$fetch_ref" ]; then
    base=https://raw.githubusercontent.com/Misha00025/TheDungeonNotebook/$fetch_ref/deploy/keycloak
    for name in $artifacts; do
        curl --fail --silent --show-error --location --proto '=https' --proto-redir '=https' --connect-timeout 10 --max-time 30 --max-filesize 1048576 --output "$stage/$name" "$base/$name" || fail "could not fetch setup artifact: $name"
    done
else
    for name in $artifacts; do
        source=$source_dir/$name
        [ -f "$source" ] && [ -r "$source" ] || fail "missing or unreadable setup artifact: $source"
        [ ! -L "$source" ] || fail "setup artifact cannot be a symlink: $source"
        size=$(wc -c < "$source") || fail "could not inspect setup artifact: $source"
        [ "$size" -gt 0 ] && [ "$size" -le 1048576 ] || fail "invalid setup artifact size: $source"
        cp "$source" "$stage/$name" || fail "could not stage setup artifact: $name"
    done
fi
for name in $artifacts; do
    [ -f "$stage/$name" ] || fail "missing staged artifact: $name"
    size=$(wc -c < "$stage/$name") || fail "could not inspect staged artifact: $name"
    [ "$size" -gt 0 ] && [ "$size" -le 1048576 ] || fail "invalid staged artifact size: $name"
done

for name in $managed_dirs; do
    path=$directory/$name
    [ ! -L "$path" ] || fail "managed path cannot be a symlink: $path"
    [ ! -e "$path" ] || [ -d "$path" ] || fail "managed path must be a directory: $path"
done
for name in $artifacts; do
    path=$directory/$name
    [ ! -L "$path" ] || fail "managed path cannot be a symlink: $path"
    if [ -e "$path" ]; then
        [ -f "$path" ] || fail "managed path must be a regular file: $path"
        cmp -s "$stage/$name" "$path" || fail "existing managed file differs from setup bundle: $path"
    fi
done

env_path=$directory/.env
[ ! -L "$env_path" ] || fail "managed .env cannot be a symlink: $env_path"

env_exists=no
if [ -e "$env_path" ]; then
    [ -f "$env_path" ] || fail 'existing .env must be a regular file'
    mode=$(stat -c '%a' "$env_path") || fail 'could not inspect .env permissions'
    awk -v mode="$mode" 'BEGIN { n=0; for (i=1; i<=length(mode); i++) n=n*8+substr(mode,i,1); exit (int(n/8)%8 == 0 && n%8 == 0) ? 0 : 1 }' || fail 'existing .env has unsafe permissions'
    awk '
        function trim(s) { sub(/^[[:space:]]+/, "", s); sub(/[[:space:]]+$/, "", s); return s }
        /^[[:space:]]*($|#)/ { next }
        {
            line=$0
            if (line !~ /^[[:space:]]*(POSTGRES_PASSWORD|KEYCLOAK_ADMIN_PASSWORD|KEYCLOAK_URL|KEYCLOAK_BIND_ADDRESS)[[:space:]]*=/) next
            sub(/^[[:space:]]*/, "", line); split(line, pair, "="); key=trim(pair[1]); value=trim(substr(line, index(line, "=")+1)); first=substr(value,1,1)
            if (first=="\"" || first=="\047") {
                if (first=="\"" && value !~ /^"[^"]*"[[:space:]]*(#.*)?$/) malformed=1
                if (first=="\047" && value !~ /^\047[^\047]*\047[[:space:]]*(#.*)?$/) malformed=1
                if (!malformed) { closing=index(substr(value,2), first)+1; value=substr(value,2,closing-2) }
            } else { if (first=="#") value=""; else sub(/[[:space:]]+#.*$/, "", value); value=trim(value) }
            count[key]++; values[key]=value
        }
        END {
            split("POSTGRES_PASSWORD KEYCLOAK_ADMIN_PASSWORD KEYCLOAK_URL KEYCLOAK_BIND_ADDRESS", required, " ")
            for (i in required) { key=required[i]; if (count[key]!=1) malformed=1 }
            if (count["POSTGRES_PASSWORD"]==1 && values["POSTGRES_PASSWORD"]!="") p=1
            if (count["KEYCLOAK_ADMIN_PASSWORD"]==1 && values["KEYCLOAK_ADMIN_PASSWORD"]!="") a=1
            if (values["KEYCLOAK_URL"] ~ /^http:\/\/[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+:8180$/) u=1
            if (values["KEYCLOAK_BIND_ADDRESS"]=="0.0.0.0" || values["KEYCLOAK_BIND_ADDRESS"]=="127.0.0.1") b=1
            if (!p || !a || !u || !b || malformed) exit 1
            print values["KEYCLOAK_URL"] "\n" values["KEYCLOAK_BIND_ADDRESS"]
        }
    ' "$env_path" > "$stage/env-values" || fail 'existing .env is malformed, missing required values, or needs updating with KEYCLOAK_URL and KEYCLOAK_BIND_ADDRESS'
    env_url=$(sed -n '1p' "$stage/env-values")
    env_bind=$(sed -n '2p' "$stage/env-values")
    env_exists=yes
    if [ "$local_only" = yes ] && [ "$env_bind" != 127.0.0.1 ]; then fail 'existing public .env conflicts with --local; resolve the binding configuration explicitly'; fi
else
    if [ -e "$directory/data/postgres/PG_VERSION" ]; then fail 'PostgreSQL data exists without .env; restore the original .env before retrying'; fi
    if [ "$local_only" = yes ]; then host_ip=127.0.0.1; bind_address=127.0.0.1
    else
        command -v ip >/dev/null 2>&1 || fail 'iproute2 is required to determine the default IPv4 address; install it or use --local'
        route=$(ip -4 route get 1.1.1.1 2>/dev/null) || fail 'could not determine the primary-interface IPv4 route; use --local only for loopback access'
        host_ip=$(printf '%s\n' "$route" | awk '{ for (i=1; i<=NF; i++) if ($i=="src" && i<NF) { print $(i+1); exit } }')
        printf '%s\n' "$host_ip" | awk -F. 'NF!=4 { bad=1 } NF==4 { for (i=1;i<=4;i++) if ($i !~ /^[0-9]+$/ || $i<0 || $i>255) bad=1; if ($1==127 || $1+$2+$3+$4==0) bad=1 } END { exit bad ? 1 : 0 }' || fail 'could not determine a valid non-loopback primary-interface IPv4 address'
        [ -n "$host_ip" ] || fail 'could not determine a valid non-loopback primary-interface IPv4 address'
        bind_address=0.0.0.0
    fi
    env_url=http://$host_ip:8180
fi

if [ "$env_exists" = no ]; then
    postgres_password=$(openssl rand -hex 32) || fail 'could not generate setup credentials'
    admin_password=$(openssl rand -hex 32) || fail 'could not generate setup credentials'
    [ -n "$postgres_password" ] && [ -n "$admin_password" ] || fail 'could not generate setup credentials'
    (umask 077; printf 'POSTGRES_PASSWORD=%s\nKEYCLOAK_ADMIN_PASSWORD=%s\nKEYCLOAK_URL=%s\nKEYCLOAK_BIND_ADDRESS=%s\n' "$postgres_password" "$admin_password" "$env_url" "$bind_address" > "$stage/.env") || fail 'could not stage setup credentials'
    chmod 600 "$stage/.env" || fail 'could not protect staged credentials'
    unset postgres_password admin_password
fi

if [ ! -d "$directory" ]; then
    (umask 077; mkdir -p "$directory") || fail "could not create target directory: $directory"
    chmod 700 "$directory" || fail "could not protect target directory: $directory"
fi
for name in $managed_dirs; do
    path=$directory/$name
    if [ ! -d "$path" ]; then mkdir "$path" || fail "could not create managed directory: $path"; chmod 755 "$path" || fail "could not set managed directory permissions: $path"; fi
done
if [ "$env_exists" = no ]; then
    (umask 077; set -C; cat "$stage/.env" > "$env_path") || fail "could not create .env: $env_path"
    chmod 600 "$env_path" || fail "could not protect .env: $env_path"
fi
for name in $artifacts; do
    path=$directory/$name
    if [ ! -e "$path" ]; then (umask 022; set -C; cat "$stage/$name" > "$path") || fail "could not create managed file: $path"; chmod 644 "$path" || fail "could not set managed file permissions: $path"; fi
done

if [ "$start" = yes ]; then
    if (cd "$directory" && docker compose --env-file .env -f docker-compose.yml config --quiet) >/dev/null 2>&1; then :; else code=$?; fail "docker compose config --quiet failed (exit $code)"; fi
    if (cd "$directory" && docker compose --env-file .env -f docker-compose.yml up -d --wait --wait-timeout 180) >/dev/null 2>&1; then :; else code=$?; fail "docker compose up failed (exit $code)"; fi
    printf 'Keycloak is available at %s (Admin Console: %s/admin/).\n' "$env_url" "$env_url"
    printf '%s\n' 'Имя временного bootstrap-администратора: admin; пароль хранится в локальном .env и не выводится.'
    printf '%s\n' 'Для доступа извне нужен разрешённый TCP-порт 8180 и настройка NAT/firewall; скрипт их не меняет. Используется IPv4 основного интерфейса, внешний NAT-IP не определяется.'
else
    printf 'Keycloak setup files are ready in %s but the service was not started. URL: %s (Admin Console: %s/admin/).\n' "$directory" "$env_url" "$env_url"
    printf 'Перейдите в каталог %s и выполните: docker compose --env-file .env -f docker-compose.yml up -d --wait\n' "$directory"
    printf '%s\n' 'Для доступа извне нужен разрешённый TCP-порт 8180 и настройка NAT/firewall; скрипт их не меняет. Используется IPv4 основного интерфейса, внешний NAT-IP не определяется.'
fi
printf '%s\n' 'Первым шагом вручную создайте нового администратора в realm master, проверьте вход с новой учётной записью и удалите временного admin.'
