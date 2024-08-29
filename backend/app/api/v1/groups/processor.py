from flask import Request
from app.processing.request_parser import *
from app.model.VkUser import VkUser
from app.model.Group import Group
from app.processing.request_parser import get_group_id, get_user_id


def get(group_id: int, rq: Request):
    user_id = get_user_id(rq)
    


def get_all(rq: Request):
    pass
