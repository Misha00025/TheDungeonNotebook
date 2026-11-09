import React from 'react';
import { User } from '../../types/groupUsers';
import stylesUi from '@tdn/shared/styles/ui.module.css';
import IconButton from '@tdn/shared/ui/Buttons/IconButton/IconButton';
import List from '@tdn/shared/ui/List/List';
import defaultAvatar from '../../assets/default-avatar.png';

interface UsersListProps {
  users: {
    user: User;
    permission: any;
  }[];
  onRemoveUser: (userId: number) => void;
  formatPermission: (permission: any) => string;
  canManage: boolean;
  emptyMessage: string;
  layout?: 'vertical' | 'grid'
}

const UsersList: React.FC<UsersListProps> = ({
  users,
  onRemoveUser,
  formatPermission,
  canManage,
  emptyMessage,
  layout = 'vertical'
}) => {
  if (users.length === 0) {
    return <p>{emptyMessage}</p>;
  }

  return (
    <List layout={layout}>
      {users.map(item => (
        <div key={item.user.id} className={stylesUi.userCard}>
          <img src={item.user.imageLink || defaultAvatar} alt={item.user.nickname} className={stylesUi.avatar} onError={(e) => { e.currentTarget.src = defaultAvatar; }} />
          <div className={stylesUi.userInfo}>
            <h4>{item.user.visibleName}</h4>
            <p>@{item.user.nickname} {formatPermission(item.permission)}</p>
          </div>
          {canManage && (
            <div className={stylesUi.actionsTop}>
              <IconButton 
                icon='delete'
                title='Удалить'
                onClick={() => onRemoveUser(item.user.id)}
                variant='danger'
              />
            </div>
          )}
        </div>
      ))}
    </List>
  );
};

export default UsersList;