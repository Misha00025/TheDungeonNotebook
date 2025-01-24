import pymysql

def get_old_data(connection):
    cursor = connection.cursor(pymysql.cursors.DictCursor)
    
    # Получаем пользователей
    cursor.execute("SELECT * FROM vk_user")
    users = cursor.fetchall()
    
    # Получаем группы
    cursor.execute("SELECT * FROM vk_group")
    groups = cursor.fetchall()
    
    # Получаем связи пользователь-группа
    cursor.execute("SELECT * FROM user_group")
    user_groups = cursor.fetchall()
    
    # Получаем заметки
    cursor.execute("SELECT * FROM note")
    notes = cursor.fetchall()
    
    # Получаем предметы
    cursor.execute("SELECT * FROM item")
    items = cursor.fetchall()

    query = """
    SELECT i.owner_id,
       it.group_id,
       it.name,
       it.description,
       it.image_link,
       ii.amount
    FROM inventory i
    JOIN inventory_item ii ON i.inventory_id = ii.inventory_id
    JOIN item it ON ii.item_id = it.item_id;
    """
    cursor.execute(query)
    user_items = cursor.fetchall()

    cursor.close()
    
    return users, groups, user_groups, notes, items, user_items

def update_new_tables(connection, users, groups, user_groups):
    cursor = connection.cursor()
    
    # Обновляем таблицу user
    for user in users:
        cursor.execute("REPLACE INTO `user` (`user_id`, `first_name`, `last_name`, `photo_link`) VALUES (%s, %s, %s, %s)",
                       (user['vk_user_id'], user['first_name'], user['last_name'], user['photo_link']))
        
    # Обновляем таблицу group
    for group in groups:
        cursor.execute("REPLACE INTO `group` (`group_id`, `name`, `photo_link`) VALUES (%s, %s, %s)",
                       (group['vk_group_id'], group['group_name'], None))  # Поле photo_link пока пустое
        
    # Обновляем таблицу user_group
    for user_group in user_groups:
        cursor.execute("REPLACE INTO user_group (user_id, group_id, privileges) VALUES (%s, %s, %s)",
                       (user_group['vk_user_id'], user_group['vk_group_id'], user_group['is_admin']))  # is_admin теперь privileges
    
    connection.commit()
    cursor.close()
