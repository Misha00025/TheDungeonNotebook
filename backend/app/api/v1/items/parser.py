from flask import Request
from app.processing.request_parser import get_group_id, get_user_id, from_bot


def search_by_name(rq: Request):
    key = "by-name"
    by_name = False
    if key in rq.args.keys():
        by_name = bool(rq.args.get(key))
    return by_name


def get_owner_id(rq: Request):
    res = None
    if from_bot(rq):
        res = get_user_id(rq)
    if res is None:
        key = "owner_id"
        if key not in rq.args.keys():
            return None
        res = rq.args.get(key)
    return res


def get_item_data(rq: Request) -> tuple[list[str], str | None, str | None, int | None]:
    fields = {"name": str, "description": str, "amount": int}
    errs = []
    values = []
    data =dict(rq.json)
    keys = data.keys()
    for key, value in fields.items():
        if key in keys:
            print(f"founded: {key}")
            val = data.get(key)
            try:
                val = value(val)
            except:
                val = None
                errs.append(key)
            values.append(val)
        else:
            values.append(None)
    if len(errs) == 0:
        errs = None
    return errs, values[0], values[1], values[2]


def get_item_id(rq: Request):
    key = "item_id"
    if key in rq.args.keys():
        return None
    return rq.args.get(key)