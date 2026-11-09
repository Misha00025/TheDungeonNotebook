import React, { useState, useEffect } from 'react';
import { useVisited } from '../contexts/VisitedContext';
import { groupAPI, charactersAPI } from '../services/api';
import { Group } from '../types/group';
import { Character } from '../types/characters';
import { useCampaignNavigate } from '../navigation';
import styles from '@tdn/shared/styles/common.module.css';
import buttonStyles from '@tdn/shared/styles/components/Button.module.css';
import dashStyles from './Dashboard.module.css';
import defaultAvatar from '../assets/default-avatar.png';

const Dashboard: React.FC = () => {
  const { lastVisitedGroupId, lastVisitedCharacters } = useVisited();
  const navigate = useCampaignNavigate();

  const [lastGroup, setLastGroup] = useState<Group | null | undefined>(undefined);
  const [lastCharactersData, setLastCharactersData] = useState<(Character | null)[] | undefined>(undefined);

  useEffect(() => {
    if (lastVisitedGroupId !== null) {
      groupAPI.getGroup(lastVisitedGroupId)
        .then(setLastGroup)
        .catch(() => setLastGroup(null));
    } else {
      setLastGroup(null);
    }
  }, [lastVisitedGroupId]);

  useEffect(() => {
    setLastCharactersData(undefined);
    if (lastVisitedCharacters.length === 0) {
      setLastCharactersData([]);
      return;
    }

    Promise.allSettled(
      lastVisitedCharacters.map(entry =>
        charactersAPI.getCharacter(entry.groupId, entry.characterId)
      )
    ).then(results => {
      const loaded = results.map(r => r.status === 'fulfilled' ? r.value : null);
      setLastCharactersData(loaded);
    });
  }, [lastVisitedCharacters]);

  const renderGroupBlock = () => {
    const header = (
      <div className={dashStyles.header}>
        <h2 className={dashStyles.headerTitle}>Последняя группа</h2>
        <p className={dashStyles.headerSubtitle}>Быстрый доступ к последней просмотренной группе</p>
      </div>
    );

    if (lastVisitedGroupId === null || lastGroup === null) {
      return (
        <div>
          {header}
          <div className={dashStyles.emptyCard}>
            <p className={dashStyles.emptyText}>Посетите группы, чтобы они отображались здесь</p>
            <button className={buttonStyles.button} onClick={() => navigate('/groups')}>
              Перейти к группам
            </button>
          </div>
        </div>
      );
    }

    if (lastGroup === undefined) {
      return (
        <div>
          {header}
          <p className={dashStyles.loading}>Загрузка...</p>
        </div>
      );
    }

    return (
      <div>
        {header}
        <div className={dashStyles.card} onClick={() => navigate(`/groups/${lastGroup.id}`)}>
          {lastGroup.icon ? (
            <img src={lastGroup.icon} alt="" className={dashStyles.avatar} onError={(e) => { e.currentTarget.src = defaultAvatar; }} />
          ) : (
            <div className={dashStyles.avatarPlaceholder}>G</div>
          )}
          <div className={dashStyles.info}>
            <h3 className={dashStyles.title}>{lastGroup.name}</h3>
          </div>
          <div className={dashStyles.action}>
            <button className={buttonStyles.button} onClick={(e) => { e.stopPropagation(); navigate(`/groups/${lastGroup.id}`); }}>
              →
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderCharacterBlock = () => {
    const header = (
      <div className={dashStyles.header}>
        <h2 className={dashStyles.headerTitle}>Последние персонажи</h2>
        <p className={dashStyles.headerSubtitle}>Быстрый доступ к последним просмотренным персонажам</p>
      </div>
    );

    if (lastVisitedCharacters.length === 0 || lastCharactersData?.every(c => c === null)) {
      return (
        <div>
          {header}
          <div className={dashStyles.emptyCard}>
            <p className={dashStyles.emptyText}>Посетите персонажа, чтобы они отображались здесь</p>
            <button className={buttonStyles.button} onClick={() => navigate('/groups')}>
              Перейти к группам
            </button>
          </div>
        </div>
      );
    }

    if (lastCharactersData === undefined) {
      return (
        <div>
          {header}
          <p className={dashStyles.loading}>Загрузка...</p>
        </div>
      );
    }

    return (
      <div>
        {header}
        <div className={dashStyles.list}>
          {lastCharactersData.map((character, index) => {
            if (!character) return null;
            return (
              <div
                key={character.id}
                className={dashStyles.card}
                onClick={() => navigate(`/groups/${lastVisitedCharacters[index]?.groupId}/character/${character.id}`)}
              >
                <div className={dashStyles.avatarPlaceholder}>C</div>
                <div className={dashStyles.info}>
                  <h3 className={dashStyles.title}>{character.name}</h3>
                  <p className={dashStyles.subtitle}>{character.group?.name}</p>
                </div>
                <div className={dashStyles.action}>
                  <button
                    className={buttonStyles.button}
                    onClick={(e) => { e.stopPropagation(); navigate(`/groups/${lastVisitedCharacters[index]?.groupId}/character/${character.id}`); }}
                  >
                    →
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className={styles.container}>
      <div className={dashStyles.grid}>
        {renderGroupBlock()}
        {renderCharacterBlock()}
      </div>
    </div>
  );
};

export default Dashboard;
