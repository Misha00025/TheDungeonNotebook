import pymysql
from mongodb_helper import insert_character_to_mongo
from mysql_helper import get_old_data, update_new_tables
from config import OLD_MYSQL_HOST, OLD_MYSQL_USER, OLD_MYSQL_PASSWORD, OLD_MYSQL_DATABASE, NEW_MYSQL_HOST, NEW_MYSQL_USER, NEW_MYSQL_PASSWORD, NEW_MYSQL_DATABASE, MONGODB_URI


def migrate():
    # Подключение к старой базе данных
    old_db_connection = pymysql.connect(
        host=OLD_MYSQL_HOST,
        user=OLD_MYSQL_USER,
        password=OLD_MYSQL_PASSWORD,
        database=OLD_MYSQL_DATABASE
    )
    
    # Получение старых данных
    users, groups, user_groups, notes = get_old_data(old_db_connection)
    
    # Закрытие соединения со старой базой данных
    old_db_connection.close()
    
    # Подключение к новой базе данных
    new_db_connection = pymysql.connect(
        host=NEW_MYSQL_HOST,
        user=NEW_MYSQL_USER,
        password=NEW_MYSQL_PASSWORD,
        database=NEW_MYSQL_DATABASE
    )
    
    # Обновление новых таблиц
    update_new_tables(new_db_connection, users, groups, user_groups, notes)
    
    # Закрытие соединения с новой базой данных
    new_db_connection.close()
    
    # Перенос данных в MongoDB
    for user in users:
        for group in groups:
            if any(user['user_id'] == ug['user_id'] and group['group_id'] == ug['group_id'] for ug in user_groups):
                character_uuid = insert_character_to_mongo(MONGODB_URI, user, group, notes)
                
                # Добавляем ссылку на UUID в таблицу characters
                with new_db_connection.cursor() as cursor:
                    cursor.execute("INSERT INTO character (character_id, group_id, owner_id, uuid) VALUES (%s, %s, %s, %s)", (
                        None, group['group_id'], user['user_id'], character_uuid))
                    new_db_connection.commit()

if __name__ == "__main__":
    migrate()