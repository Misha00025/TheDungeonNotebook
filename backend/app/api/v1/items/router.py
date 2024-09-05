from flask import Request
from app.access_management import access_to_group
from app.processing.request_parser import from_user
from .parser import get_group_id, get_user_id, from_bot, search_by_name
from . import processor, parser
from app.status import accepted, created, ok, forbidden, not_found, bad_request


def br(method):
    return f"Bad Request: can't {method} item using parameter 'name'. Please, use 'item_id'"


def check_group_access(rq: Request):
    if from_bot(rq):
        return True, True
    user_id, group_id = get_user_id(rq), get_group_id(rq)
    return access_to_group(user_id, group_id)


def shared_item(admin, user_id, owner_id, rq):
    find_item_from_bot = (user_id is not None and from_bot(rq))
    has_owner_id = owner_id is not None
    return admin and not (find_item_from_bot or has_owner_id)


def gets(rq: Request):
    user_id, group_id = get_user_id(rq), get_group_id(rq)
    access, admin = check_group_access(rq)
    if not access:
        return forbidden()
    if admin:
        return ok(processor.get_all_items(group_id))
    items = processor.get_inventory_items(group_id, user_id)
    if items is None:
        return not_found()
    return ok(items)


def get(rq: Request, item_id):
    user_id, group_id = get_user_id(rq), get_group_id(rq)
    access, admin = check_group_access(rq)
    owner_id = parser.get_owner_id(rq)
    by_name = search_by_name(rq)
    if not access:
        return forbidden()
    item = None
    if shared_item(admin, user_id, owner_id, rq):
        if by_name:
            item = processor.get_item_by_name(item_id)
        else:
            item = processor.get_item_by_id(item_id)
    else:
        if owner_id is None:
            owner_id = user_id 
        inv = processor.get_inventory(group_id, owner_id)
        if inv is None:
            return not_found("Inventory not found")
        if by_name:
            item = processor.get_inventory_slot_by_name(inv, item_id)
        else:
            item = processor.get_inventory_slot(inv, item_id)
    if item is None:
        return not_found("Item not found")
    return ok(item.to_dict())
    

def put(rq: Request, item_id):
    user_id, group_id = get_user_id(rq), get_group_id(rq)
    access, admin = check_group_access(rq)
    owner_id = parser.get_owner_id(rq)
    by_name = parser.search_by_name(rq)
    if not access:
        return forbidden()
    if by_name:
        return bad_request(br("put"))
    errs, name, description, amount = parser.get_item_data(rq)
    if errs is not None:
        return bad_request({"error": {
                "message": "Find incorrect field type",
                "fields": errs
            }})
    if shared_item(admin, user_id, owner_id, rq):
        result = processor.put_item(item_id, name, description)
    else:
        if owner_id is None:
            owner_id = user_id
        inv = processor.get_inventory(group_id, owner_id)
        result = processor.put_slot(inv, item_id, amount)
    if not result: 
        return not_found()
    return accepted(result)

def delete(rq: Request, item_id):
    user_id, group_id = get_user_id(rq), get_group_id(rq)
    access, admin = check_group_access(rq)
    owner_id = parser.get_owner_id(rq)
    by_name = parser.search_by_name(rq)
    if not access:
        return forbidden()
    if by_name:
        return bad_request(br("delete"))
    if shared_item(admin, user_id, owner_id, rq):
        result = processor.delete_item(item_id)
    else:
        if owner_id is None:
            owner_id = user_id
        inv = processor.get_inventory(group_id, owner_id)
        result = processor.remove_slot(inv, item_id)
    if not result:
        return not_found()
    return ok()


def post_add(rq: Request):
    user_id, group_id = get_user_id(rq), get_group_id(rq)
    access, admin = check_group_access(rq)
    owner_id = parser.get_owner_id(rq)
    by_name = parser.search_by_name(rq)
    item_id = parser.get_item_id(rq)
    if not access:
        return forbidden()
    if by_name:
        return bad_request(br("add"))
    if item_id is None:
        return bad_request("'item_id' not found!")
    if owner_id is None:
        owner_id = user_id
    inv = processor.get_inventory(group_id, owner_id)
    res = processor.add_item(inv, item_id)
    if not res:
        return not_found()
    return created()
    

def post_new(rq: Request):
    group_id = get_group_id(rq)
    access, admin = check_group_access(rq)
    if not access or not admin:
        return forbidden()
    errs, name, description, _ = parser.get_item_data(rq)
    if errs is not None:
        return bad_request({"error": {
                "message": "Find incorrect field type",
                "fields": errs
            }})
    item = processor.create_item(group_id, name, description)
    if item is None:
        bad_request()
    return created({"created_item": item.to_dict()})