from flask import Request
from app.processing.request_parser import *
from app.processing.request_parser import get_group_id, get_user_id, get_admin_status, from_bot, from_user
from app.status import ok, forbidden, created, not_found, accepted, not_implemented


def get(user_id: int, rq: Request):
	return not_implemented()


def get_all(rq: Request):
	if from_bot(rq):
		group_id = get_group_id(rq)
		return not_implemented()
	if from_user(rq):
		user_id = get_user_id(rq)
		return not_implemented()


def add(rq: Request):
	user_id = get_user_id(rq)
	group_id = get_group_id(rq)
	is_admin = get_admin_status(rq)
	return not_implemented()


def delete(user_id, rq: Request):
	group_id = get_group_id(rq)	
	return not_implemented()

