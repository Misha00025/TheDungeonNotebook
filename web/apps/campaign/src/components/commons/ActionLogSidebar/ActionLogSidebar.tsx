import React, { useState, useEffect, useCallback, useRef } from 'react';
import { charactersAPI, characterItemsAPI, characterSkillsAPI, characterLogAPI, groupUsersAPI, groupItemsAPI } from '../../../services/api';
import { ActionLogEntry, ActionLogResponse } from '../../../types/actionLog';
import { GroupUser } from '../../../types/groupUsers';
import styles from './ActionLogSidebar.module.css';

interface ActionLogSidebarProps {
  groupId: number;
  characterId: number;
}

const PAGE_SIZE = 50;

const ACTION_LABELS: Record<string, { label: string; icon: string }> = {
  AddField: { label: 'Поле', icon: '📝' },
  UpdateField: { label: 'Поле', icon: '📝' },
  DeleteField: { label: 'Поле', icon: '📝' },
  EquipItem: { label: 'Экипировка', icon: '🛡️' },
  UnequipItem: { label: 'Экипировка', icon: '🛡️' },
  UpdateItem: { label: 'Предмет', icon: '🎒' },
};

function formatTimestamp(ts: string): string {
  const d = new Date(ts);
  return d.toLocaleString('ru-RU', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function getDeltaDisplay(delta: number): { text: string; className: string } {
  if (delta > 0) return { text: `▲ +${delta}`, className: 'deltaPositive' };
  if (delta < 0) return { text: `▼ ${delta}`, className: 'deltaNegative' };
  return { text: '0', className: 'deltaZero' };
}

function getDetailsText(
  entry: ActionLogEntry,
  fieldNames: Map<string, string>,
  itemNames: Map<number, string>,
  _skillNames: Map<number, string>
): string {
  const { details } = entry;
  const oldValue = details.oldValue ?? 0;
  const delta = details.delta ?? 0;
  const newValue = oldValue + delta;

  let displayKey: string;
  if (entry.actionType === 'AddField' || entry.actionType === 'UpdateField' || entry.actionType === 'DeleteField') {
    displayKey = fieldNames.get(details!.key!) || details!.key!;
  } else if (entry.actionType === 'EquipItem' || entry.actionType === 'UnequipItem' || entry.actionType === 'UpdateItem') {
    displayKey = itemNames.get(Number(details!.itemId!)) || `#${details!.itemId}`;
  } else {
    displayKey = details.key || '';
  }

  return `${displayKey}: ${oldValue} → ${newValue}`;
}

const ActionLogSidebar: React.FC<ActionLogSidebarProps> = ({ groupId, characterId }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [entries, setEntries] = useState<ActionLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usersMap, setUsersMap] = useState<Map<number, string>>(new Map());
  const [fieldNames, setFieldNames] = useState<Map<string, string>>(new Map());
  const [itemNames, setItemNames] = useState<Map<number, string>>(new Map());
  const [skillNames, setSkillNames] = useState<Map<number, string>>(new Map());
  const lastCharIdRef = useRef<number | null>(null);
  const currentOffsetRef = useRef(0);

  const fetchLog = useCallback(async (append: boolean = false) => {
    try {
      setLoading(true);
      setError(null);
      const offset = append ? currentOffsetRef.current : 0;
      const data: ActionLogResponse = await characterLogAPI.getLog(groupId, characterId, {
        limit: PAGE_SIZE,
        offset,
      });
      if (append) {
        setEntries(prev => [...prev, ...data.entries]);
      } else {
        setEntries(data.entries);
      }
      currentOffsetRef.current = offset + data.entries.length;
      setTotal(data.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки');
    } finally {
      setLoading(false);
    }
  }, [groupId, characterId]);

  const toggle = useCallback(() => {
    setIsOpen(prev => !prev);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
  }, []);

  // Fetch group users to map actorId -> visibleName
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const groupUsers: GroupUser[] = await groupUsersAPI.getGroupUsers(groupId);
        const map = new Map<number, string>();
        groupUsers.forEach(gu => map.set(gu.user.id, gu.user.visibleName));
        setUsersMap(map);
      } catch {
        // Silently fail — fall back to showing "#ID"
      }
    };
    fetchUsers();
  }, [groupId]);

  // Fetch character data to build name maps
  useEffect(() => {
    const fetchNames = async () => {
      try {
        const [charData, itemsData, skillsData, groupItems] = await Promise.all([
          charactersAPI.getCharacter(groupId, characterId),
          characterItemsAPI.getCharacterItems(groupId, characterId),
          characterSkillsAPI.getCharacterSkills(groupId, characterId),
          groupItemsAPI.getItems(groupId),
        ]);
        const fMap = new Map<string, string>();
        Object.entries(charData.fields || {}).forEach(([key, field]: [string, any]) => {
          fMap.set(key, field.name || key);
        });
        setFieldNames(fMap);
        const iMap = new Map<number, string>();
        groupItems.forEach((item: any) => iMap.set(item.id, item.name));
        itemsData.forEach((item: any) => iMap.set(item.id, item.name));
        setItemNames(iMap);
        const sMap = new Map<number, string>();
        skillsData.forEach((skill: any) => sMap.set(skill.id, skill.name));
        setSkillNames(sMap);
      } catch {
        // silent
      }
    };
    fetchNames();
  }, [groupId, characterId]);

  useEffect(() => {
    if (isOpen) {
      if (lastCharIdRef.current !== characterId) {
        setEntries([]);
        setTotal(0);
        currentOffsetRef.current = 0;
        lastCharIdRef.current = characterId;
      }
      fetchLog(false);
    }
  }, [isOpen, characterId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleLoadMore = () => {
    fetchLog(true);
  };

  const hasMore = entries.length < total;

  return (
    <div className={styles.container}>
      <button
        className={`${styles.toggleTab} ${isOpen ? styles.toggleTabActive : ''}`}
        onClick={toggle}
        title="Журнал действий"
      >
        📋
      </button>

      {isOpen && <div className={styles.overlay} onClick={close} />}

      <div className={`${styles.panel} ${isOpen ? styles.panelOpen : styles.panelClosed}`}>
        <div className={styles.panelInner}>
          <div className={styles.header}>
            <h3 className={styles.title}>Журнал действий</h3>
            <button className={styles.closeBtn} onClick={close}>✕</button>
          </div>

          <div className={styles.body}>
            {loading && entries.length === 0 && (
              <div className={styles.centerMessage}>Загрузка...</div>
            )}

            {error && !loading && entries.length === 0 && (
              <div className={styles.centerMessage}>{error}</div>
            )}

            {!loading && !error && entries.length === 0 && (
              <div className={styles.centerMessage}>
                <p>Нет записей</p>
                <p className={styles.subtle}>Изменения персонажа будут отображаться здесь.</p>
              </div>
            )}

            {entries.length > 0 && (
              <>
                <div className={styles.entryList}>
                  {entries.map((entry, idx) => {
                    const meta = ACTION_LABELS[entry.actionType] || { label: entry.actionType, icon: '❓' };
                    const deltaClass = (entry.details.delta ?? 0) > 0
                      ? styles.entryPositive
                      : (entry.details.delta ?? 0) < 0
                      ? styles.entryNegative
                      : '';
                    const deltaDisplay = getDeltaDisplay(entry.details.delta ?? 0);

                    return (
                      <div key={`${entry.timestamp}-${idx}`} className={`${styles.entry} ${deltaClass}`}>
                        <div className={styles.entryLine1}>
                          <span className={styles.entryLeft}>
                            <span className={styles.entryIcon}>{meta.icon}</span>
                            <span className={styles.entryType}>{meta.label}</span>
                            <span className={styles.entrySep}>·</span>
                            <span className={styles.entryActor}>
                              {usersMap.get(entry.actorId) || `#${entry.actorId}`}
                            </span>
                          </span>
                          <span className={`${styles.entryDelta} ${styles[deltaDisplay.className]}`}>
                            {deltaDisplay.text}
                          </span>
                        </div>
                        <div className={styles.entryLine2}>
                          <span className={styles.entryDetails}>{getDetailsText(entry, fieldNames, itemNames, skillNames)}</span>
                        </div>
                        <div className={styles.entryTimestamp}>{formatTimestamp(entry.timestamp)}</div>
                      </div>
                    );
                  })}
                </div>

                {hasMore && (
                  <div className={styles.loadMoreWrap}>
                    <button
                      className={styles.loadMoreBtn}
                      onClick={handleLoadMore}
                      disabled={loading}
                    >
                      {loading ? 'Загрузка...' : `Загрузить ещё (${entries.length} из ${total})`}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ActionLogSidebar;
