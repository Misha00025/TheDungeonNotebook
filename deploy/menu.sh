#!/usr/bin/env bash

declare -A MENU_PATHS=([backend]="" [web]="" [keycloak]="")
declare -A MENU_DRAFT=([backend]="" [web]="" [keycloak]="")
declare -A MENU_PLAN_SERVICES=([backend]="" [web]="" [keycloak]="")
declare -A MENU_PLAN_DIR=([backend]="" [web]="" [keycloak]="")
declare -A MENU_PLAN_PROJECT=([backend]="" [web]="" [keycloak]="")
declare -A MENU_PLAN_COMPOSE=([backend]="" [web]="" [keycloak]="")
declare -a MENU_COMPOSE_ARGS=() MENU_COMPOSE_FILES=() MENU_SCREEN_BODY=() MENU_SCREEN_ACTIONS=()
declare -a MENU_OUTPUT_LINES=() MENU_SERVICES=() MENU_PROJECTS=() MENU_PROJECT_OPTIONS=()
declare -a MENU_TEMP_FILES=()
MENU_SCRIPT=
MENU_CONFIG=
MENU_SOURCE_DIR=
MENU_SAVED_SOURCE_DIR=
MENU_REPOSITORY=
MENU_REF=
MENU_RAW_URL=
MENU_STTY=
MENU_SCREEN=0
MENU_CHILD=
MENU_LOG=
MENU_ROWS=24
MENU_COLS=80
MENU_CHOICE=0
MENU_FOCUS=0
MENU_SCROLL=0
MENU_HOFFSET=0
MENU_ACTION_SCROLL=0
MENU_SMALL=0
MENU_BODY_AREA=0
MENU_RC=0
MENU_CANCELLED=0
MENU_AREA=
MENU_COMPOSE_FILE=
MENU_PROJECT=
MENU_DIRECTORY=
MENU_COMPOSE_ERROR=
MENU_RUN_REDACT=0
MENU_TITLE=
MENU_ACTION=
MENU_CONFIG_WARNING=
MENU_EDITING=0
MENU_EDIT_VALUE=
MENU_EDIT_POS=0
MENU_EDIT_AREA=
MENU_SELECTED_AREAS=()

menu_usage() {
    printf '%s\n' 'Использование: bash menu.sh [--help] [--config PATH]'
}

menu_require() {
    local command_name
    for command_name in "$@"; do
        if ! command -v "$command_name" >/dev/null 2>&1; then
            MENU_OUTPUT_LINES+=("Не найдена необходимая команда: $command_name")
            return 1
        fi
    done
}

menu_cleanup() {
    if [[ -n $MENU_CHILD ]]; then
        kill -TERM -- "-$MENU_CHILD" 2>/dev/null || :
        kill -TERM "$MENU_CHILD" 2>/dev/null || :
        sleep .2 2>/dev/null || :
        kill -KILL -- "-$MENU_CHILD" 2>/dev/null || :
        kill -KILL "$MENU_CHILD" 2>/dev/null || :
        wait "$MENU_CHILD" 2>/dev/null || :
        MENU_CHILD=
    fi
    [[ -z $MENU_LOG ]] || rm -f -- "$MENU_LOG"
    if ((${#MENU_TEMP_FILES[@]})); then rm -f -- "${MENU_TEMP_FILES[@]}"; MENU_TEMP_FILES=(); fi
    if ((MENU_SCREEN)); then
        tput cnorm 2>/dev/null || :
        printf '\033[?1049l'
        [[ -z $MENU_STTY ]] || stty "$MENU_STTY" 2>/dev/null || :
        MENU_SCREEN=0
    else
        [[ -z $MENU_STTY ]] || stty "$MENU_STTY" 2>/dev/null || :
    fi
}

menu_geometry() {
    MENU_ROWS=$(tput lines 2>/dev/null) || MENU_ROWS=24
    MENU_COLS=$(tput cols 2>/dev/null) || MENU_COLS=80
}

menu_enter() {
    MENU_STTY=$(stty -g) || return 1
    stty -echo -icanon || return 1
    printf '\033[?1049h'
    tput civis 2>/dev/null || :
    MENU_SCREEN=1
    menu_geometry
}

menu_read_key() {
    local raw next
    MENU_KEY= MENU_KEY_MOD=
    IFS= read -rsn1 raw || return 1
    if [[ -z $raw ]]; then MENU_KEY=ENTER; return 0; fi
    if [[ $raw == $'\t' ]]; then MENU_KEY=TAB; return 0; fi
    if [[ $raw != $'\e' ]]; then MENU_KEY=$raw; return 0; fi
    IFS= read -rsn1 -t .08 next || { MENU_KEY=ESC; return 0; }
    [[ $next == '[' || $next == 'O' ]] || { MENU_KEY=ESC; return 0; }
    IFS= read -rsn1 -t .08 raw || { MENU_KEY=ESC; return 0; }
    if [[ $raw =~ [0-9] ]]; then
        MENU_KEY_MOD=$raw
        while IFS= read -rsn1 -t .02 next && [[ $next =~ [0-9] ]]; do MENU_KEY_MOD+=$next; done
        [[ $next == ';' ]] && { IFS= read -rsn1 -t .02 next || :; }
        [[ $next == '~' ]] || :
        case $MENU_KEY_MOD in 1|7) MENU_KEY=HOME ;; 4|8) MENU_KEY=END ;; 5) MENU_KEY=PGUP ;; 6) MENU_KEY=PGDN ;; 3) MENU_KEY=DELETE ;; *) MENU_KEY=UNKNOWN ;; esac
        return 0
    fi
    case $raw in A) MENU_KEY=UP ;; B) MENU_KEY=DOWN ;; C) MENU_KEY=RIGHT ;; D) MENU_KEY=LEFT ;; H) MENU_KEY=HOME ;; F) MENU_KEY=END ;; Z) MENU_KEY=BACKTAB ;; *) MENU_KEY=UNKNOWN ;; esac
}

