"""
Кастомные response-хендлеры для endpoint'ов, которые не являются
простым HTTP-прокси (композитные, локальные, со特殊ной логикой).

Каждый хендлер регистрируется через @register_response_handler("name")
и может быть использован в routes.yaml по имени.
"""

from flask import jsonify

from app.engine.context import RouteContext
from app.security import get_user_id
from app.engine.registry import register_response_handler
from app.status import ok


# ============================================================
# Локальные эндпоинты
# ============================================================

@register_response_handler("get_api")
def handle_get_api(ctx: RouteContext):
    """
    Возвращает схему всех зарегистрированных API-методов.
    """
    from app.api_controller import get_routers_info
    return ok({"api_methods": get_routers_info()})


@register_response_handler("whoami")
def handle_whoami(ctx: RouteContext):
    """
    Декодирует JWT и возвращает информацию о текущем пользователе/группе.
    """
    uid = get_user_id(ctx.jwt)
    gid = ctx.jwt.get("groupId") if ctx.jwt else None

    res_id = uid or gid
    access_type = "anonymous"
    if uid is not None:
        access_type = "user"
    elif gid is not None:
        access_type = "group"

    return ok({
        "id": int(res_id) if res_id is not None else None,
        "type": access_type,
        "userId": uid,
        "sub": uid,
        "groupId": gid,
    })


# ============================================================
# Composite endpoints — оркестрация нескольких сервисов
# ============================================================

@register_response_handler("group_users")
def handle_group_users(ctx: RouteContext):
    """
    Собирает список пользователей группы из двух сервисов:
    1. policy-service — список userId с правами
    2. users-service — профили пользователей

    Возвращает агрегированный список {user, isAdmin}.
    """
    group_id = ctx.path_params["group_id"]

    # Запрос к policy-service
    pres = ctx.services.campaign.get(
        "/polices/groups",
        params={"groupId": group_id}
    )
    if not pres.ok:
        return jsonify({"error": "Not found"}), 404

    group_users = []
    for entry in pres.json().get("users", []):
        user_resp = ctx.services.users.get(f"/users/{entry['userId']}")
        if user_resp.ok:
            group_users.append({
                "user": user_resp.json(),
                "isAdmin": entry.get("isAdmin"),
            })

    return ok({"users": group_users})


@register_response_handler("character_users")
def handle_character_users(ctx: RouteContext):
    """
    Собирает список пользователей персонажа из двух сервисов:
    1. policy-service — список userId с character-правами
    2. users-service — профили пользователей

    Возвращает агрегированный список {user, canWrite}.
    """
    group_id = ctx.path_params["group_id"]
    character_id = ctx.path_params["character_id"]

    # Запрос к policy-service
    pres = ctx.services.campaign.get(
        "/polices/groups/characters",
        params={
            "groupId": group_id,
            "characterId": character_id,
        }
    )
    if not pres.ok:
        return jsonify({"error": "Not found"}), 404

    character_users = []
    for entry in pres.json().get("users", []):
        user_resp = ctx.services.users.get(f"/users/{entry['userId']}")
        if user_resp.ok:
            character_users.append({
                "user": user_resp.json(),
                "canWrite": entry.get("canWrite"),
            })

    return ok({"users": character_users})


@register_response_handler("group_export")
def handle_group_export(ctx: RouteContext):
    """
    Экспорт данных группы.
    Проксирует запрос в campaign-service с дополнительными параметрами.
    """
    from app.api_controller import make_response

    group_id = ctx.path_params["group_id"]
    include = ctx.request.args.get("include", "templates,characters,items,skills")
    uid = get_user_id(ctx.jwt)

    params = {"include": include}
    if uid:
        params["userId"] = str(uid)

    # Используем существующий сервис-клиент для совместимости
    from app import services as svc
    result = svc.groups(ctx.request.headers, group_id).export(
        params=params,
        headers=ctx.request.headers,
    )

    try:
        return result.json(), result.status_code
    except Exception:
        return result.content, result.status_code


@register_response_handler("group_import")
def handle_group_import(ctx: RouteContext):
    """
    Импорт данных группы.
    Проксирует запрос в campaign-service с дополнительными параметрами.
    """
    from app.api_controller import make_response

    group_id = ctx.path_params["group_id"]
    include = ctx.request.args.get("include", "templates,characters,items,skills")
    uid = get_user_id(ctx.jwt)

    params = {"include": include}
    if uid:
        params["userId"] = str(uid)

    from app import services as svc
    result = svc.groups(ctx.request.headers, group_id).import_data(
        data=ctx.request.data,
        params=params,
        headers=ctx.request.headers,
    )

    try:
        return result.json(), result.status_code
    except Exception:
        return result.content, result.status_code


@register_response_handler("user_create")
def handle_user_create(ctx: RouteContext):
    """
    Создание пользователя.
    Принудительно подставляет id из JWT в тело запроса,
    чтобы пользователь не мог указать чужой id.
    """
    from app import services as svc

    uid = get_user_id(ctx.jwt)
    if uid is None:
        from app.status import forbidden
        return forbidden()

    data = ctx.request.get_json() or {}
    data["id"] = int(uid)

    user_svc = svc.users(ctx.request.headers)
    result = user_svc.post(json=data)

    from app.api_controller import make_response
    return make_response(result)
