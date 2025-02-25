from datetime import datetime, timezone
from utils.db import execute_query

def create_or_update_user(user_id, user_info):
    # Проверяем, существует ли пользователь в базе данных
    query = "SELECT * FROM user WHERE user_id = %s"
    result = execute_query(query, (user_id,))
    
    if len(result) == 0:
        # Добавляем нового пользователя
        insert_query = """
            INSERT INTO user (user_id, first_name, last_name, photo_link)
            VALUES (%s, %s, %s, %s)
        """
        execute_query(insert_query, (user_id, user_info['first_name'], user_info['last_name'], user_info['photo_100']))
    else:
        # Обновляем информацию о пользователе
        update_query = """
            UPDATE user SET first_name = %s, last_name = %s, photo_link = %s
            WHERE user_id = %s
        """
        execute_query(update_query, (user_info['first_name'], user_info['last_name'], user_info['photo_100'], user_id))

def save_user_token(user_id, jwt_token):
    # Сохраняем токен в таблицу user_token
    insert_token_query = """
        REPLACE INTO user_token (user_id, token, last_date)
        VALUES (%s, %s, %s)
    """
    execute_query(insert_token_query, (user_id, jwt_token, datetime.now(tz=timezone.utc)))