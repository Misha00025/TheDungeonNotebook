from flask import Request
from app.access_management import access_to_group
from app.processing.request_parser import from_user
from .parser import get_group_id, get_user_id, from_bot, search_by_name
from . import processor, parser
from app.status import accepted, created, ok, forbidden, not_found, bad_request, conflict


def br(method):
    return f"Bad Request: can't {method} item using parameter 'name'. Please, use 'item_id'"


def errs_response(errs):
    return  {"error": {
                "message": "Find incorrect field type",
                "fields": errs
            }}


def check_group_access(rq: Request):
    if from_bot(rq):
        return True, True
    user_id, group_id = get_user_id(rq), get_group_id(rq)
    return access_to_group(user_id, group_id)


def shared_item(admin, user_id, owner_id, rq):
    find_item_from_bot = (user_id is not None and from_bot(rq))
    has_owner_id = owner_id is not None
    return admin and not (find_item_from_bot or has_owner_id)


def get_inventory(group_id, owner_id):
    if not processor.check_user_group(group_id, owner_id):
        return forbidden("Forbidden: User not in group")
    items = processor.get_inventory_items(group_id, owner_id)
    if items is None:
        return not_found("Inventory not found")
    return ok(items)


def get_slot(group_id, owner_id, item_id):
    if not processor.check_user_group(group_id, owner_id):
        return forbidden("Forbidden: User not in group")
    inv = processor.get_inventory(group_id, owner_id)
    if inv is None:
        return not_found("Inventory not found")
    item = processor.get_inventory_slot(inv, item_id)
    if item is None:
        return not_found("Item not found")
    return ok(item.to_dict())


def gets(rq: Request):
    user_id, group_id = get_user_id(rq), get_group_id(rq)
    access, admin = check_group_access(rq)
    owner_id = parser.get_owner_id(rq)
    if not access:
        return forbidden()
    if admin and owner_id is None:
        return ok(processor.get_all_items(group_id))
    if owner_id is None:
        owner_id = user_id
    return get_inventory(group_id, owner_id)


def get(rq: Request, item_id):
    user_id, group_id = get_user_id(rq), get_group_id(rq)
    access, admin = check_group_access(rq)
    owner_id = parser.get_owner_id(rq)
    if not access:
        return forbidden()
    item = None
    if admin:
        if owner_id is not None:
            return get_slot(group_id, owner_id, item_id)
        item = processor.get_item(group_id, item_id)
        if item is None:
            return not_found("Item not found")
        return ok(item.to_dict())
    else:
        return get_slot(group_id, user_id, item_id)
    

def put(rq: Request, item_id):
    user_id, group_id = get_user_id(rq), get_group_id(rq)
    access, admin = check_group_access(rq)
    if not access:
        return forbidden()
    errs, name, description, amount = parser.get_item_data(rq)
    if errs is not None:
        return bad_request(errs_response(errs))
    if admin:
        owner_id = parser.get_owner_id(rq)
        if owner_id is None:
            if name is not None:
                item = processor.get_item(group_id, name)
                if item is not None:
                    return conflict("Conflict: item with this name already exist")
            result = processor.put_item(group_id, item_id, name, description)
            if name is not None:
                item_id = name
                result = item is None
            item = processor.get_item(group_id, item_id)
        else:
            if not processor.check_user_group(group_id, owner_id):
                return forbidden("User not in group")
            inv = processor.get_inventory(group_id, owner_id)
            if inv is None:
                return forbidden()
            result = processor.put_slot(inv, item_id, amount)
            item = processor.get_inventory_slot(inv, item_id) 
    else:
        inv = processor.get_inventory(group_id, user_id)
        if inv is None:
            return forbidden()
        result = processor.put_slot(inv, item_id, amount)
        item = processor.get_inventory_slot(inv, item_id) 
    if not result or item is None: 
        return not_found()
    return accepted(item.to_dict())


def delete(rq: Request, item_id):
    user_id, group_id = get_user_id(rq), get_group_id(rq)
    access, admin = check_group_access(rq)
    owner_id = parser.get_owner_id(rq)
    if user_id is None:
        user_id = owner_id
    if not access or not processor.check_user_group(group_id, user_id):
        return forbidden()
    if shared_item(admin, user_id, owner_id, rq):
        result = processor.delete_item(group_id, item_id)
    else:
        
        inv = processor.get_inventory(group_id, owner_id)
        if inv is None:
            return forbidden()
        result = processor.remove_slot(inv, item_id)
    if not result:
        return not_found()
    return ok()


def post_add(rq: Request, item_id):
    user_id, group_id = get_user_id(rq), get_group_id(rq)
    access, admin = check_group_access(rq)
    if not access:
        return forbidden()
    if not admin:
        owner_id = user_id
    else:
        owner_id = parser.get_owner_id(rq)
    if owner_id is None:
        return bad_request()
    inv = processor.get_inventory(group_id, owner_id)
    if inv is None or not processor.check_user_group(group_id, owner_id):
        return forbidden()
    errs, _, _, amount = parser.get_item_data(rq)
    if errs is not None:
        return bad_request(errs_response(errs))
    exi, exs = processor.add_item(inv, item_id, amount)
    if not exi:
        return not_found()
    if exs:
        return conflict("item already added")
    return created()
    

def post_new(rq: Request):
    group_id = get_group_id(rq)
    access, admin = check_group_access(rq)
    if not access or not admin:
        return forbidden()
    errs, name, description, _ = parser.get_item_data(rq)
    print(parser.get_item_data(rq))
    if name is None or description is None:
        return bad_request({"error":{
            "message": "Needed fields: 'name' and 'description'"
        }})
    if errs is not None:
        return bad_request(errs_response(errs))
    item = processor.get_item(group_id, name)
    if item is not None:
        return conflict("Conflict: Item already exist")
    item = processor.create_item(group_id, name, description)
    if item is None:
        bad_request()
    return created({"created_item": item.to_dict()})
