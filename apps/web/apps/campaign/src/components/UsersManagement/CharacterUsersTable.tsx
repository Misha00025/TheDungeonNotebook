// components/UsersManagement/CharacterUsersTable.tsx
import React, { useState, useEffect } from 'react';
import { CharacterShort } from '../../types/characters';
import { CharacterUser } from '../../types/characterUsers';
import { User } from '../../types/groupUsers';
import { charactersAPI, characterUsersAPI } from '../../services/api';
import { useUserManagement } from '../../hooks/useUserManagement';
import { useGroupUsers } from '../../contexts/GroupUsersContext';
import UsersList from './UsersList';
import buttonStyles from '@tdn/shared/styles/components/Button.module.css';
import styles from './CharacterUsersTable.module.css';

interface CharacterUsersTableProps {
  groupId: number;
  canManage: boolean;
  groupUsers: User[];
}

const CharacterUsersTable: React.FC<CharacterUsersTableProps> = ({ 
  groupId, 
  canManage, 
  groupUsers 
}) => {
  const [characters, setCharacters] = useState<CharacterShort[]>([]);
  const [characterUsers, setCharacterUsers] = useState<{[characterId: number]: CharacterUser[]}>({});
  const [addingUsers, setAddingUsers] = useState<{[characterId: number]: boolean}>({});
  const [selectedUserIds, setSelectedUserIds] = useState<{[characterId: number]: number}>({});
  const [permissions, setPermissions] = useState<{[characterId: number]: boolean}>({});
  const { loading, error, success, executeOperation } = useUserManagement();
  const { refreshCharacterUsers } = useGroupUsers();

  useEffect(() => {
    loadCharacters();
  }, [groupId]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadCharacters = async () => {
    const chars = await charactersAPI.getCharacters(groupId);
    setCharacters(chars);
    
    const characterUsersMap: {[characterId: number]: CharacterUser[]} = {};
    for (const char of chars) {
      try {
        const users = await characterUsersAPI.getCharacterUsers(groupId, char.id);
        if (users.length > 0) {
          characterUsersMap[char.id] = users;
        }
      } catch (error) {
        console.error(`Failed to load users for character ${char.id}:`, error);
      }
    }
    setCharacterUsers(characterUsersMap);
  };

  const handleAddCharacterUser = async (characterId: number) => {
    const userId = selectedUserIds[characterId];
    const canWrite = permissions[characterId] || false;
    
    if (!userId) return;

    const user = groupUsers.find(u => u.id === userId);
    if (!user) return;

    await executeOperation(
      () => characterUsersAPI.addUserToCharacter(groupId, characterId, userId, canWrite),
      `Игрок ${user.nickname} успешно добавлен персонажу`
    );

    // Обновляем общий контекст GroupUsersContext
    await refreshCharacterUsers(characterId);

    // Обновляем данные
    const updatedUsers = await characterUsersAPI.getCharacterUsers(groupId, characterId);
    setCharacterUsers(prev => ({
      ...prev,
      [characterId]: updatedUsers
    }));
    
    // Сбрасываем состояние
    setAddingUsers(prev => ({ ...prev, [characterId]: false }));
    setSelectedUserIds(prev => ({ ...prev, [characterId]: 0 }));
    setPermissions(prev => ({ ...prev, [characterId]: false }));
  };

  const handleRemoveCharacterUser = async (characterId: number, userId: number) => {
    await executeOperation(
      () => characterUsersAPI.removeUserFromCharacter(groupId, characterId, userId),
      'Игрок успешно удалён'
    );

    // Обновляем общий контекст GroupUsersContext
    await refreshCharacterUsers(characterId);
    
    // Обновляем данные
    const updatedUsers = await characterUsersAPI.getCharacterUsers(groupId, characterId);
    if (updatedUsers.length === 0) {
      // Удаляем персонажа из таблицы, если пользователей не осталось
      setCharacterUsers(prev => {
        const newCharacterUsers = { ...prev };
        delete newCharacterUsers[characterId];
        return newCharacterUsers;
      });
    } else {
      setCharacterUsers(prev => ({
        ...prev,
        [characterId]: updatedUsers
      }));
    }
  };

  const startAddUser = (characterId: number) => {
    setAddingUsers(prev => ({ ...prev, [characterId]: true }));
    setSelectedUserIds(prev => ({ ...prev, [characterId]: 0 }));
    setPermissions(prev => ({ ...prev, [characterId]: false }));
  };

  const cancelAddUser = (characterId: number) => {
    setAddingUsers(prev => ({ ...prev, [characterId]: false }));
    setSelectedUserIds(prev => ({ ...prev, [characterId]: 0 }));
    setPermissions(prev => ({ ...prev, [characterId]: false }));
  };

  const getAvailableUsers = (characterId: number) => {
    const currentCharacterUsers = characterUsers[characterId] || [];
    const currentUserIds = currentCharacterUsers.map(cu => cu.user.id);
    return groupUsers.filter(user => !currentUserIds.includes(user.id));
  };

  if (loading) return <div>Загрузка...</div>;

  return (
    <div className={styles.characterUsersTable}>
      <h3>Пользователи персонажей</h3>

      {error && <div className={styles.error}>{error}</div>}
      {success && <div className={styles.success}>{success}</div>}

      {/* Таблица персонажей с пользователями */}
      {Object.keys(characterUsers).length === 0 ? (
        <p>Нет персонажей с назначенными пользователями</p>
      ) : (
        <div className={styles.table}>
          {Object.entries(characterUsers).map(([characterId, users]) => {
            const character = characters.find(c => c.id === parseInt(characterId));
            const availableUsers = getAvailableUsers(parseInt(characterId));
            const isAdding = addingUsers[parseInt(characterId)];
            
            return (
              <div key={characterId} className={styles.tableRow}>
                <div className={styles.characterCell}>
                  <strong>{character?.name || `Персонаж #${characterId}`}</strong>
                </div>
                <div className={styles.usersCell}>
                  <UsersList
                    users={users.sort((a,b) => a.canWrite > b.canWrite ? -1 : 1).map(cu => ({ user: cu.user, permission: cu.canWrite }))}
                    onRemoveUser={(userId) => handleRemoveCharacterUser(parseInt(characterId), userId)}
                    formatPermission={(canWrite: boolean) => canWrite ? '(Игрок)' : '(Наблюдатель)'}
                    canManage={canManage}
                    emptyMessage="Нет пользователей"
                    layout='grid'
                  />
                </div>
                <div className={styles.actionsCell}>
                  {canManage && !isAdding && availableUsers.length > 0 && (
                    <button 
                      onClick={() => startAddUser(parseInt(characterId))}
                      className={buttonStyles.button}
                    >
                      Добавить игрока
                    </button>
                  )}
                  
                  {isAdding && (
                    <div className={styles.addForm}>
                      <select 
                        value={selectedUserIds[parseInt(characterId)] || 0}
                        onChange={(e) => setSelectedUserIds(prev => ({ 
                          ...prev, 
                          [parseInt(characterId)]: parseInt(e.target.value) 
                        }))}
                        className={styles.select}
                      >
                        <option value={0}>Выберите пользователя</option>
                        {availableUsers.map(user => (
                          <option key={user.id} value={user.id}>
                            {user.visibleName} (@{user.nickname})
                          </option>
                        ))}
                      </select>
                      
                      <select 
                        value={permissions[parseInt(characterId)] ? 'true' : 'false'}
                        onChange={(e) => setPermissions(prev => ({ 
                          ...prev, 
                          [parseInt(characterId)]: e.target.value === 'true' 
                        }))}
                        className={styles.select}
                      >
                        <option value="false">Наблюдатель</option>
                        <option value="true">Игрок</option>
                      </select>
                      
                      <div className={styles.formActions}>
                        <button 
                          onClick={() => handleAddCharacterUser(parseInt(characterId))}
                          className={buttonStyles.button}
                          disabled={!selectedUserIds[parseInt(characterId)]}
                        >
                          Добавить
                        </button>
                        <button 
                          onClick={() => cancelAddUser(parseInt(characterId))}
                          className={buttonStyles.button}
                        >
                          Отмена
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Добавление нового персонажа в таблицу */}
      {canManage && (
        <div className={styles.addNewCharacter}>
          <h4>Добавить нового персонажа в таблицу</h4>
          <select 
            onChange={(e) => {
              const characterId = parseInt(e.target.value);
              if (characterId && !characterUsers[characterId]) {
                setCharacterUsers(prev => ({
                  ...prev,
                  [characterId]: []
                }));
                e.target.value = '';
              }
            }}
            className={styles.select}
          >
            <option value="">Выберите персонажа для добавления</option>
            {characters
              .filter(char => !characterUsers[char.id])
              .map(char => (
                <option key={char.id} value={char.id}>
                  {char.name}
                </option>
              ))
            }
          </select>
        </div>
      )}
    </div>
  );
};

export default CharacterUsersTable;