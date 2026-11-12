// GroupCard.tsx
import React from 'react';
import { Group } from '../../types/group';
import buttonStyles from '@tdn/shared/styles/components/Button.module.css';
import styles from './GroupCard.module.css';
import defaultAvatar from '../../assets/default-avatar.png';

interface GroupCardProps {
  group: Group;
  onSelect: (group: Group) => void;
  showAction?: boolean;
  actionLabel?: string;
}

const GroupCard: React.FC<GroupCardProps> = ({
  group,
  onSelect,
  showAction = true,
  actionLabel = 'Выбрать'
}) => {
  return (
    <div className={styles.groupCard}>
      <div className={styles.avatarSection}>
        {group.icon ? (
          <img 
            src={group.icon} 
            alt={group.name} 
            className={styles.avatar}
            onError={(e) => { e.currentTarget.src = defaultAvatar; }}
          />
        ) : (
          <div className={styles.avatarPlaceholder}>
            Нет иконки
          </div>
        )}
      </div>
      
      <div className={styles.info}>
        <h3 className={styles.groupName}>{group.name}</h3>
        <div className={styles.groupId}>ID: {group.id}</div>
      </div>

      {showAction && (
        <div className={styles.footer}>
          <button 
            className={buttonStyles.button}
            onClick={() => onSelect(group)}
          >
            {actionLabel}
          </button>
        </div>
      )}
    </div>
  );
};

export default GroupCard;