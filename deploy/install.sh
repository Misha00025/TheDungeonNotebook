#!/usr/bin/env bash

declare -A selected=() values=() saved=() existing=() config_values=()
declare -a temps=()
areas=(backend web keycloak)
root=${TDN_INSTALL_ROOT:-/opt/tdn}
repository=${TDN_MENU_REPOSITORY:-https://github.com/Misha00025/TheDungeonNotebook.git}
ref=${TDN_MENU_REF:-master}
screen=0 stty_state= stage= phase=preflight
FORM_ERROR=
FS_FINAL=0

fail() { restore_terminal; printf 'Ошибка [%s]: %s\n' "$phase" "$*" >&2; exit 1; }
usage() { printf '%s\n' 'Использование: bash install.sh [--help]' 'Устанавливает выбранные области в /opt/tdn.'; }
restore_terminal() {
    if ((screen)); then printf '\033[?25h\033[?1049l'; screen=0; fi
    [[ -z $stty_state ]] || stty "$stty_state" 2>/dev/null || :
}
cleanup() { restore_terminal; [[ -z $stage ]] || rm -rf -- "$stage"; local file; for file in "${temps[@]}"; do [[ -z $file ]] || rm -f -- "$file"; done; }
cancel() { restore_terminal; printf '\nУстановка отменена.\n' >&2; exit 130; }
enter_screen() {
    [[ -t 0 && -t 1 ]] || fail 'Для выбора параметров нужен интерактивный терминал.'
    stty_state=$(stty -g) || fail 'Не удалось сохранить состояние терминала.'
    printf '\033[?1049h\033[?25l'; screen=1
    stty -echo -icanon || fail 'Не удалось настроить терминал.'
}
page() {
    local title=$1; shift
    printf '\033[H\033[2J%s\n\n' "$title"
    printf '%s\n' "$@"
}
read_value() {
    local key=$1 label=$2 default=${3-} secret=${4:-no} answer
    page "$label" 'Enter — оставить текущее значение; Ctrl+C — отмена.' "$FORM_ERROR"
    FORM_ERROR=
    stty "$stty_state" || fail 'Не удалось включить режим ввода.'
    printf '\033[?25h'
    if [[ $secret == yes ]]; then
        [[ -z $default ]] || printf ' [текущее значение сохранится при пустом вводе]'
        IFS= read -r -s -p "$label: " answer || cancel
        printf '\n'
        [[ -n $answer ]] || answer=$default
    else
        IFS= read -r -e -i "$default" -p "$label: " answer || cancel
    fi
    values[$key]=$answer
    stty -echo -icanon || fail 'Не удалось восстановить режим выбора.'
    printf '\033[?25l'
}
read_secret() { values[$1]=$(openssl rand -hex 32) || fail 'Не удалось создать случайный секрет.'; }
valid_origin() {
    local value=$1 rest authority path
    [[ $value == http://* || $value == https://* ]] || return 1
    rest=${value#*://}; authority=${rest%%/*}; path=${rest#"$authority"}
    [[ -z $path || $path == / ]] || return 1
    valid_http_url "$value"
}
valid_http_url() {
    local value=$1 rest authority path host port
    [[ $value != *[$'\001'-$'\037'$'\177']* && $value != *[[:space:]]* && $value != *@* && $value != *\?* && $value != *\#* ]] || return 1
    [[ $value == http://* || $value == https://* ]] || return 1
    rest=${value#*://}; authority=${rest%%/*}; path=${rest#"$authority"}
    [[ -n $authority ]] || return 1
    if [[ $authority == \[* ]]; then
        [[ $authority == *\]* ]] || return 1
        host=${authority%%\]*}; host=${host#\[}; [[ $host =~ ^[0-9A-Fa-f:.]+$ && $host == *:* ]] || return 1
        local suffix=${authority#*\]}
        [[ -z $suffix ]] || { [[ $suffix == :* ]] || return 1; valid_port "${suffix#:}" || return 1; }
    else
        [[ $authority != *:*:* ]] || return 1
        host=$authority
        if [[ $authority == *:* ]]; then port=${authority##*:}; valid_port "$port" || return 1; host=${authority%:*}; fi
        [[ $host =~ ^[A-Za-z0-9.-]+$ && $host != .* && $host != *..* && $host != *.-* && $host != *-. && $host != -* && $host != *- && $host != *-.* ]]
    fi
}
valid_port() {
    local value=$1 number
    [[ $value =~ ^[0-9]{1,5}$ ]] || return 1
    number=$((10#$value))
    ((number >= 1 && number <= 65535))
}
valid_issuer() {
    valid_http_url "$1"
}
required_value() {
    local key=$1 label=$2 default=${3-} secret=${4:-no}
    default=${values[$key]-$default}
    while :; do read_value "$key" "$label" "$default" "$secret"; default=${values[$key]}; [[ -n ${values[$key]} ]] && return; FORM_ERROR='Значение обязательно.'; done
}
origin_input() {
    local key=$1 label=$2 default=${3-}
    default=${values[$key]-$default}
    while :; do
        read_value "$key" "$label" "$default"
        if valid_origin "${values[$key]}"; then
            while [[ ${values[$key]} == */ ]]; do values[$key]=${values[$key]%/}; done
            return
        fi
        FORM_ERROR='Некорректный HTTP(S) origin.'
    done
}
web_bff_input() {
    local base
    while :; do
        read_value WEB_BFF_BASE 'Browser-доступный BFF_BASE (полный HTTP(S) URL)' "${values[WEB_BFF_BASE]-}"
        valid_http_url "${values[WEB_BFF_BASE]}" || { FORM_ERROR='Некорректный HTTP(S) BFF_BASE URL.'; continue; }
        while [[ ${values[WEB_BFF_BASE]} == */ ]]; do values[WEB_BFF_BASE]=${values[WEB_BFF_BASE]%/}; done
        return
    done
}
select_one() {
    local title=$1; shift; local -a choices=("$@")
    local idx=${SELECT_INITIAL:-0} key
    SELECT_INITIAL=0
    while :; do
        printf '\033[H\033[2J%s\n\n' "$title"
        local i; for ((i=0;i<${#choices[@]};i++)); do if ((i==idx)); then printf ' > %s\n' "${choices[i]}"; else printf '   %s\n' "${choices[i]}"; fi; done
        IFS= read -rsn1 key || cancel
        case $key in $'\e') IFS= read -rsn2 -t .1 key || cancel; case $key in '[A') ((idx>0)) && ((idx--));; '[B') ((idx+1<${#choices[@]})) && ((idx++));; *) cancel;; esac;; '') SELECTED=$idx; return;; esac
    done
}
choose_areas() {
    local idx=0 key
    while :; do
        printf '\033[H\033[2JВыберите новые области установки\n\n'
        local i label; for ((i=0;i<3;i++)); do case $i in 0) label='Backend + BFF';;1) label=Web;;2) label=Keycloak;;esac; [[ ${selected[${areas[i]}]:-0} == 1 ]] && label="[x] $label" || label="[ ] $label"; ((i==idx)) && printf ' > %s\n' "$label" || printf '   %s\n' "$label"; done
        printf '\nSpace — выбрать, Enter — продолжить, Esc — отмена\n'
        IFS= read -rsn1 key || cancel
        case $key in ' ') local area=${areas[idx]}; [[ ${selected[$area]:-0} == 1 ]] && selected[$area]=0 || selected[$area]=1;; '') return;; $'\e') IFS= read -rsn2 -t .1 key || cancel; case $key in '[A') ((idx>0)) && ((idx--));; '[B') ((idx<2)) && ((idx++));; *) cancel;;esac;; esac
    done
}
preflight() {
    local cmd
    for cmd in bash realpath mkdir mktemp chmod cp mv rmdir find dirname git curl docker openssl jq install stty cat rm awk env; do command -v "$cmd" >/dev/null 2>&1 || fail "Не найдена обязательная команда: $cmd"; done
    ((BASH_VERSINFO[0] > 4 || BASH_VERSINFO[0] == 4 && BASH_VERSINFO[1] >= 3)) || fail 'Требуется Bash 4.3 или новее.'
    docker compose version >/dev/null 2>&1 || fail 'Требуется Docker Compose v2.'
    docker info >/dev/null 2>&1 || fail 'Docker daemon недоступен.'
}
filesystem_preflight() {
    local parent area file found previously_existing
    if [[ -d $root ]]; then
        [[ -w $root ]] || fail "Нет прав записи в $root."
    else
        parent=$root
        while [[ ! -e $parent ]]; do parent=$(dirname -- "$parent"); done
        [[ -d $parent && -w $parent ]] || fail "Нет прав записи в ближайший существующий родительский каталог $parent."
    fi
    for file in "$root/menu.sh" "$root/.tdn-menu.conf"; do
        if [[ -e $file || -L $file ]]; then [[ -f $file && ! -L $file ]] || fail "Существующий файл должен быть обычным, не symlink: $file"; fi
    done
    for area in backend web keycloak; do
        [[ ${selected[$area]:-0} == 1 ]] || continue
        previously_existing=${existing[$area]+x}
        file=$root/$area
        [[ ! -L $file ]] || fail "Каталог установки не может быть symlink: $file"
        if [[ ! -e $file ]]; then
            [[ $FS_FINAL == 0 || -z $previously_existing ]] || fail "Существующая область $area исчезла после подтверждения."
            continue
        fi
        [[ -d $file ]] || fail "Путь области не является каталогом: $file"
        found=0
        for parent in compose.yaml compose.yml docker-compose.yaml docker-compose.yml; do [[ -f $file/$parent ]] && found=1; done
        if ((found)); then
            if [[ $FS_FINAL == 1 && -z $previously_existing ]]; then fail "В $file появился существующий Compose после подтверждения; установка остановлена."; fi
            existing[$area]=1; saved[$area]=$file
        elif [[ $FS_FINAL == 1 && -n $previously_existing ]]; then fail "Compose существующей области $area изменился после подтверждения."
        elif [[ -n $(find "$file" -mindepth 1 -maxdepth 1 -print -quit) ]]; then fail "$file содержит данные без Compose; содержимое сохранено."; fi
    done
}
check_project_collisions() {
    local area project directory output working physical
    for area in backend web keycloak; do
        [[ ${selected[$area]:-0} == 1 && -z ${existing[$area]+x} ]] || continue
        project=tdn-$area
        directory=$(realpath -m -- "$root/$area") || fail "Не удалось разрешить путь $area."
        output=$(docker ps -a --filter "label=com.docker.compose.project=$project" --format '{{.Label "com.docker.compose.project.working_dir"}}') || fail "Не удалось проверить Docker project $project."
        while IFS= read -r working; do
            [[ -n $working ]] || continue
            [[ $working == /* ]] || fail "У Docker project $project отсутствует абсолютный working_dir label."
            physical=$(realpath -m -- "$working") || fail "Не удалось разрешить Docker working_dir для $project."
            [[ $physical == "$directory" ]] || fail "Docker project $project уже используется каталогом $physical; установка остановлена без изменения чужого стека."
        done <<< "$output"
    done
}
append_project_name() {
    local envfile=$1 project=$2
    printf "COMPOSE_PROJECT_NAME='%s'\n" "$project" >> "$envfile" || fail 'Не удалось записать Compose project name.'
}
ask_settings() {
    local flow profile
    if [[ ${selected[keycloak]:-0} == 1 && -z ${existing[keycloak]+x} ]]; then
        origin_input KEYCLOAK_URL 'Публичный URL Keycloak' 'http://localhost:8180'
    fi
    if [[ ${selected[backend]:-0} == 1 && -z ${existing[backend]+x} ]]; then
        origin_input BFF_ORIGIN 'Публичный origin BFF (без /bff)' 'http://localhost:5080'
        origin_input WEB_ORIGIN 'Публичный origin доверенного Web'
        if [[ ${selected[keycloak]:-0} == 1 && -z ${existing[keycloak]+x} ]]; then [[ ${values[OIDC_FLOW]-} != external ]] || SELECT_INITIAL=1; select_one 'OIDC-провайдер' 'Использовать устанавливаемый Keycloak' 'Внешний/существующий провайдер'; if ((SELECTED==0)); then flow=local; else flow=external; fi
        else flow=external; fi
        values[OIDC_FLOW]=$flow
        if [[ $flow == local ]]; then values[TOKEN_PROFILE]=0; values[BFF_AUTHORITY]=${values[KEYCLOAK_URL]%/}/realms/shared-local; values[ACCOUNT_ISSUER]=${values[BFF_AUTHORITY]}; values[ACCOUNT_AUDIENCE]=tdn-api; values[OIDC_CLIENT_ID]=tdn-bff; values[CLIENT_AUTH]=PostBody; if [[ ${values[KEYCLOAK_URL]} == http://* ]]; then values[ALLOW_HTTP]=true; else values[ALLOW_HTTP]=false; fi; fi
        if [[ $flow == external ]]; then
            while :; do required_value BFF_AUTHORITY 'BFF Authority issuer'; valid_issuer "${values[BFF_AUTHORITY]}" && break; FORM_ERROR='Некорректный issuer URL.'; done
            while :; do required_value ACCOUNT_ISSUER 'Account Issuer' "${values[BFF_AUTHORITY]}"; valid_issuer "${values[ACCOUNT_ISSUER]}" && break; FORM_ERROR='Некорректный issuer URL.'; done
            required_value ACCOUNT_AUDIENCE 'Account audience'
            required_value OIDC_CLIENT_ID 'OIDC ClientId'
            case ${values[CLIENT_AUTH]-PostBody} in Basic) SELECT_INITIAL=1;;None) SELECT_INITIAL=2;;esac
            select_one 'Client authentication' PostBody Basic None
            case $SELECTED in 0) values[CLIENT_AUTH]=PostBody;;1) values[CLIENT_AUTH]=Basic;;2) values[CLIENT_AUTH]=None;;esac
            if [[ ${values[CLIENT_AUTH]} == None ]]; then values[OIDC_CLIENT_SECRET]=; else required_value OIDC_CLIENT_SECRET 'OIDC ClientSecret' "${values[OIDC_CLIENT_SECRET]-}" yes; fi
            [[ ${values[TOKEN_PROFILE]-0} != 1 ]] || SELECT_INITIAL=1
            select_one 'Token profile' 'Keycloak (JWT + typ=Bearer)' 'RFC9068 (at+jwt)'
            values[TOKEN_PROFILE]=$SELECTED
            if [[ ${values[ACCOUNT_ISSUER]} == http://* ]]; then
                [[ ${values[ALLOW_HTTP]-false} != true ]] || SELECT_INITIAL=1
                select_one 'Account issuer использует HTTP. Разрешить небезопасную HTTP metadata?' 'Отмена' 'Подтвердить HTTP metadata'
                ((SELECTED==1)) || cancel
                values[ALLOW_HTTP]=true
            else values[ALLOW_HTTP]=false; fi
        fi
    fi
    if [[ ${selected[web]:-0} == 1 && -z ${existing[web]+x} ]]; then
        local def=
        [[ ${selected[backend]:-0} != 1 || -n ${existing[backend]+x} ]] || def=${values[BFF_ORIGIN]}/bff
        [[ -n ${values[WEB_BFF_BASE]+x} ]] || values[WEB_BFF_BASE]=$def
        web_bff_input
    fi
    local key
    for key in KEYCLOAK_URL BFF_ORIGIN WEB_ORIGIN; do
        [[ -n ${values[$key]-} ]] || continue
        while [[ ${values[$key]} == */ ]]; do values[$key]=${values[$key]%/}; done
    done
}
confirm_plan() {
    local key label title; local -a lines=('Проверьте выбранные области и параметры. Секреты не отображаются.') choices=('Отмена' 'Назад к настройкам' 'Установить')
    for key in backend web keycloak; do [[ ${selected[$key]:-0} == 1 ]] || continue; case $key in backend) label='Backend + BFF';;web) label=Web;;keycloak) label=Keycloak;;esac; if [[ -n ${existing[$key]+x} ]]; then lines+=("Существующая область: $label"); else lines+=("Новая область: $label"); fi; done
    [[ ${selected[keycloak]:-0} != 1 || -n ${existing[keycloak]+x} ]] || lines+=("Keycloak URL: ${values[KEYCLOAK_URL]}")
    [[ ${selected[backend]:-0} != 1 || -n ${existing[backend]+x} ]] || lines+=("BFF: ${values[BFF_ORIGIN]}/bff — Web: ${values[WEB_ORIGIN]}" "OIDC: ${values[BFF_AUTHORITY]} — client ${values[OIDC_CLIENT_ID]} — audience ${values[ACCOUNT_AUDIENCE]} — ${values[CLIENT_AUTH]}")
    if [[ -z ${existing[backend]+x} && ${values[BFF_AUTHORITY]-} == http://* ]]; then lines+=('Внимание: BFF использует HTTP metadata без HTTPS.'); fi
    if [[ -z ${existing[backend]+x} && ${values[ALLOW_HTTP]-false} == true ]]; then lines+=('Внимание: Account использует HTTP metadata без HTTPS.'); fi
    [[ ${selected[web]:-0} != 1 || -n ${existing[web]+x} ]] || lines+=("Web BFF: ${values[WEB_BFF_BASE]}")
    title=$(printf '%s\n' "${lines[@]}")
    select_one "$title" "${choices[@]}"
    case $SELECTED in 0) cancel;;1) return 1;;2) return 0;;esac
}
compose_env() {
    local example=$1 output=$2 line key value
    : > "$output" || return 1
    while IFS= read -r line || [[ -n $line ]]; do
        if [[ $line =~ ^([A-Z0-9_]+)= ]]; then
            key=${BASH_REMATCH[1]}; value=${values[$key]-}
            if [[ -n ${values[$key]+x} ]]; then value=${value//\'/\\\'}; printf "%s='%s'\n" "$key" "$value" >> "$output" || return 1; continue; fi
        fi
        printf '%s\n' "$line" >> "$output" || return 1
    done < "$example"
}
json_configs() {
    local area=$1 dir=$2 source=$3 secret_file
    if [[ $area == backend ]]; then
        mkdir -p "$dir/config/account" "$dir/config/bff" || fail 'Не удалось подготовить каталоги конфигурации.'
        jq --arg iss "${values[ACCOUNT_ISSUER]}" --arg aud "${values[ACCOUNT_AUDIENCE]}" --argjson allow "${values[ALLOW_HTTP]:-false}" --arg profile "${values[TOKEN_PROFILE]:-1}" '.Accounts.FirstAccountId=1 | .Oidc.Providers[0].Issuer=$iss | .Oidc.Providers[0].Audiences=[$aud] | .Oidc.Providers[0].AllowHttpForDevelopment=$allow | if $profile=="0" then .Oidc.Providers[0].ValidHeaderTypes=["JWT"] | .Oidc.Providers[0].AccessTokenTypeClaim="typ" | .Oidc.Providers[0].AccessTokenTypeValues=["Bearer"] else . end' "$source/apps/backend/account-service/config/accounts.template.json" > "$dir/config/account/accounts.json" || fail 'Не удалось сформировать Account JSON.'
        local authority=${values[BFF_AUTHORITY]-} require_https=true
        [[ $authority != http://* ]] || require_https=false
        secret_file=$(umask 077; mktemp "$dir/.bff-secret.XXXXXX") || fail 'Не удалось подготовить временный secret input.'
        temps+=("$secret_file")
        printf '%s' "${values[OIDC_CLIENT_SECRET]-}" > "$secret_file" || fail 'Не удалось записать временный secret input.'
        jq --arg authority "$authority" --arg id "${values[OIDC_CLIENT_ID]}" --rawfile secret "$secret_file" --arg auth "${values[CLIENT_AUTH]}" --arg web "${values[WEB_ORIGIN]}" --argjson https "$require_https" '.Oidc.Authority=$authority | .Oidc.ClientId=$id | .Oidc.ClientSecret=$secret | .Oidc.RequireHttpsMetadata=$https | .Bff.ClientAuthentication=$auth | .Bff.Web.PublicOrigin=$web | .Bff.Web.AllowedOrigins=[$web]' "$source/apps/bff/web/config/appsettings.json" > "$dir/config/bff/appsettings.json" || fail 'Не удалось сформировать BFF JSON.'
        rm -f -- "$secret_file" || fail 'Не удалось удалить временный secret input.'
        chmod 600 "$dir/config/account/accounts.json" "$dir/config/bff/appsettings.json" || fail 'Не удалось защитить конфигурационные файлы.'
    fi
}
add_keycloak_secret_environment() {
    local compose=$1 envfile=$2 temp anchor line
    anchor='      KC_BOOTSTRAP_ADMIN_PASSWORD: ${KEYCLOAK_ADMIN_PASSWORD:?Run the Keycloak setup script first}'
    line='      TDN_BFF_CLIENT_SECRET: ${TDN_BFF_CLIENT_SECRET:?Set TDN_BFF_CLIENT_SECRET in .env}'
    temp=$(umask 077; mktemp "${compose}.XXXXXX") || fail 'Не удалось подготовить Keycloak Compose patch.'
    temps+=("$temp")
    awk -v anchor="$anchor" -v line="$line" '$0 == anchor { count++; print; print line; next } { print } END { if (count != 1) exit 1 }' "$compose" > "$temp" || fail 'Keycloak Compose bootstrap anchor изменился; bundle не установлен.'
    chmod 644 "$temp" || fail 'Не удалось установить права Keycloak Compose.'
    mv -fT -- "$temp" "$compose" || fail 'Не удалось применить Keycloak Compose environment.'
    printf "TDN_BFF_CLIENT_SECRET='%s'\n" "${values[OIDC_CLIENT_SECRET]}" >> "$envfile" || fail 'Не удалось записать Keycloak client secret.'
    chmod 600 "$envfile" || fail 'Не удалось защитить Keycloak .env.'
}
main() {
    set +x
    [[ ${1-} != --help ]] || { usage; return 0; }
    (($#==0)) || { usage >&2; return 2; }
    preflight
    root=$(realpath -m -- "$root") || fail 'Не удалось нормализовать корень установки.'
    [[ $root == /* && $root != / && $root != *$'\t'* && $root != *$'\n'* ]] || fail 'Корень установки должен быть абсолютным безопасным путём.'
    trap cleanup EXIT
    trap cancel INT TERM
    enter_screen
    choose_areas
    [[ ${selected[backend]:-0}${selected[web]:-0}${selected[keycloak]:-0} == *1* ]] || fail 'Выберите хотя бы одну новую область.'
    filesystem_preflight
    check_project_collisions
    if [[ ${selected[backend]:-0} == 1 && -z ${existing[backend]+x} || ${selected[web]:-0} == 1 && -z ${existing[web]+x} ]]; then command -v make >/dev/null 2>&1 || fail 'Для выбранной сборки требуется Make.'; fi
    ask_settings
    while ! confirm_plan; do ask_settings; done
    restore_terminal
    printf '[prepare] Генерация секретов и финальная проверка целевых каталогов.\n'
    FS_FINAL=1
    filesystem_preflight
    if [[ ${selected[keycloak]:-0} == 1 && -z ${existing[keycloak]+x} ]]; then read_secret POSTGRES_PASSWORD; read_secret KEYCLOAK_ADMIN_PASSWORD; fi
    if [[ ${selected[backend]:-0} == 1 && -z ${existing[backend]+x} ]]; then read_secret MYSQL_ROOT_PASSWORD; read_secret MYSQL_PASSWORD; read_secret MONGO_INITDB_ROOT_PASSWORD; read_secret ACCOUNT_SERVICE_KEY; read_secret INTERNAL_SERVICE_KEY; fi
    if [[ ${selected[keycloak]:-0} == 1 && -z ${existing[keycloak]+x} && ${selected[backend]:-0} == 1 && -z ${existing[backend]+x} && ${values[OIDC_FLOW]-} == local ]]; then read_secret OIDC_CLIENT_SECRET; fi
    local compose_env_name
    while IFS= read -r compose_env_name; do unset "$compose_env_name"; done < <(compgen -e COMPOSE_)
    phase=checkout
    printf '[sources] Получение исходников в %s/.sources.\n' "$root"
    mkdir -p -- "$root" || fail "Не удалось создать $root."
    local src=$root/.sources status
    if [[ -e $src ]]; then
        [[ -d $src && ! -L $src ]] || fail 'root/.sources занят не-каталогом или symlink.'
        if [[ -n $(find "$src" -mindepth 1 -maxdepth 1 -print -quit) ]]; then
            [[ $(git -C "$src" rev-parse --show-toplevel 2>/dev/null) == "$src" ]] || fail 'root/.sources занят не-Git каталогом.'
            status=$(git -C "$src" status --porcelain) || fail 'Не удалось проверить checkout.'
            [[ -z $status ]] || fail 'Checkout root/.sources содержит локальные изменения.'
            GIT_TERMINAL_PROMPT=0 git -C "$src" pull --ff-only origin "$ref" || fail 'Не удалось обновить checkout fast-forward.'
        else rmdir "$src" || fail 'Не удалось освободить пустой каталог source.'; fi
    fi
    if [[ ! -d $src ]]; then GIT_TERMINAL_PROMPT=0 git clone --branch "$ref" --single-branch -- "$repository" "$src" || fail 'Не удалось клонировать исходники.'; fi
    [[ $(git -C "$src" rev-parse --show-toplevel 2>/dev/null) == "$src" ]] || fail 'Source checkout root не совпадает с root/.sources.'
    bash -n "$src/deploy/menu.sh" || fail 'Исходный menu.sh не прошёл bash -n.'
    phase=staging
    printf '[prepare] Подготовка выбранных bundles и конфигурации.\n'
    stage=$(mktemp -d "$root/.install-stage.XXXXXX") || fail 'Не удалось создать staging.'
    local area dest
    for area in backend web keycloak; do
        [[ ${selected[$area]:-0} == 1 ]] || continue
        dest=$root/$area
        if [[ -e $dest ]]; then
            [[ -d $dest && ! -L $dest ]] || fail "$dest не является обычным каталогом."
            local compose_found=0 file
            for file in compose.yaml compose.yml docker-compose.yaml docker-compose.yml; do [[ -f $dest/$file ]] && compose_found=1; done
            if ((compose_found)); then saved[$area]=$dest; existing[$area]=1; continue; fi
            [[ -z $(find "$dest" -mindepth 1 -maxdepth 1 -print -quit) ]] || fail "$dest содержит файлы, но Compose не найден; данные сохранены, установка остановлена."
        fi
        mkdir -p "$stage/$area" || fail "Не удалось подготовить staging для $area."
        case $area in
            backend) cp "$src/deploy/backend/docker-compose.yaml" "$src/deploy/backend/.env.example" "$src/deploy/backend/README.md" "$src/deploy/backend/.gitignore" "$stage/$area/" || fail 'Не удалось скопировать Backend bundle.'; compose_env "$src/deploy/backend/.env.example" "$stage/$area/.env" || fail 'Не удалось создать Backend .env.'; append_project_name "$stage/$area/.env" tdn-backend; json_configs backend "$stage/$area" "$src" ;;
            web) cp "$src/deploy/web/docker-compose.yaml" "$src/deploy/web/.env.example" "$src/deploy/web/README.md" "$src/deploy/web/.gitignore" "$stage/$area/" || fail 'Не удалось скопировать Web bundle.'; values[BFF_BASE]=${values[WEB_BFF_BASE]}; values[API_BASE]=${values[WEB_BFF_BASE]%/}/api; compose_env "$src/deploy/web/.env.example" "$stage/$area/.env" || fail 'Не удалось создать Web .env.'; append_project_name "$stage/$area/.env" tdn-web ;;
            keycloak)
                mkdir -p "$stage/$area/import" "$stage/$area/themes/tdn/login/resources/css" "$stage/$area/themes/tdn/login/resources/img" "$stage/$area/themes/tdn/login/messages" || fail 'Не удалось подготовить Keycloak bundle.'
                cp "$src/deploy/keycloak/docker-compose.yml" "$src/deploy/keycloak/.env.example" "$src/deploy/keycloak/README.md" "$src/deploy/keycloak/.gitignore" "$stage/$area/" || fail 'Не удалось скопировать Keycloak bundle.'
                cp "$src/deploy/keycloak/import/shared-local-realm.json" "$stage/$area/import/shared-local-realm.json" || fail 'Не удалось скопировать Keycloak realm import.'
                chmod 644 "$stage/$area/import/shared-local-realm.json" || fail 'Не удалось установить права Keycloak realm import.'
                cp "$src/deploy/keycloak/themes/tdn/login/theme.properties" "$stage/$area/themes/tdn/login/theme.properties" || fail 'Не удалось скопировать Keycloak theme.'
                cp "$src/deploy/keycloak/themes/tdn/login/register.ftl" "$stage/$area/themes/tdn/login/register.ftl" || fail 'Не удалось скопировать Keycloak theme.'
                cp "$src/deploy/keycloak/themes/tdn/login/resources/css/tdn.css" "$stage/$area/themes/tdn/login/resources/css/tdn.css" || fail 'Не удалось скопировать Keycloak theme.'
                cp "$src/deploy/keycloak/themes/tdn/login/resources/img/tdn-mark.svg" "$stage/$area/themes/tdn/login/resources/img/tdn-mark.svg" || fail 'Не удалось скопировать Keycloak theme.'
                cp "$src/deploy/keycloak/themes/tdn/login/messages/messages_ru.properties" "$stage/$area/themes/tdn/login/messages/messages_ru.properties" || fail 'Не удалось скопировать Keycloak theme.'
                cp "$src/deploy/keycloak/themes/tdn/login/messages/messages_en.properties" "$stage/$area/themes/tdn/login/messages/messages_en.properties" || fail 'Не удалось скопировать Keycloak theme.'
                chmod 755 "$stage/$area/import" "$stage/$area/themes" "$stage/$area/themes/tdn" "$stage/$area/themes/tdn/login" "$stage/$area/themes/tdn/login/resources" "$stage/$area/themes/tdn/login/resources/css" "$stage/$area/themes/tdn/login/resources/img" "$stage/$area/themes/tdn/login/messages" || fail 'Не удалось установить права каталогов Keycloak.'
                find "$stage/$area/themes" -type f -exec chmod 644 {} + || fail 'Не удалось установить права темы Keycloak.'
                compose_env "$src/deploy/keycloak/.env.example" "$stage/$area/.env" || fail 'Не удалось создать Keycloak .env.'
                append_project_name "$stage/$area/.env" tdn-keycloak
                ;;
        esac
        chmod 600 "$stage/$area/.env" || fail "Не удалось защитить $area/.env."
    done
    if [[ ${selected[keycloak]:-0} == 1 && -z ${existing[keycloak]+x} && ${selected[backend]:-0} == 1 && -z ${existing[backend]+x} && ${values[OIDC_FLOW]} == local ]]; then
        jq --arg secret '${TDN_BFF_CLIENT_SECRET}' --arg redirect "${values[BFF_ORIGIN]}/bff/callback" --arg logout "${values[BFF_ORIGIN]}/bff/signout-callback" '. + {clients: ((.clients // []) + [{clientId:"tdn-bff",secret:$secret,enabled:true,protocol:"openid-connect",publicClient:false,standardFlowEnabled:true,implicitFlowEnabled:false,directAccessGrantsEnabled:false,serviceAccountsEnabled:false,redirectUris:[$redirect],attributes:{"post.logout.redirect.uris":$logout,"pkce.code.challenge.method":"S256"},protocolMappers:[{name:"tdn-api audience",protocol:"openid-connect",protocolMapper:"oidc-audience-mapper",consentRequired:false,config:{"included.custom.audience":"tdn-api","id.token.claim":"false","access.token.claim":"true"}}]}])}' "$src/deploy/keycloak/import/shared-local-realm.json" > "$stage/keycloak/import/shared-local-realm.json" || fail 'Не удалось подготовить Keycloak realm import.'
        chmod 644 "$stage/keycloak/import/shared-local-realm.json" || fail 'Не удалось установить права Keycloak realm import.'
        add_keycloak_secret_environment "$stage/keycloak/docker-compose.yml" "$stage/keycloak/.env"
    fi
    phase=build
    printf '[build] Сборка новых application images.\n'
    if [[ ${selected[backend]:-0} == 1 && -z ${existing[backend]+x} ]]; then env -u COMPOSE_FILE -u COMPOSE_PROJECT_NAME -u COMPOSE_PROFILES -u COMPOSE_ENV_FILES make -C "$src" build-backend build-bff SERVICE= IMAGE_TAG=latest WEB_BUILD_ENV=template.env.build BUILD_FLAGS= || fail 'Сборка Backend/BFF завершилась ошибкой.'; fi
    if [[ ${selected[web]:-0} == 1 && -z ${existing[web]+x} ]]; then env -u COMPOSE_FILE -u COMPOSE_PROJECT_NAME -u COMPOSE_PROFILES -u COMPOSE_ENV_FILES make -C "$src" build-web SERVICE= IMAGE_TAG=latest WEB_BUILD_ENV=template.env.build BUILD_FLAGS= || fail 'Сборка Web завершилась ошибкой.'; fi
    if [[ ${selected[keycloak]:-0} == 1 && -z ${existing[keycloak]+x} ]]; then if env -u COMPOSE_FILE -u COMPOSE_PROJECT_NAME -u COMPOSE_PROFILES -u COMPOSE_ENV_FILES docker compose --project-directory "$stage/keycloak" --env-file "$stage/keycloak/.env" -f "$stage/keycloak/docker-compose.yml" pull 2>/dev/null; then :; else fail 'Не удалось загрузить образы Keycloak/PostgreSQL.'; fi; fi
    phase=compose-validation
    printf '[validate] Проверка всех новых Compose-конфигураций.\n'
    for area in backend web keycloak; do [[ -d $stage/$area ]] || continue; local compose=docker-compose.yaml; [[ $area != keycloak ]] || compose=docker-compose.yml; (cd "$stage/$area" && env -u COMPOSE_FILE -u COMPOSE_PROJECT_NAME -u COMPOSE_PROFILES -u COMPOSE_ENV_FILES docker compose --project-directory "$stage/$area" --env-file .env -f "$compose" config --quiet) >/dev/null 2>&1 || fail "Compose validation завершилась ошибкой для $area."; done
    phase=install
    printf '[place] Размещение новых bundle directories без перезаписи существующих.\n'
    for area in backend web keycloak; do
        [[ -d $stage/$area ]] || continue
        dest=$root/$area
        if [[ -d $dest && -z $(find "$dest" -mindepth 1 -maxdepth 1 -print -quit) ]]; then rmdir "$dest" || fail "Не удалось убрать пустой каталог $dest."; fi
        [[ ! -e $dest && ! -L $dest ]] || fail "$dest появился во время подготовки; существующие файлы сохранены."
        mv -nT -- "$stage/$area" "$dest" || fail "Не удалось установить $area."
        [[ ! -e $stage/$area && -d $dest ]] || fail "$dest появился во время публикации; staged bundle сохранён."
        saved[$area]=$dest
    done
    phase=menu-delivery
    printf '[menu] Безопасная доставка menu.sh и конфигурации.\n'
    if [[ -e $root/menu.sh || -L $root/menu.sh ]]; then
        [[ -f $root/menu.sh && ! -L $root/menu.sh ]] || fail 'menu.sh стал symlink или не-обычным файлом.'
    else
        local menu_temp
        menu_temp=$(umask 077; mktemp "$root/.menu.sh.XXXXXX") || fail 'Не удалось подготовить временный menu.sh.'
        temps+=("$menu_temp")
        install -m 0755 "$src/deploy/menu.sh" "$menu_temp" || fail 'Не удалось установить временный menu.sh.'
        [[ ! -e $root/menu.sh && ! -L $root/menu.sh ]] || fail 'menu.sh появился во время установки; существующий файл сохранён.'
        mv -nT -- "$menu_temp" "$root/menu.sh" || fail 'Не удалось атомарно доставить menu.sh.'
        [[ -f $root/menu.sh && ! -L $root/menu.sh ]] || fail 'После доставки menu.sh не является обычным файлом.'
        IFS= read -r file < "$root/menu.sh" || fail 'Не удалось проверить menu.sh.'
        [[ $file == '#!/usr/bin/env bash' || $file == '#!/bin/bash' ]] || fail 'Доставленный menu.sh не прошёл проверку shebang.'
        rm -f -- "$menu_temp" || fail 'Не удалось убрать временный menu.sh.'
    fi
    phase=menu-config
    local conf=$root/.tdn-menu.conf tmp record
    [[ ! -e $conf && ! -L $conf || -f $conf && ! -L $conf ]] || fail 'Конфигурация меню стала symlink или не-обычным файлом.'
    tmp=$(umask 077; mktemp "$root/.tdn-menu.XXXXXX") || fail 'Не удалось подготовить конфигурацию меню.'
    temps+=("$tmp")
    config_values=()
    if [[ -f $conf ]]; then
        while IFS= read -r record || [[ -n $record ]]; do
            [[ $record == *$'\t'* ]] || continue
            key=${record%%$'\t'*}; value=${record#*$'\t'}
            [[ $value != *$'\t'* ]] || continue
            case $key in backend|web|keycloak|source) [[ -n ${config_values[$key]+x} ]] || config_values[$key]=$value;; esac
        done < "$conf"
    fi
    for area in backend web keycloak; do
        if [[ ${selected[$area]:-0} == 1 && -n ${saved[$area]-} ]]; then config_values[$area]=${saved[$area]}; fi
    done
    config_values[source]=$src
    for key in backend web keycloak source; do printf '%s\t%s\n' "$key" "${config_values[$key]-}" >> "$tmp" || fail 'Не удалось сформировать конфигурацию меню.'; done
    chmod 600 "$tmp" || fail 'Не удалось защитить конфигурацию меню.'
    [[ ! -e $conf && ! -L $conf || -f $conf && ! -L $conf ]] || fail 'Конфигурация меню изменилась и не может быть заменена.'
    mv -fT -- "$tmp" "$conf" || fail 'Не удалось атомарно сохранить конфигурацию меню.'
    phase=startup
    printf '[startup] Запуск только новых областей в порядке Keycloak, Backend+BFF, Web.\n'
    check_project_collisions
    for area in keycloak backend web; do
        [[ ${selected[$area]:-0} == 1 && -z ${existing[$area]+x} ]] || continue
        local compose=docker-compose.yaml rc
        [[ $area != keycloak ]] || compose=docker-compose.yml
        if (cd "$root/$area" && env -u COMPOSE_FILE -u COMPOSE_PROJECT_NAME -u COMPOSE_PROFILES -u COMPOSE_ENV_FILES docker compose --env-file .env -f "$compose" up -d --wait) >/dev/null 2>&1; then printf '[startup] Запуск %s завершён.\n' "$area"; else rc=$?; fail "Запуск $area завершился ошибкой (код $rc); установленные файлы и данные сохранены."; fi
    done
    phase=complete
    printf '[complete] Установка завершена.\n'
    printf '\nГотово. Управляемые области: '
    for area in backend web keycloak; do [[ -n ${saved[$area]-} ]] && printf '%s=%s ' "$area" "${saved[$area]}"; done
    printf '\nМеню: bash %s/menu.sh\n' "$root"
    if [[ ${selected[keycloak]:-0} == 1 && -z ${existing[keycloak]+x} ]]; then printf 'Bootstrap admin: admin; пароль хранится в %s/keycloak/.env. Замените временного администратора через Keycloak UI.\n' "$root"; fi
    if [[ ${values[OIDC_FLOW]-} == local ]]; then printf 'OIDC callback: %s/bff/callback\nOIDC sign-out callback: %s/bff/signout-callback\n' "${values[BFF_ORIGIN]%/}" "${values[BFF_ORIGIN]%/}"; fi
}

if [[ ${BASH_SOURCE[0]} == "$0" ]]; then main "$@"; fi
