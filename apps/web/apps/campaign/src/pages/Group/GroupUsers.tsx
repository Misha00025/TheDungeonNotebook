// GroupUsers.tsx
import React, { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { groupUsersAPI } from '../../services/api';
import { useGroupUsers } from '../../contexts/GroupUsersContext';
import styles from '@tdn/shared/styles/common.module.css';
import { useActionPermissions } from '../../hooks/useActionPermissions';
import UserSearch from '../../components/UsersManagement/UserSearch';
import UsersList from '../../components/UsersManagement/UsersList';
import { useUserManagement } from '../../hooks/useUserManagement';
import CharacterUsersTable from '../../components/UsersManagement/CharacterUsersTable';

const GroupUsers: React.FC = () => {
  const { groupId } = useParams<{ groupId: string }>();
  const { groupUsers, ensureGroupUsers, refreshGroupUsers } = useGroupUsers();
  const { canManageGroupUsers } = useActionPermissions();
  const { loading, error, success, executeOperation } = useUserManagement();

  useEffect(() => {
    if (groupId) {
      ensureGroupUsers();
    }
  }, [groupId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleAddUser = async (user: import('../../types/groupUsers').User, isAdmin: boolean) => {
    await executeOperation(
      () => groupUsersAPI.addUserToGroup(parseInt(groupId!), user.id, isAdmin),
      `Пользователь ${user.nickname} успешно добавлен в группу`
    );
    await refreshGroupUsers();
  };

  const handleRemoveUser = async (userId: number) => {
    await executeOperation(
      () => groupUsersAPI.removeUserFromGroup(parseInt(groupId!), userId),
      `Пользователь успешно удален из группы`
    );
    await refreshGroupUsers();
  };

  if (loading) return <div className={styles.container}>Загрузка...</div>;

  return (
    <div className={styles.container}>
      <h1>Управление пользователями группы</h1>

      {error && <div className={styles.error}>{error}</div>}
      {success && <div className={styles.success}>{success}</div>}

      {canManageGroupUsers && (
        <UserSearch
          onSearch={groupUsersAPI.searchUsers}
          onAddUser={handleAddUser}
          permissionOptions={[
            { label: 'Пользователь', value: false },
            { label: 'Администратор', value: true }
          ]}
          title="Добавить пользователя"
        />
      )}

      <div className={styles.section}>
        <h2>Пользователи группы</h2>
        <UsersList
          users={groupUsers.map(gu => ({ user: gu.user, permission: gu.isAdmin }))}
          onRemoveUser={handleRemoveUser}
          formatPermission={(isAdmin) => isAdmin ? '(Администратор)' : ''}
          canManage={canManageGroupUsers}
          emptyMessage="В группе пока нет пользователей"
        />
      </div>

      {/* Секция управления пользователями персонажей (только для админов) */}
      {canManageGroupUsers && groupId && (
        <div className={styles.section}>
          <CharacterUsersTable 
            groupId={parseInt(groupId)} 
            canManage={canManageGroupUsers}
            groupUsers={groupUsers.map(gu => gu.user)}
          />
        </div>
      )}
    </div>
  );
};

export default GroupUsers;