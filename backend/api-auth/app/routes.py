from flask import Blueprint, request, jsonify
from utils.token_utils import generate_jwt_token, verify_and_return_token_data
from utils.vk_utils import generate_access_token, get_account_info, get_authorize_data, get_payload
from app.services.user_service import create_or_update_user, save_user_token


login_routes = Blueprint('login_routes', __name__)


@login_routes.route('/login', methods=['POST'])
def login():
	try:
		content = request.json
		err, payload = get_payload(content)
		if err:	
			return "payload not found", 415
		auth_data = get_authorize_data(payload)
		err, result = generate_access_token(*auth_data)
		if err:
			return result, 406
		vk_id = payload["user"]["id"]
		err, user_info = get_account_info(vk_id)
		
		create_or_update_user(vk_id, user_info)		
		jwt_token = generate_jwt_token(vk_id, auth_type="user")
		save_user_token(vk_id, jwt_token)
		
		return jsonify({
			'message': 'Login successful',
			'access_token': jwt_token
		}), 200
	except Exception as e:
		return jsonify({'message': str(e)}), 500
		

@login_routes.route('/whoami', methods=['GET'])
def whoami():
	token = request.args.get('token')
	if not token:
		return jsonify({"message": "Token not provided"}), 401
	try:
		data = verify_and_return_token_data(token)
	except:
		return jsonify({"message": "Invalid token"}), 403
	return jsonify(data), 200 if "message" not in data else 403