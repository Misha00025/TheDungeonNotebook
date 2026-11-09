import React from 'react';
import { GroupQuest } from '../../../../types/groupQuests';
import { User } from '../../../../types/groupUsers';
import cardStyles from '@tdn/shared/styles/card-item.module.css';
import styles from './QuestCard.module.css';
import defaultAvatar from '../../../../assets/default-avatar.png';

interface QuestCardProps {
  quest: GroupQuest;
  onView?: () => void;
  users?: User[];
}

const statusColors: Record<GroupQuest['status'], { bg: string; text: string }> = {
  active: { bg: '#27ae60', text: '#fff' },
  completed: { bg: '#2980b9', text: '#fff' },
  failed: { bg: '#e74c3c', text: '#fff' },
  cancelled: { bg: '#7f8c8d', text: '#fff' },
};

const statusLabels: Record<GroupQuest['status'], string> = {
  active: 'Активен',
  completed: 'Завершён',
  failed: 'Провален',
  cancelled: 'Отменён',
};

const QuestCard: React.FC<QuestCardProps> = ({
  quest,
  onView,
  users,
}) => {
  const statusColor = statusColors[quest.status];
  const relevantObjectives = quest.objectives?.filter(o => o.status !== 'cancelled') || [];
  const totalRelevant = relevantObjectives.length;
  const completedObjectives = relevantObjectives.filter(o => o.status === 'completed').length;
  const failedObjectives = relevantObjectives.filter(o => o.status === 'failed').length;
  const rewardPreview = quest.reward?.slice(0, 2) || [];

  return (
    <div
      id={`quest-${quest.id}`}
      className={cardStyles.card}
      onClick={onView}
      style={{ cursor: 'pointer' }}
    >
      <div className={cardStyles.header} style={{ borderBottom: 'none' }}>
        <div className={cardStyles.titleSection}>
          <h3 className={cardStyles.name} title={quest.header}>
            {quest.header}
          </h3>
          <span
            className={styles.statusBadge}
            style={{ backgroundColor: statusColor.bg, color: statusColor.text }}
          >
            {statusLabels[quest.status]}
          </span>
        </div>
      </div>

      {/* Прогресс-бар */}
      {totalRelevant > 0 && (
        <div className={styles.progressSection}>
          <div className={styles.progressBar}>
            <div
              className={styles.progressFillCompleted}
              style={{ width: `${(completedObjectives / totalRelevant) * 100}%` }}
            />
            {failedObjectives > 0 && (
              <div
                className={styles.progressFillFailed}
                style={{
                  width: `${(failedObjectives / totalRelevant) * 100}%`,
                  left: `${(completedObjectives / totalRelevant) * 100}%`,
                }}
              />
            )}
          </div>
          <span className={styles.progressText}>
            {completedObjectives}/{totalRelevant}
            {failedObjectives > 0 && (
              <span className={styles.failedMarker} title={`${failedObjectives} провалено`}> 💀{failedObjectives}</span>
            )}
          </span>
        </div>
      )}

      {/* Аватарки игроков */}
      {users && users.length > 0 && (
        <div className={styles.assignedAvatars}>
          {(users.length > 3 ? users.slice(0, 2) : users).map(user => (
            <div key={user.id} className={styles.avatarCircle} title={user.visibleName || user.nickname}>
              {user.imageLink ? (
                <img src={user.imageLink} alt={user.nickname} className={styles.avatarImage} onError={(e) => { e.currentTarget.src = defaultAvatar; }} />
              ) : (
                (user.visibleName || user.nickname).charAt(0).toUpperCase()
              )}
            </div>
          ))}
          {users.length > 3 && (
            <div className={styles.avatarCircle} title={`Ещё ${users.length - 2}`}>
              +{users.length - 2}
            </div>
          )}
        </div>
      )}

      {/* Превью награды */}
      {rewardPreview.length > 0 && (
        <div className={styles.rewardPreview}>
          {rewardPreview.map((item, idx) => (
            <span key={idx} className={styles.rewardTag}>{item}</span>
          ))}
          {quest.reward.length > 2 && <span className={styles.rewardTag}>+{quest.reward.length - 2}</span>}
        </div>
      )}
    </div>
  );
};

export default QuestCard;
