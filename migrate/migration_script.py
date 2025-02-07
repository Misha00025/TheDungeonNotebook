import pymysql
import paramiko
from mongodb_helper import insert_character_to_mongo, insert_item_to_mongo, insert_template_to_mongo, delete_db
from mysql_helper import get_old_data, update_new_tables, create_tables, post_sql
from secret_config import *

def migrate():
    # Подключение к старой базе данных
    old_db_connection = pymysql.connect(
        host="localhost",
        user=OLD_MYSQL_USER,
        password=OLD_MYSQL_PASSWORD,
        database=OLD_MYSQL_DATABASE,
        port=OLD_MYSQL_PORT
    )
    
    # Получение старых данных
    users, groups, user_groups, notes, items, user_items = get_old_data(old_db_connection)
    
    # Закрытие соединения со старой базой данных
    old_db_connection.close()
    
    # Подключение к новой базе данных
    new_db_connection = pymysql.connect(
        host="localhost",
        user=NEW_MYSQL_USER,
        password=NEW_MYSQL_PASSWORD,
        database=NEW_MYSQL_DATABASE,
        port=NEW_MYSQL_PORT
    )
    
    create_tables(new_db_connection)

    # Обновление новых таблиц
    update_new_tables(new_db_connection, users, groups, user_groups)
    delete_db(MONGODB_URI)

    # Перенос данных в MongoDB
    template_id = 0
    character_id = 0
    for item in items:
        with new_db_connection.cursor() as cursor:
            item_uuid = insert_item_to_mongo(MONGODB_URI, item)
            cursor.execute("REPLACE INTO item (item_id, group_id, uuid) VALUES (%s, %s, %s)", (
                        None, item['group_id'], item_uuid))

    for group in groups:
        # if group["vk_group_id"] != "-101":
        #     continue
        template_id += 1
        with new_db_connection.cursor() as cursor:
            template_uuid = insert_template_to_mongo(MONGODB_URI, group)
            cursor.execute("REPLACE INTO charlist_template (template_id, group_id, uuid) VALUES (%s, %s, %s)", (
                        template_id, group['vk_group_id'], template_uuid))
        for user in users:
            character_id += 1
            if any(user['vk_user_id'] == ug['vk_user_id'] and group['vk_group_id'] == ug['vk_group_id'] for ug in user_groups):
                character_uuid = insert_character_to_mongo(MONGODB_URI, user, group, notes, user_items)
                with new_db_connection.cursor() as cursor:
                    cursor.execute("REPLACE INTO `character` (`character_id`, `group_id`, `template_id`, `owner_id`, `uuid`) VALUES (%s, %s, %s, %s, %s)", (
                        character_id, int(group['vk_group_id']), template_id, user['vk_user_id'], character_uuid))
                    new_db_connection.commit()

    post_sql(new_db_connection)
    new_db_connection.close()

if __name__ == "__main__":
    try:
        migrate()
    finally:
        pass