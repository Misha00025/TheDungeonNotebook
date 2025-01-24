import pymysql

def get_old_data(connection):
    cursor = connection.cursor(pymysql.cursors.DictCursor)
    
    # Получаем пользователей
    cursor.execute("SELECT * FROM user")
    users = cursor.fetchall()
    
    # Получаем группы
    cursor.execute("SELECT * FROM group")
    groups = cursor.fetchall()
    
    # Получаем связи пользователь-группа
    cursor.execute("SELECT * FROM user_group")
    user_groups = cursor.fetchall()
    
    # Получаем заметки
    cursor.execute("SELECT * FROM note")
    notes = cursor.fetchall()
    
    cursor.close()
    
    return users, groups, user_groups, notes

def update_new_tables(connection, users, groups, user_groups, notes):
    cursor = connection.cursor()
    
    # Обновляем таблицу user
    for user in users:
        cursor.execute("REPLACE INTO user (user_id, first_name, last_name, photo_link) VALUES (%s, %s, %s, %s)",
                       (user['user_id'], user['first_name'], user['last_name'], user['photo_link']))
        
    # Обновляем таблицу group
    for group in groups:
        cursor.execute("REPLACE INTO group (group_id, group_name, photo_link) VALUES (%s, %s, %s)",
                       (group['group_id'], group['group_name'], ''))  # Поле photo_link пока пустое
        
    # Обновляем таблицу user_group
    for user_group in user_groups:
        cursor.execute("REPLACE INTO user_group (user_id, group_id, privileges) VALUES (%s, %s, %s)",
                       (user_group['user_id'], user_group['group_id'], user_group['is_admin']))  # is_admin теперь privileges
        
    # Создаем таблицу character
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS character (
            character_id INT AUTO_INCREMENT PRIMARY KEY,
            group_id INT,
            owner_id INT,
            uuid VARCHAR(255),
            FOREIGN KEY (group_id) REFERENCES group(group_id),
            FOREIGN KEY (owner_id) REFERENCES user(user_id)
        )""")
    
    connection.commit()
    cursor.close()
