from flask import Request


def extract_tokens(rq: Request) ->  tuple[str | None, str | None] :
    '''
    returns:
    access_token, refresh_token
    '''
    access_token = rq.headers.get('Authorization')
    refresh_token = rq.headers.get('Refresh-Token')
    return access_token, refresh_token

def check_token(token: str | None) -> bool:
    from app import services
    res = services.auth().check(token)
    return res.ok
