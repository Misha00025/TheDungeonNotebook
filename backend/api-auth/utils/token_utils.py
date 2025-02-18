import jwt
from datetime import datetime, timedelta, timezone
import jwt.exceptions
from config import secret_key as sk

secret_key = jwt.jwk.OctetJWK(bytes(str(sk), encoding="utf-8"))

def generate_jwt_token(access_id, auth_type="user"):
	payload = {
		'access_id': access_id,
		'auth_type': auth_type,
		'exp': int(datetime.timestamp(datetime.now(tz=timezone.utc) + timedelta(days=7)))
	}
	token: jwt.JWT = jwt.JWT().encode(payload, secret_key)
	return token
	

def verify_and_return_token_data(token):
	try:
		decoded_payload = jwt.JWT().decode(token, secret_key, algorithms=['HS256'])
		
		access_type = decoded_payload['auth_type']
		access_id = decoded_payload['access_id']
		
		return {"access": {"type": access_type, "id": access_id}}
	except jwt.exceptions.JWTDecodeError as e:
		return {"message": str(e)}