menu_draw_lines() {
    local i text row action_count max_actions body_area action_start idx width title_text separator footer
    printf '\033[H\033[2J'
    MENU_SMALL=0
    if ((MENU_ROWS < 10 || MENU_COLS < 40)); then
        MENU_SMALL=1
        text='Окно мало — увеличьте его. Esc — назад.'
        text=${text:0:MENU_COLS-1}
        printf '\033[1;1H%s' "$text"
        return
    fi
    action_count=${#MENU_SCREEN_ACTIONS[@]}
    width=$((MENU_COLS-1))
    title_text=${MENU_TITLE:0:width}
    separator='────────────────────────────────────────────────────────────────'
    separator=${separator:0:width}
    footer='↑/↓ выбор  PgUp/PgDn прокрутка  ←/→ горизонтально  Enter выбрать  Esc назад'
    footer=${footer:0:width}
    max_actions=$(((MENU_ROWS-4)/2))
    ((max_actions < 1)) && max_actions=1
    ((action_count > max_actions)) && action_count=$max_actions
    body_area=$((MENU_ROWS-4-action_count))
    ((body_area < 0)) && body_area=0
    MENU_BODY_AREA=$body_area
    menu_limit_vertical
    menu_limit_horizontal
    ((MENU_ACTION_SCROLL > MENU_CHOICE)) && MENU_ACTION_SCROLL=$MENU_CHOICE
    ((MENU_CHOICE >= MENU_ACTION_SCROLL+action_count)) && MENU_ACTION_SCROLL=$((MENU_CHOICE-action_count+1))
    ((MENU_ACTION_SCROLL < 0)) && MENU_ACTION_SCROLL=0
    ((MENU_ACTION_SCROLL+action_count > ${#MENU_SCREEN_ACTIONS[@]})) && MENU_ACTION_SCROLL=$((${#MENU_SCREEN_ACTIONS[@]}-action_count))
    printf '\033[1;1H%s' "$title_text"
    printf '\033[2;1H%s' "$separator"
    for ((i=0; i<body_area; i++)); do
        row=$((i+2))
        idx=$((MENU_SCROLL+i))
        if ((idx < ${#MENU_SCREEN_BODY[@]})); then
            text=${MENU_SCREEN_BODY[idx]}
            text=${text:MENU_HOFFSET:MENU_COLS-2}
            printf '\033[%d;1H\033[K%s' "$((row+1))" "$text"
        else
            printf '\033[%d;1H\033[K' "$((row+1))"
        fi
    done
    row=$((2+body_area))
    printf '\033[%d;1H%s' "$((row+1))" "$separator"
    for ((i=0; i<action_count; i++)); do
        action_start=$((MENU_ACTION_SCROLL+i))
        text=${MENU_SCREEN_ACTIONS[action_start]:0:MENU_COLS-4}
        printf '\033[%d;1H\033[K' "$((row+2+i))"
        if ((action_start == MENU_CHOICE)); then printf '\033[7m  %s  \033[0m' "$text"; else printf '  %s' "$text"; fi
    done
    printf '\033[%d;1H\033[K%s' "$MENU_ROWS" "$footer"
}

menu_redraw() {
    menu_geometry
    if ((MENU_EDITING)); then
        menu_draw_editor
    else
        menu_draw_lines
    fi
}

screen_select() {
    MENU_TITLE=$1
    local -n body_ref=$2 actions_ref=$3
    MENU_SCREEN_BODY=("${body_ref[@]}")
    MENU_SCREEN_ACTIONS=("${actions_ref[@]}")
    MENU_CHOICE=${MENU_INITIAL_CHOICE:-0} MENU_SCROLL=0 MENU_HOFFSET=0 MENU_ACTION_SCROLL=0
    MENU_INITIAL_CHOICE=0
    while :; do
        menu_draw_lines
        menu_read_key || return 2
        if ((MENU_SMALL)); then [[ $MENU_KEY == ESC ]] && return 1; continue; fi
        case $MENU_KEY in
            UP) ((MENU_CHOICE > 0)) && ((MENU_CHOICE--)) ;;
            DOWN) ((MENU_CHOICE+1 < ${#MENU_SCREEN_ACTIONS[@]})) && ((MENU_CHOICE++)) ;;
            PGUP) ((MENU_SCROLL -= MENU_BODY_AREA)); ((MENU_SCROLL < 0)) && MENU_SCROLL=0 ;;
            PGDN) ((MENU_SCROLL += MENU_BODY_AREA)); menu_limit_vertical ;;
            LEFT) ((MENU_HOFFSET > 0)) && ((MENU_HOFFSET-=8)) ;;
            RIGHT) ((MENU_HOFFSET+=8)); menu_limit_horizontal ;;
            HOME) MENU_CHOICE=0 ;;
            END) MENU_CHOICE=$((${#MENU_SCREEN_ACTIONS[@]}-1)) ;;
            TAB) ((MENU_CHOICE+1 < ${#MENU_SCREEN_ACTIONS[@]})) && ((MENU_CHOICE++)) || MENU_CHOICE=0 ;;
            BACKTAB) ((MENU_CHOICE > 0)) && ((MENU_CHOICE--)) || MENU_CHOICE=$((${#MENU_SCREEN_ACTIONS[@]}-1)) ;;
            ENTER) return 0 ;;
            ESC) return 1 ;;
        esac
    done
}

menu_result() {
    local title=$1
    MENU_TITLE=$title
    MENU_SCREEN_BODY=("${MENU_OUTPUT_LINES[@]}")
    MENU_SCREEN_ACTIONS=('Продолжить')
    MENU_CHOICE=0 MENU_SCROLL=0 MENU_HOFFSET=0 MENU_ACTION_SCROLL=0
    while :; do
        menu_draw_lines
        menu_read_key || return
        if ((MENU_SMALL)); then [[ $MENU_KEY == ESC ]] && return; continue; fi
        [[ $MENU_KEY == ENTER || $MENU_KEY == ESC ]] && return
        case $MENU_KEY in
            PGUP) ((MENU_SCROLL -= MENU_BODY_AREA)); ((MENU_SCROLL<0)) && MENU_SCROLL=0 ;;
            PGDN) ((MENU_SCROLL += MENU_BODY_AREA)); menu_limit_vertical ;;
            LEFT) ((MENU_HOFFSET>0)) && ((MENU_HOFFSET-=8)) ;;
            RIGHT) ((MENU_HOFFSET+=8)); menu_limit_horizontal ;;
            HOME) MENU_SCROLL=0; MENU_HOFFSET=0 ;;
            END) MENU_SCROLL=${#MENU_SCREEN_BODY[@]}; menu_limit_vertical ;;
        esac
    done
}

menu_confirm() {
    local title=$1 body_name=${2:-} confirmation_lines=() confirmation_actions=('Отмена' 'Продолжить')
    if [[ -n $body_name ]]; then
        local -n supplied_body=$body_name
        confirmation_lines=("${supplied_body[@]}")
    else
        confirmation_lines=("$title")
    fi
    screen_select "$title" confirmation_lines confirmation_actions || return 1
    ((MENU_CHOICE == 1))
}

menu_confirm_discard() {
    local title=$1 body=() actions=('Вернуться' 'Отбросить изменения')
    body=("$title")
    screen_select 'Подтверждение' body actions || return 1
    ((MENU_CHOICE == 1))
}

menu_limit_vertical() {
    local max_scroll=$((${#MENU_SCREEN_BODY[@]}-MENU_BODY_AREA))
    ((max_scroll < 0)) && max_scroll=0
    ((MENU_SCROLL > max_scroll)) && MENU_SCROLL=$max_scroll
    ((MENU_SCROLL < 0)) && MENU_SCROLL=0
}

menu_limit_horizontal() {
    local line max_offset=0
    for line in "${MENU_SCREEN_BODY[@]}"; do
        ((${#line} > max_offset)) && max_offset=${#line}
    done
    ((max_offset > MENU_COLS-2)) && max_offset=$((max_offset-MENU_COLS+2)) || max_offset=0
    ((MENU_HOFFSET > max_offset)) && MENU_HOFFSET=$max_offset
    ((MENU_HOFFSET < 0)) && MENU_HOFFSET=0
}

menu_load_config() {
    local record key value
    local -A seen=()
    [[ -f $MENU_CONFIG ]] || return 0
    while IFS= read -r record || [[ -n $record ]]; do
        if [[ $record != *$'\t'* ]]; then
            case $record in
                backend|web|keycloak) MENU_CONFIG_WARNING="Некорректная запись: $record"; MENU_PATHS[$record]='' ;;
            esac
            continue
        fi
        key=${record%%$'\t'*}
        value=${record#*$'\t'}
        case $key in
            backend|web|keycloak|source)
                if [[ $key == source ]]; then
                    if [[ -n ${seen[$key]+x} || $value == *$'\t'* || $value == *$'\n'* ]]; then MENU_CONFIG_WARNING="Некорректная или повторная запись: $key"; MENU_SAVED_SOURCE_DIR=; continue; fi
                    seen[$key]=1
                    if ! menu_normalize_path "$value"; then MENU_CONFIG_WARNING='Некорректный путь: source'; MENU_SAVED_SOURCE_DIR=; else MENU_SAVED_SOURCE_DIR=$MENU_NORMALIZED_PATH; fi
                    continue
                fi
                if [[ -n ${seen[$key]+x} || $value == *$'\t'* || $value == *$'\n'* ]]; then
                    MENU_CONFIG_WARNING="Некорректная или повторная запись: $key"
                    MENU_PATHS[$key]=
                    continue
                fi
                seen[$key]=1
                if ! menu_normalize_path "$value"; then
                    MENU_CONFIG_WARNING="Некорректный путь: $key"
                    MENU_PATHS[$key]=
                else
                    MENU_PATHS[$key]=$MENU_NORMALIZED_PATH
                fi
                ;;
        esac
    done < "$MENU_CONFIG"
}

menu_save_config() {
    local tmp dir key value
    dir=$(dirname -- "$MENU_CONFIG")
    mkdir -p -- "$dir" || return 1
    tmp=$(umask 077; mktemp "$dir/.tdn-menu.XXXXXX") || return 1
    for key in backend web keycloak source; do
        if [[ $key == source ]]; then value=$MENU_SOURCE_DIR; else value=${MENU_DRAFT[$key]}; fi
        [[ $value != *$'\t'* && $value != *$'\n'* ]] || { rm -f -- "$tmp"; return 1; }
        printf '%s\t%s\n' "$key" "$value" >> "$tmp" || { rm -f -- "$tmp"; return 1; }
    done
    chmod 600 "$tmp" && mv -fT -- "$tmp" "$MENU_CONFIG" || { rm -f -- "$tmp"; return 1; }
    for key in backend web keycloak; do MENU_PATHS[$key]=${MENU_DRAFT[$key]}; done
    MENU_SAVED_SOURCE_DIR=$MENU_SOURCE_DIR
}

menu_normalize_path() {
    local value=$1
    [[ $value != *$'\t'* && $value != *$'\n'* ]] || return 1
    if [[ -z $value ]]; then MENU_NORMALIZED_PATH=; return 0; fi
    [[ $value == '~/'* ]] && value=$HOME/${value#\~/}
    MENU_NORMALIZED_PATH=$(realpath -m -- "$value")
}

menu_draw_editor() {
    local width viewport shown title help
    menu_geometry
    if ((MENU_ROWS < 8 || MENU_COLS < 30)); then
        MENU_SMALL=1
        help='Окно мало — увеличьте его. Esc — назад.'
        help=${help:0:MENU_COLS-1}
        printf '\033[H\033[2J%s' "$help"
        return
    fi
    MENU_SMALL=0
    width=$((MENU_COLS-2))
    viewport=$((MENU_EDIT_POS-width+1))
    ((viewport < 0)) && viewport=0
    shown=${MENU_EDIT_VALUE:viewport:width}
    [[ -n $shown ]] || shown='не управляется на этом хосте'
    title="Путь установки — $MENU_EDIT_AREA"
    title=${title:0:MENU_COLS-1}
    help='Enter применить  Esc отмена  Ctrl+U очистить'
    help=${help:0:MENU_COLS-1}
    printf '\033[H\033[2J%s\033[2;1H%s\033[3;1H\033[K%s' "$title" "$help" "$shown"
    tput cnorm 2>/dev/null || :
    tput cup 2 "$((MENU_EDIT_POS-viewport))" 2>/dev/null || :
}

menu_edit_field() {
    local area=$1 value=${MENU_DRAFT[$1]} key pos viewport shown width
    pos=${#value}
    MENU_EDITING=1 MENU_EDIT_AREA=$area
    while :; do
        MENU_EDIT_VALUE=$value MENU_EDIT_POS=$pos
        menu_draw_editor
        if ((MENU_SMALL)); then
            menu_read_key || { MENU_EDITING=0; return 1; }
            [[ $MENU_KEY == ESC ]] && { MENU_EDITING=0; tput civis 2>/dev/null || :; return 1; }
            continue
        fi
        menu_read_key || { MENU_EDITING=0; return 1; }
        key=$MENU_KEY
        case $key in
            ENTER) MENU_DRAFT[$area]=$value; MENU_EDITING=0; tput civis 2>/dev/null || :; return 0 ;;
            ESC) MENU_EDITING=0; tput civis 2>/dev/null || :; return 1 ;;
            TAB|BACKTAB|UP|DOWN|UNKNOWN) ;;
            LEFT) ((pos>0)) && ((pos--)) ;;
            RIGHT) ((pos<${#value})) && ((pos++)) ;;
            HOME) pos=0 ;;
            END) pos=${#value} ;;
            $'\177'|$'\b') if ((pos>0)); then value=${value:0:pos-1}${value:pos}; ((pos--)); fi ;;
            DELETE|$'\004') if ((pos<${#value})); then value=${value:0:pos}${value:pos+1}; fi ;;
            $'\025') value=; pos=0 ;;
            *) [[ ${#key} == 1 && $key != $'\e' && $key != $'\177' ]] && { value=${value:0:pos}$key${value:pos}; ((pos++)); } ;;
        esac
    done
}

menu_config_form() {
    local -a body=() actions=('Backend + BFF' 'Web' 'Keycloak' 'Сохранить' 'Отмена')
    local key changed initial_choice=0 select_rc
    for key in backend web keycloak; do MENU_DRAFT[$key]=${MENU_PATHS[$key]}; done
    while :; do
        body=("Backend + BFF: ${MENU_DRAFT[backend]:-не управляется на этом хосте}" "Web: ${MENU_DRAFT[web]:-не управляется на этом хосте}" "Keycloak: ${MENU_DRAFT[keycloak]:-не управляется на этом хосте}" '' 'Настраивайте только нужные области' 'Enter — редактировать поле; Tab — следующее; Shift+Tab — предыдущее')
        MENU_INITIAL_CHOICE=$initial_choice
        screen_select 'Расположение установок' body actions
        select_rc=$?
        ((select_rc == 2)) && return
        ((select_rc == 1)) && MENU_CHOICE=4
        case $MENU_CHOICE in
            0) initial_choice=0; menu_edit_field backend || : ;;
            1) initial_choice=1; menu_edit_field web || : ;;
            2) initial_choice=2; menu_edit_field keycloak || : ;;
            3)
                for key in backend web keycloak; do menu_normalize_path "${MENU_DRAFT[$key]}" || { MENU_OUTPUT_LINES=('Путь содержит непредставимый символ.'); menu_result 'Ошибка'; continue 2; }; MENU_DRAFT[$key]=$MENU_NORMALIZED_PATH; done
                if menu_save_config; then MENU_OUTPUT_LINES=('Конфигурация сохранена.'); menu_result 'Конфигурация'; return; else MENU_OUTPUT_LINES=('Не удалось сохранить конфигурацию; черновик сохранён в форме.'); menu_result 'Ошибка сохранения'; fi ;;
            4)
                changed=0
                for key in backend web keycloak; do [[ ${MENU_DRAFT[$key]} == "${MENU_PATHS[$key]}" ]] || changed=1; done
                if ((changed)); then menu_confirm_discard 'Отбросить несохранённые изменения?' || continue; fi
                return ;;
        esac
    done
}

menu_compose_clear_env() {
    env -u COMPOSE_FILE -u COMPOSE_PROJECT_NAME -u COMPOSE_PROFILES -u COMPOSE_ENV_FILES -u COMPOSE_PATH_SEPARATOR -u COMPOSE_DISABLE_ENV_FILE "$@"
}

menu_compose_exec() {
    local directory=$MENU_DIRECTORY
    menu_compose_clear_env bash -c 'cd "$1" || exit; shift; exec docker "$@"' _ "$directory" "${MENU_COMPOSE_ARGS[@]}" "$@"
}

menu_prepare_compose() {
    local area=$1 interaction=${2:-yes} install candidate physical selected='' labels_output label project
    local -a files=() unique=() chooser_body=() chooser_actions=()
    MENU_COMPOSE_ARGS=() MENU_COMPOSE_FILES=() MENU_PROJECTS=()
    MENU_COMPOSE_ERROR=
    install=${MENU_PATHS[$area]}
    [[ -n $install && -d $install ]] || { MENU_COMPOSE_ERROR='путь не задан'; return 1; }
    physical=$(realpath -e -- "$install") || { MENU_COMPOSE_ERROR='каталог недоступен'; return 1; }
    for candidate in compose.yaml compose.yml docker-compose.yaml docker-compose.yml; do
        [[ -f $physical/$candidate ]] && files+=("$physical/$candidate")
    done
    ((${#files[@]})) || { MENU_COMPOSE_ERROR='не установлено'; return 1; }
    if ((${#files[@]} > 1)); then
        if [[ $interaction == no ]]; then MENU_COMPOSE_ERROR='несколько Compose-файлов'; return 2; fi
        MENU_COMPOSE_FILES=("${files[@]}")
        for candidate in "${files[@]}"; do chooser_actions+=("$(basename -- "$candidate")"); done
        chooser_actions+=('Отмена')
        chooser_body=("Найдено несколько Compose-файлов в $physical. Выберите нужный.")
        screen_select 'Выбор Compose' chooser_body chooser_actions || return 1
        ((${MENU_CHOICE} < ${#files[@]})) || return 1
        selected=${files[MENU_CHOICE]}
    else
        selected=${files[0]}
    fi
    MENU_DIRECTORY=$physical MENU_COMPOSE_FILE=$selected
    MENU_COMPOSE_ARGS=(compose --project-directory "$physical" -f "$selected")
    [[ ! -f $physical/.env ]] || MENU_COMPOSE_ARGS+=(--env-file "$physical/.env")
    if ! labels_output=$(menu_compose_clear_env docker ps -a --filter "label=com.docker.compose.project.working_dir=$physical" --format '{{.Label "com.docker.compose.project"}}' 2>/dev/null); then
        MENU_COMPOSE_ERROR='Docker недоступен'; return 1
    fi
    while IFS= read -r project; do [[ -z $project ]] || MENU_PROJECTS+=("$project"); done <<< "$labels_output"
    mapfile -t unique < <(printf '%s\n' "${MENU_PROJECTS[@]}" | awk 'NF && !seen[$0]++')
    MENU_PROJECTS=("${unique[@]}")
    if ((${#MENU_PROJECTS[@]} > 1)); then
        MENU_PROJECT=несколько
        if [[ $interaction == no ]]; then MENU_PROJECT='несколько'; return 0; fi
        MENU_PROJECT=
        MENU_PROJECT_OPTIONS=("${MENU_PROJECTS[@]}")
        MENU_PROJECT_OPTIONS+=('Без -p (Compose default)' 'Отмена')
        chooser_body=("Для $physical обнаружено несколько project labels. Выберите проект для изменяющей операции.")
        chooser_actions=("${MENU_PROJECT_OPTIONS[@]}")
        screen_select 'Выбор Docker project' chooser_body chooser_actions || return 1
        ((${MENU_CHOICE} < ${#MENU_PROJECTS[@]})) || { ((${MENU_CHOICE} == ${#MENU_PROJECTS[@]})) && return 0; return 1; }
        MENU_PROJECT=${MENU_PROJECTS[MENU_CHOICE]}
        MENU_COMPOSE_ARGS+=(-p "$MENU_PROJECT")
    elif ((${#MENU_PROJECTS[@]} == 1)); then
        MENU_PROJECT=${MENU_PROJECTS[0]}
        MENU_COMPOSE_ARGS+=(-p "$MENU_PROJECT")
    else
        MENU_PROJECT=
    fi
    return 0
}

menu_compose_services() {
    local output
    if output=$(menu_compose_exec config --services 2>/dev/null); then
        MENU_SERVICES=()
        [[ -z $output ]] || mapfile -t MENU_SERVICES <<< "$output"
        local -a filtered=()
        local service
        for service in "${MENU_SERVICES[@]}"; do [[ -z $service ]] || filtered+=("$service"); done
        MENU_SERVICES=("${filtered[@]}")
        ((${#MENU_SERVICES[@]}))
    else
        MENU_SERVICES=()
        return 1
    fi
}

menu_compose_actual() {
    local physical=$1 output
    local format='{{.Label "com.docker.compose.service"}}|{{.State}}|{{.Status}}|{{.Image}}|{{.Names}}|{{.Label "com.docker.compose.project"}}'
    if output=$(menu_compose_clear_env docker ps -a --filter "label=com.docker.compose.project.working_dir=$physical" --format "$format" 2>/dev/null); then
        MENU_ACTUAL_LINES=()
        [[ -z $output ]] || mapfile -t MENU_ACTUAL_LINES <<< "$output"
        return 0
    fi
    return 1
}

menu_build_dashboard() {
    local area label service line found
    local -A declared_seen=()
    MENU_SCREEN_BODY=('Сервисы / состояние')
    MENU_AVAILABLE_AREAS=()
    for area in backend web keycloak; do
        case $area in backend) label='Backend + BFF' ;; web) label=Web ;; keycloak) label=Keycloak ;; esac
        if [[ -z ${MENU_PATHS[$area]} ]]; then MENU_SCREEN_BODY+=("$label — не управляется на этом хосте"); continue; fi
        if [[ ! -d ${MENU_PATHS[$area]} ]]; then MENU_SCREEN_BODY+=("$label — не установлено: ${MENU_PATHS[$area]}"); continue; fi
        if ! menu_prepare_compose "$area" no; then
            MENU_SCREEN_BODY+=("$label — ${MENU_COMPOSE_ERROR:-не установлено}: ${MENU_PATHS[$area]}")
            continue
        fi
        MENU_AVAILABLE_AREAS+=("$area")
        MENU_SCREEN_BODY+=("$label — ${MENU_DIRECTORY} — project: ${MENU_PROJECT:-Compose default}")
        if [[ $MENU_PROJECT == несколько ]]; then MENU_SCREEN_BODY+=('  несколько Docker projects; выберите область перед изменением'); fi
    if ! menu_compose_services; then MENU_SCREEN_BODY+=('  состояние недоступно: Compose config завершился ошибкой'); continue; fi
        if ! menu_compose_actual "$MENU_DIRECTORY"; then MENU_SCREEN_BODY+=('  состояние недоступно: Docker недоступен'); continue; fi
        declared_seen=()
        for service in "${MENU_SERVICES[@]}"; do
            [[ -z $service ]] && continue
            declared_seen[$service]=1
            found=0
            for line in "${MENU_ACTUAL_LINES[@]}"; do
                [[ ${line%%|*} == "$service" ]] || continue
                MENU_SCREEN_BODY+=("  $service | ${line#*|}")
                found=1
            done
            ((found)) || MENU_SCREEN_BODY+=("  $service | не запущен")
        done
        for line in "${MENU_ACTUAL_LINES[@]}"; do
            service=${line%%|*}
            [[ -n $service && -z ${declared_seen[$service]+x} ]] || continue
            MENU_SCREEN_BODY+=("  $service | ${line#*|} | отсутствует в Compose")
        done
    done
}

menu_run() {
    local title=$1 redact=${2:-0} rc line
    shift 2
    MENU_LOG=$(umask 077; mktemp "${TMPDIR:-/tmp}/tdn-menu.XXXXXX") || return 1
    MENU_TITLE=$title MENU_RUN_REDACT=$redact MENU_CHILD=
    MENU_CANCELLED=0
    setsid --wait "$@" >"$MENU_LOG" 2>&1 &
    MENU_CHILD=$!
    while kill -0 "$MENU_CHILD" 2>/dev/null; do
        MENU_SCREEN_BODY=("$title" '' 'Выполняется…')
        if [[ $redact == 0 ]]; then
            mapfile -t MENU_OUTPUT_LINES < <(tail -n 8 "$MENU_LOG" 2>/dev/null)
            MENU_SCREEN_BODY+=("${MENU_OUTPUT_LINES[@]}")
        fi
        MENU_SCREEN_ACTIONS=()
        menu_draw_lines
        local key
        if IFS= read -rsn1 -t .1 key; then
            if [[ $key == $'\003' ]]; then
                kill -TERM -- "-$MENU_CHILD" 2>/dev/null || :
                kill -TERM "$MENU_CHILD" 2>/dev/null || :
                sleep .2 2>/dev/null || :
                kill -KILL -- "-$MENU_CHILD" 2>/dev/null || :
                kill -KILL "$MENU_CHILD" 2>/dev/null || :
                wait "$MENU_CHILD" 2>/dev/null || :
                MENU_CHILD=
                MENU_CANCELLED=1
                rm -f -- "$MENU_LOG"; MENU_LOG=
                return 130
            fi
        else
            rc=$?
            if ((rc != 142)); then
                kill -TERM -- "-$MENU_CHILD" 2>/dev/null || :
                kill -TERM "$MENU_CHILD" 2>/dev/null || :
                sleep .2 2>/dev/null || :
                kill -KILL -- "-$MENU_CHILD" 2>/dev/null || :
                kill -KILL "$MENU_CHILD" 2>/dev/null || :
                wait "$MENU_CHILD" 2>/dev/null || :
                MENU_CHILD= MENU_CANCELLED=1
                rm -f -- "$MENU_LOG"; MENU_LOG=
                return 130
            fi
        fi
    done
    wait "$MENU_CHILD"; rc=$?
    MENU_CHILD=
    MENU_RC=$rc
    if [[ $redact == 0 ]]; then mapfile -t MENU_OUTPUT_LINES < "$MENU_LOG"; else MENU_OUTPUT_LINES=(); fi
    rm -f -- "$MENU_LOG"; MENU_LOG=
    MENU_OUTPUT_LINES+=("Код завершения: $rc")
    menu_result "$title"
    return "$rc"
}

menu_area_selector() {
    local mode=$1 area label candidate physical found title
    local -a body=() actions=()
    MENU_SELECTED_AREAS=()
    for area in backend web keycloak; do
        physical=${MENU_PATHS[$area]}
        found=0
        if [[ -n $physical && -d $physical ]]; then
            physical=$(realpath -e -- "$physical") || physical=
            for candidate in compose.yaml compose.yml docker-compose.yaml docker-compose.yml; do
                [[ -n $physical && -f $physical/$candidate ]] && found=1
            done
        fi
        if ((found)); then
            MENU_SELECTED_AREAS+=("$area")
            case $area in backend) label='Backend + BFF' ;; web) label=Web ;; keycloak) label=Keycloak ;; esac
            actions+=("$label")
        fi
    done
    ((${#MENU_SELECTED_AREAS[@]})) || { MENU_OUTPUT_LINES=('Нет доступных установок с Compose.'); menu_result 'Сервисы'; return 1; }
    if [[ $mode == update ]]; then actions+=('Все установленные'); fi
    actions+=('Назад')
    body=('Выберите существующую установку.')
    case $mode in update) title='Обновление — область' ;; restart) title='Перезапуск — область' ;; stop) title='Выключение — область' ;; esac
    screen_select "$title" body actions || return 1
    if [[ $mode == update && $MENU_CHOICE == ${#MENU_SELECTED_AREAS[@]} ]]; then return 0; fi
    ((${MENU_CHOICE} < ${#MENU_SELECTED_AREAS[@]})) || return 1
    MENU_SELECTED_AREAS=("${MENU_SELECTED_AREAS[MENU_CHOICE]}")
}

menu_service_action() {
    local action=$1 area verb label output service i title
    local -a body=() actions=() selected=() services=()
    if ! menu_require docker setsid tail; then menu_result 'Зависимости' ; return; fi
    MENU_OUTPUT_LINES=()
    menu_area_selector "$action" || return
    if [[ $action == update ]]; then menu_update "${MENU_SELECTED_AREAS[@]}"; return; fi
    area=${MENU_SELECTED_AREAS[0]}
    if ! menu_prepare_compose "$area"; then MENU_OUTPUT_LINES=("Compose недоступен: $MENU_COMPOSE_ERROR"); menu_result 'Сервисы'; return; fi
    if ! menu_compose_services; then MENU_OUTPUT_LINES=('Состояние недоступно: Compose не смог получить список сервисов.'); menu_result 'Сервисы'; return; fi
    services=("${MENU_SERVICES[@]}")
    actions=('Все объявленные сервисы' "${services[@]}" 'Назад')
    body=("$area — $MENU_DIRECTORY — project: ${MENU_PROJECT:-Compose default}")
    case $action in restart) title='Перезапуск сервисов' ;; stop) title='Выключение сервисов' ;; *) title=$action ;; esac
    screen_select "$title — сервисы" body actions || return
    i=$MENU_CHOICE
    ((${i} < ${#services[@]}+1)) || return
    if ((i == 0)); then selected=("${services[@]}"); else selected=("${services[i-1]}"); fi
    MENU_OUTPUT_LINES=("Область: $area" "Каталог: $MENU_DIRECTORY" "Compose: $MENU_COMPOSE_FILE" "Проект: ${MENU_PROJECT:-Compose default}" "Сервисы: ${selected[*]}")
    menu_confirm "Подтвердите: $title." MENU_OUTPUT_LINES || return
    verb=restart; [[ $action != stop ]] || verb=stop
    menu_run "$title" 1 bash -c 'cd "$1" || exit; shift; exec env -u COMPOSE_FILE -u COMPOSE_PROJECT_NAME -u COMPOSE_PROFILES -u COMPOSE_ENV_FILES -u COMPOSE_PATH_SEPARATOR -u COMPOSE_DISABLE_ENV_FILE docker "$@"' _ "$MENU_DIRECTORY" "${MENU_COMPOSE_ARGS[@]}" "$verb" "${selected[@]}"
}

menu_make_plan() {
    local area=$1 declared=() names name
    MENU_PLAN_SERVICES[$area]=
    if ! menu_prepare_compose "$area"; then return 1; fi
    if ! menu_compose_services; then MENU_COMPOSE_ERROR='не удалось получить services из Compose'; return 1; fi
    declared=("${MENU_SERVICES[@]}")
    case $area in
        backend) names='users-service campaign-service account-service api-gateway bff-web' ;;
        web) names='campaign profile login hub nginx' ;;
        keycloak) names=keycloak ;;
    esac
    for name in $names; do
        local declared_name
        for declared_name in "${declared[@]}"; do
            [[ $declared_name == "$name" ]] && MENU_PLAN_SERVICES[$area]+=" $name"
        done
    done
    MENU_PLAN_SERVICES[$area]=${MENU_PLAN_SERVICES[$area]# }
    [[ -n ${MENU_PLAN_SERVICES[$area]} ]] || { MENU_COMPOSE_ERROR='нет известных application services'; return 1; }
    MENU_PLAN_DIR[$area]=$MENU_DIRECTORY
    MENU_PLAN_PROJECT[$area]=$MENU_PROJECT
    MENU_PLAN_COMPOSE[$area]=$MENU_COMPOSE_FILE
    return 0
}

menu_update() {
    local area source_real root status_output rc service line
    local -a body=() selected=() app=() failures=() updated=() args=() build=() targets=()
    MENU_OUTPUT_LINES=()
    if ! menu_require git make setsid docker tail; then menu_result 'Зависимости'; return; fi
    for area in "$@"; do
        if ! menu_make_plan "$area"; then MENU_OUTPUT_LINES=("$area: ${MENU_COMPOSE_ERROR:-состояние недоступно}"); menu_result 'Обновление'; return; fi
        selected+=("$area — ${MENU_PLAN_DIR[$area]} — ${MENU_PLAN_COMPOSE[$area]} — services ${MENU_PLAN_SERVICES[$area]} — project ${MENU_PLAN_PROJECT[$area]:-Compose default}")
    done
    body=("Исходники: $MENU_SOURCE_DIR" "${selected[@]}" 'До подтверждения сеть и сборка не выполняются.')
    menu_confirm 'Подтвердите обновление.' body || return
    for area in backend web keycloak; do
        [[ -n ${MENU_PATHS[$area]} ]] || continue
        local install_real
        install_real=$(realpath -m -- "${MENU_PATHS[$area]}") || return
        [[ $MENU_SOURCE_DIR != "$install_real" && $MENU_SOURCE_DIR != "$install_real"/* && $install_real != "$MENU_SOURCE_DIR"/* ]] || { MENU_OUTPUT_LINES=('Кэш исходников пересекается с настроенным каталогом установки.'); menu_result 'Обновление'; return; }
    done
    if [[ -e $MENU_SOURCE_DIR/.git ]]; then
        source_real=$(realpath -e -- "$MENU_SOURCE_DIR") || { MENU_OUTPUT_LINES=('Не удалось разрешить кэш исходников.'); menu_result 'Обновление'; return; }
        root=$(git -C "$source_real" rev-parse --show-toplevel 2>/dev/null) || { MENU_OUTPUT_LINES=('Кэш не является Git checkout.'); menu_result 'Обновление'; return; }
        root=$(realpath -e -- "$root") || return
        [[ $root == "$source_real" ]] || { MENU_OUTPUT_LINES=('Кэш не является корнем checkout.'); menu_result 'Обновление'; return; }
        if ! status_output=$(git -C "$source_real" status --porcelain); then MENU_OUTPUT_LINES=('Не удалось проверить локальные изменения checkout.'); menu_result 'Обновление'; return; fi
        [[ -z $status_output ]] || { MENU_OUTPUT_LINES=('В checkout есть локальные изменения; обновление остановлено.'); menu_result 'Обновление'; return; }
        menu_run 'Получение исходников' 0 env GIT_TERMINAL_PROMPT=0 git -C "$source_real" pull --ff-only origin "$MENU_REF" || return
    else
        [[ ! -e $MENU_SOURCE_DIR ]] || [[ -d $MENU_SOURCE_DIR && -z $(find "$MENU_SOURCE_DIR" -mindepth 1 -maxdepth 1 -print -quit 2>/dev/null) ]] || { MENU_OUTPUT_LINES=('Каталог кэша занят посторонними файлами.'); menu_result 'Обновление'; return; }
        mkdir -p -- "$(dirname -- "$MENU_SOURCE_DIR")" || { MENU_OUTPUT_LINES=('Не удалось создать родительский каталог кэша.'); menu_result 'Обновление'; return; }
        if [[ -d $MENU_SOURCE_DIR ]] && [[ -z $(find "$MENU_SOURCE_DIR" -mindepth 1 -maxdepth 1 -print -quit 2>/dev/null) ]]; then rmdir -- "$MENU_SOURCE_DIR" || return; fi
        menu_run 'Загрузка исходников' 0 env GIT_TERMINAL_PROMPT=0 git clone --branch "$MENU_REF" --single-branch -- "$MENU_REPOSITORY" "$MENU_SOURCE_DIR" || return
        source_real=$(realpath -e -- "$MENU_SOURCE_DIR") || return
    fi
    for area in "$@"; do
        case $area in
            backend) build=(build-backend build-bff SERVICE= IMAGE_TAG=latest WEB_BUILD_ENV=template.env.build BUILD_FLAGS=) ;;
            web) build=(build-web SERVICE= IMAGE_TAG=latest WEB_BUILD_ENV=template.env.build BUILD_FLAGS=) ;;
            keycloak)
                menu_prepare_saved_plan "$area" || return
                menu_run 'Загрузка образа Keycloak' 1 bash -c 'cd "$1" || exit; shift; exec env -u COMPOSE_FILE -u COMPOSE_PROJECT_NAME -u COMPOSE_PROFILES -u COMPOSE_ENV_FILES -u COMPOSE_PATH_SEPARATOR -u COMPOSE_DISABLE_ENV_FILE docker "$@"' _ "$MENU_DIRECTORY" "${MENU_COMPOSE_ARGS[@]}" pull keycloak || return
                continue ;;
        esac
        menu_run "Сборка $area" 0 env -u COMPOSE_FILE -u COMPOSE_PROJECT_NAME -u COMPOSE_PROFILES -u COMPOSE_ENV_FILES -u COMPOSE_PATH_SEPARATOR -u COMPOSE_DISABLE_ENV_FILE -u BUILD_FLAGS -u IMAGE_TAG make -C "$source_real" "${build[@]}" || return
    done
    for area in "$@"; do
        menu_prepare_saved_plan "$area" || { failures+=("$area: Compose недоступен"); continue; }
        read -r -a targets <<< "${MENU_PLAN_SERVICES[$area]}"
        if menu_run "Пересоздание сервисов — $area" 1 bash -c 'cd "$1" || exit; shift; exec env -u COMPOSE_FILE -u COMPOSE_PROJECT_NAME -u COMPOSE_PROFILES -u COMPOSE_ENV_FILES -u COMPOSE_PATH_SEPARATOR -u COMPOSE_DISABLE_ENV_FILE docker "$@"' _ "$MENU_DIRECTORY" "${MENU_COMPOSE_ARGS[@]}" up -d --no-deps --force-recreate "${targets[@]}"; then
            updated+=("$area")
        elif ((MENU_CANCELLED)); then
            return 130
        else
            failures+=("$area (код $MENU_RC)")
        fi
    done
    MENU_OUTPUT_LINES=("Обновлены: ${updated[*]:-нет}" "Не обновлены: ${failures[*]:-нет}")
    menu_result 'Результат обновления'
}

menu_restore_terminal() {
    if ((MENU_SCREEN)); then
        tput cnorm 2>/dev/null || :
        printf '\033[?1049l'
        [[ -z $MENU_STTY ]] || stty "$MENU_STTY" 2>/dev/null || :
        MENU_SCREEN=0
    fi
}

menu_reenter_terminal() {
    [[ -t 0 && -t 1 ]] || return 1
    menu_enter
}

menu_prepare_saved_plan() {
    local area=$1 file=${MENU_PLAN_COMPOSE[$1]} project=${MENU_PLAN_PROJECT[$1]}
    MENU_DIRECTORY=${MENU_PLAN_DIR[$area]}
    MENU_COMPOSE_FILE=$file
    MENU_COMPOSE_ARGS=(compose --project-directory "$MENU_DIRECTORY" -f "$file")
    [[ ! -f $MENU_DIRECTORY/.env ]] || MENU_COMPOSE_ARGS+=(--env-file "$MENU_DIRECTORY/.env")
    [[ -z $project ]] || MENU_COMPOSE_ARGS+=(-p "$project")
}

menu_dashboard() {
    local -a actions=('Обновить' 'Перезапустить сервисы' 'Выключить сервисы' 'Обновить состояние' 'Назад')
    while :; do
        menu_build_dashboard
        screen_select 'Управление сервисами' MENU_SCREEN_BODY actions || return
        case $MENU_CHOICE in
            0) menu_service_action update ;;
            1) menu_service_action restart ;;
            2) menu_service_action stop ;;
            3) ;;
            4) return ;;
        esac
    done
}

menu_update_script() {
    local stage backup_stage backup_path script_dir first
    MENU_OUTPUT_LINES=()
    if ! menu_require curl bash; then menu_result 'Зависимости'; return; fi
    MENU_OUTPUT_LINES=("Источник: $MENU_RAW_URL" "Назначение: $MENU_SCRIPT" "Резервная копия: ${MENU_SCRIPT}.previous" 'Изменится только файл меню; установки и конфигурация не затрагиваются.')
    menu_confirm 'Скачать и проверить новую версию меню?' MENU_OUTPUT_LINES || return
    script_dir=$(dirname -- "$MENU_SCRIPT")
    stage=$(umask 077; mktemp "$script_dir/.menu.sh.XXXXXX") || { MENU_OUTPUT_LINES=('Не удалось создать временный файл рядом с меню.'); menu_result 'Обновление меню'; return; }
    MENU_TEMP_FILES+=("$stage")
    MENU_TITLE='Загрузка новой версии меню'
    MENU_SCREEN_BODY=('Загрузка menu.sh…') MENU_SCREEN_ACTIONS=()
    menu_draw_lines
    if ! curl --fail --silent --show-error --location --output "$stage" "$MENU_RAW_URL" 2>/dev/null; then rm -f -- "$stage"; MENU_OUTPUT_LINES=('Скачать menu.sh не удалось.'); menu_result 'Обновление меню'; return; fi
    if [[ ! -s $stage ]] || ! IFS= read -r first < "$stage" || [[ $first != '#!/usr/bin/env bash' && $first != '#!/bin/bash' ]]; then
        rm -f -- "$stage"; MENU_OUTPUT_LINES=('Файл не прошёл проверку shebang/размера.'); menu_result 'Обновление меню'; return
    fi
    if ! bash -n "$stage" 2>/dev/null; then rm -f -- "$stage"; MENU_OUTPUT_LINES=('bash -n обнаружил синтаксическую ошибку.'); menu_result 'Обновление меню'; return; fi
    backup_path=${MENU_SCRIPT}.previous
    backup_stage=$(umask 077; mktemp "$script_dir/.menu-backup.XXXXXX") || { rm -f -- "$stage"; MENU_OUTPUT_LINES=('Не удалось подготовить резервную копию.'); menu_result 'Обновление меню'; return; }
    MENU_TEMP_FILES+=("$backup_stage")
    if ! cp -- "$MENU_SCRIPT" "$backup_stage" 2>/dev/null || ! chmod 700 "$backup_stage" || ! mv -fT -- "$backup_stage" "$backup_path"; then
        rm -f -- "$stage" "$backup_stage"; MENU_OUTPUT_LINES=('Не удалось создать резервную копию; текущее меню не изменено.'); menu_result 'Обновление меню'; return
    fi
    if ! chmod 700 "$stage" || ! mv -fT -- "$stage" "$MENU_SCRIPT"; then
        rm -f -- "$stage"; MENU_OUTPUT_LINES=('Не удалось заменить меню; резервная копия сохранена.'); menu_result 'Обновление меню'; return
    fi
    MENU_TEMP_FILES=()
    MENU_OUTPUT_LINES=("Меню обновлено. Резервная копия: $backup_path")
    menu_result 'Обновление меню'
    menu_restore_terminal
    exec bash "$MENU_SCRIPT" --config "$MENU_CONFIG" || { printf '%s\n' 'Не удалось запустить обновлённое меню.' >&2; exit 1; }
}

menu_configuration() {
    local -a body=() actions=('Расположение установок' 'Обновить menu.sh' 'Назад')
    while :; do
        body=("Конфигурация: $MENU_CONFIG" "Backend + BFF: ${MENU_PATHS[backend]:-не управляется на этом хосте}" "Web: ${MENU_PATHS[web]:-не управляется на этом хосте}" "Keycloak: ${MENU_PATHS[keycloak]:-не управляется на этом хосте}" '' 'Настраивайте только нужные области')
        screen_select 'Управление конфигурацией' body actions || return
        case $MENU_CHOICE in
            0) menu_config_form ;;
            1) menu_update_script ;;
            2) return ;;
        esac
    done
}

menu_main() {
    local arg config_arg= set_config=0
    while (($#)); do
        arg=$1
        case $arg in
            --help) menu_usage; return 0 ;;
            --config)
                (($# >= 2)) || { printf '%s\n' 'Ошибка: --config требует путь.' >&2; menu_usage >&2; return 2; }
                config_arg=$2; set_config=1; shift 2 ;;
            *) menu_usage >&2; return 2 ;;
        esac
    done
    menu_require realpath || { printf '%s\n' "${MENU_OUTPUT_LINES[*]}" >&2; return 1; }
    MENU_SCRIPT=$(realpath -m -- "${BASH_SOURCE[0]}") || return 1
    MENU_CONFIG=$(dirname -- "$MENU_SCRIPT")/.tdn-menu.conf
    MENU_REPOSITORY=${TDN_MENU_REPOSITORY:-https://github.com/Misha00025/TheDungeonNotebook.git}
    MENU_REF=${TDN_MENU_REF:-master}
    MENU_RAW_URL=${TDN_MENU_RAW_URL:-https://raw.githubusercontent.com/Misha00025/TheDungeonNotebook/master/deploy/menu.sh}
    ((set_config)) && MENU_CONFIG=$config_arg
    MENU_CONFIG=$(realpath -m -- "$MENU_CONFIG") || return 1
    [[ $MENU_CONFIG != "$MENU_SCRIPT" && $MENU_CONFIG != "${MENU_SCRIPT}.previous" ]] || { printf '%s\n' 'Ошибка: путь конфигурации совпадает с меню или резервной копией.' >&2; return 2; }
    MENU_OUTPUT_LINES=()
    if ! menu_require stty tput awk sed mkdir mktemp chmod mv cp rm dirname basename find sleep env; then printf '%s\n' "${MENU_OUTPUT_LINES[@]}" >&2; return 1; fi
    [[ -t 0 && -t 1 ]] || { printf '%s\n' 'Нужен интерактивный терминал.' >&2; return 1; }
    menu_load_config || return 1
    MENU_SOURCE_DIR=${TDN_MENU_SOURCE_DIR:-${MENU_SAVED_SOURCE_DIR:-${XDG_CACHE_HOME:-$HOME/.cache}/tdn-menu/sources}}
    MENU_SOURCE_DIR=$(realpath -m -- "$MENU_SOURCE_DIR") || return 1
    trap menu_cleanup EXIT
    trap 'exit 130' INT
    trap 'exit 143' TERM
    trap 'menu_redraw' WINCH
    menu_enter || return 1
    if [[ -n $MENU_CONFIG_WARNING ]]; then MENU_OUTPUT_LINES=("$MENU_CONFIG_WARNING"); menu_result 'Конфигурация'; fi
    local -a body=() actions=('Управление конфигурацией' 'Управление сервисами' 'Выход')
    while :; do
        body=()
        screen_select 'Главное меню' body actions || { MENU_CHOICE=2; }
        case $MENU_CHOICE in
            0) menu_configuration ;;
            1) menu_dashboard ;;
            2) return 0 ;;
        esac
    done
}

if [[ ${BASH_SOURCE[0]} == "$0" ]]; then
    menu_main "$@"
fi
