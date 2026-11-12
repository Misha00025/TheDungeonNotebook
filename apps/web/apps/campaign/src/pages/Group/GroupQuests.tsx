import React, { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { GroupQuest } from '../../types/groupQuests';
import { groupQuestsAPI, charactersAPI } from '../../services/api';
import { User } from '../../types/groupUsers';
import { useGroupUsers } from '../../contexts/GroupUsersContext';
import { useActionPermissions } from '../../hooks/useActionPermissions';
import List from '@tdn/shared/ui/List/List';
import SearchBar from '@tdn/shared/ui/Search/SearchBar';
import QuestCard from './Cards/QuestCard/QuestCard';
import QuestViewModal from './Modals/QuestModal/QuestViewModal';
import { ThemeProvider } from '@tdn/shared/theme/ThemeContext';
import commonStyles from '@tdn/shared/styles/common.module.css';
import buttonStyles from '@tdn/shared/styles/components/Button.module.css';
import inputStyles from '@tdn/shared/styles/components/Input.module.css';
import modalStyles from '@tdn/shared/styles/modal.module.css';
import collapsibleStyles from '@tdn/shared/ui/CollapsibleGroup/CollapsibleGroup.module.css';
import ModalPortal from '@tdn/shared/ui/ModalPortal/ModalPortal';

const CollapsibleSection: React.FC<{
  title: string;
  count: number;
  defaultCollapsed: boolean;
  children: React.ReactNode;
}> = ({ title, count, defaultCollapsed, children }) => {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  return (
    <div>
      <div className={collapsibleStyles.header} onClick={() => setCollapsed(!collapsed)}>
        <span className={`${collapsibleStyles.caret} ${collapsed ? collapsibleStyles.caretCollapsed : ''}`}>▼</span>
        <span className={collapsibleStyles.groupName}>{title} ({count})</span>
      </div>
      {!collapsed && (
        <div className={collapsibleStyles.content}>
          {children}
        </div>
      )}
    </div>
  );
};

const GroupQuests: React.FC = () => {
  const { groupId } = useParams<{ groupId: string }>();
  const [quests, setQuests] = useState<GroupQuest[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewingQuest, setViewingQuest] = useState<GroupQuest | null>(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [characters, setCharacters] = useState<Array<{ id: number; name: string }>>([]);
  const { groupUsers, characterUsers, ensureCharacterUsers } = useGroupUsers();
  const { canCreateQuests, canEditQuests, canDeleteQuests } = useActionPermissions();

  const groupUsersMap = useMemo(() => new Map(groupUsers.map(gu => [gu.user.id, gu.user])), [groupUsers]);

  const allQuestCharIds = useMemo(() => Array.from(new Set(quests.flatMap(q => q.assignedCharacters))), [quests]);

  const charUserMap = useMemo(() => {
    const m = new Map<number, number[]>();
    allQuestCharIds.forEach(cid => {
      const users = characterUsers[cid];
      if (users) m.set(cid, users.map(u => u.user.id));
    });
    return m;
  }, [allQuestCharIds, characterUsers]);

  useEffect(() => {
    allQuestCharIds.forEach(ensureCharacterUsers);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allQuestCharIds]);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newQuestHeader, setNewQuestHeader] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (groupId) {
      loadQuests();
      loadCharacters();
    }
  }, [groupId]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadQuests = async () => {
    try {
      setLoading(true);
      const questsData = await groupQuestsAPI.getQuests(parseInt(groupId!));
      setQuests(questsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load quests');
    } finally {
      setLoading(false);
    }
  };

  const loadCharacters = async () => {
    try {
      const chars = await charactersAPI.getCharacters(parseInt(groupId!));
      setCharacters(chars.filter(c => c.name !== null).map(c => ({ id: c.id, name: c.name! })));
    } catch (err) {
      console.error('Failed to load characters for quest modal:', err);
    }
  };

  const getQuestUsers = (quest: GroupQuest): User[] => {
    const userIds = new Set<number>();
    quest.assignedCharacters.forEach(charId => {
      const userIdsForChar = charUserMap.get(charId) || [];
      userIdsForChar.forEach(uid => userIds.add(uid));
    });
    return Array.from(userIds)
      .map(uid => groupUsersMap.get(uid))
      .filter((u): u is User => u !== undefined);
  };

  const filteredQuests = quests.filter(quest => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase().trim();
    return (
      quest.header.toLowerCase().includes(term) ||
      quest.description.toLowerCase().includes(term) ||
      quest.reward.some(r => r.toLowerCase().includes(term))
    );
  });

  const handleView = (quest: GroupQuest) => {
    setViewingQuest(quest);
    setIsViewModalOpen(true);
  };

  const handleCreateQuest = async () => {
    if (!newQuestHeader.trim()) return;
    setCreating(true);
    try {
      await groupQuestsAPI.createQuest(parseInt(groupId!), {
        header: newQuestHeader.trim(),
        description: '',
        status: 'active',
        reward: [],
        objectives: [],
        assignedCharacters: [],
      });
      setCreateModalOpen(false);
      setNewQuestHeader('');
      loadQuests();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create quest');
    } finally {
      setCreating(false);
    }
  };

  if (loading) return <div className={commonStyles.container}>Загрузка...</div>;

  return (
    <ThemeProvider>
    <div className={commonStyles.container}>

      {error && <div style={{ color: 'var(--danger-color)', marginBottom: '1rem' }}>{error}</div>}

      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
        <div style={{ flex: 1 }}>
          <SearchBar
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            placeholder="Поиск по названию, описанию или награде..."
            onClear={() => setSearchTerm('')}
          />
        </div>
        {canCreateQuests && (
          <button className={buttonStyles.button} onClick={() => setCreateModalOpen(true)} type="button" style={{ whiteSpace: 'nowrap' }}>
            + Создать квест
          </button>
        )}
      </div>

      {(() => {
        const activeQuests = filteredQuests.filter(q => q.status === 'active');
        const completedQuests = filteredQuests.filter(q => q.status === 'completed');
        const failedQuests = filteredQuests.filter(q => q.status === 'failed');
        const cancelledQuests = filteredQuests.filter(q => q.status === 'cancelled');
        const hasAny = activeQuests.length > 0 || completedQuests.length > 0 || failedQuests.length > 0 || cancelledQuests.length > 0;

        if (!hasAny && !loading) {
          return (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
              <p>{searchTerm ? `По запросу "${searchTerm}" ничего не найдено` : 'Нет квестов'}</p>
              {searchTerm && (
                <button className={buttonStyles.button} onClick={() => setSearchTerm('')} type="button">
                  Очистить поиск
                </button>
              )}
            </div>
          );
        }

        return (
          <>
            {/* Active — всегда развёрнута */}
            <div>
              <div className={collapsibleStyles.header} style={{ cursor: 'default' }}>
                <span className={collapsibleStyles.caret}>▼</span>
                <span className={collapsibleStyles.groupName}>Активные ({activeQuests.length})</span>
              </div>
              <div className={collapsibleStyles.content}>
                <List layout="start-grid" gap="medium" gridSize="large">
                  {activeQuests.map(quest => (
                    <QuestCard
                      key={quest.id}
                      quest={quest}
                      users={getQuestUsers(quest)}
                      onView={() => handleView(quest)}
                    />
                  ))}
                </List>
              </div>
            </div>

            {completedQuests.length > 0 && (
              <CollapsibleSection title="Завершённые" count={completedQuests.length} defaultCollapsed={true}>
                <List layout="start-grid" gap="medium" gridSize="large">
                  {completedQuests.map(quest => (
                    <QuestCard
                      key={quest.id}
                      quest={quest}
                      users={getQuestUsers(quest)}
                      onView={() => handleView(quest)}
                    />
                  ))}
                </List>
              </CollapsibleSection>
            )}

            {failedQuests.length > 0 && (
              <CollapsibleSection title="Проваленные" count={failedQuests.length} defaultCollapsed={true}>
                <List layout="start-grid" gap="medium" gridSize="large">
                  {failedQuests.map(quest => (
                    <QuestCard
                      key={quest.id}
                      quest={quest}
                      users={getQuestUsers(quest)}
                      onView={() => handleView(quest)}
                    />
                  ))}
                </List>
              </CollapsibleSection>
            )}

            {cancelledQuests.length > 0 && (
              <CollapsibleSection title="Отменённые" count={cancelledQuests.length} defaultCollapsed={true}>
                <List layout="start-grid" gap="medium" gridSize="large">
                  {cancelledQuests.map(quest => (
                    <QuestCard
                      key={quest.id}
                      quest={quest}
                      users={getQuestUsers(quest)}
                      onView={() => handleView(quest)}
                    />
                  ))}
                </List>
              </CollapsibleSection>
            )}
          </>
        );
      })()}

      {isViewModalOpen && (
        <QuestViewModal
          quest={viewingQuest}
          isOpen={isViewModalOpen}
          onClose={() => {
            setIsViewModalOpen(false);
            setViewingQuest(null);
          }}
          onHeaderUpdate={async (questId, header) => {
            const quest = quests.find(q => q.id === questId);
            if (!quest) return;

            await groupQuestsAPI.patchQuest(parseInt(groupId!), questId, { header });

            const updatedQuest = { ...quest, header };
            setQuests(prev => prev.map(q => q.id === questId ? updatedQuest : q));
            setViewingQuest(updatedQuest);
          }}
          onQuestUpdate={async (questId, questData) => {
            const quest = quests.find(q => q.id === questId);
            if (!quest) return;

            await groupQuestsAPI.patchQuest(parseInt(groupId!), questId, questData);

            const updatedQuest = {
              ...quest,
              header: questData.header ?? quest.header,
              description: questData.description ?? quest.description,
              reward: questData.reward ?? quest.reward,
              status: questData.status ?? quest.status,
              objectives: questData.objectives ?? quest.objectives,
              assignedCharacters: questData.assignedCharacters ?? quest.assignedCharacters,
            };

            setQuests(prev => prev.map(q => q.id === questId ? updatedQuest : q));
            setViewingQuest(updatedQuest);
          }}
          onObjectiveUpdate={async (questId, objectiveKey, updates) => {
            const quest = quests.find(q => q.id === questId);
            if (!quest) return;

            const updatedObjectives = quest.objectives.map(obj =>
              obj.key === objectiveKey ? { ...obj, ...updates } : obj
            );

            await groupQuestsAPI.patchQuest(parseInt(groupId!), questId, {
              objectives: updatedObjectives,
            });

            const updatedQuest = { ...quest, objectives: updatedObjectives };
            setQuests(prev => prev.map(q => q.id === questId ? updatedQuest : q));
            setViewingQuest(updatedQuest);
          }}
          onDescriptionUpdate={async (questId, description) => {
            const quest = quests.find(q => q.id === questId);
            if (!quest) return;

            await groupQuestsAPI.patchQuest(parseInt(groupId!), questId, {
              description,
            });

            const updatedQuest = { ...quest, description };
            setQuests(prev => prev.map(q => q.id === questId ? updatedQuest : q));
            setViewingQuest(updatedQuest);
          }}
          onObjectiveAdd={async (questId) => {
            const quest = quests.find(q => q.id === questId);
            if (!quest) return;

            const newKey = `objective_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
            const newObjective = { key: newKey, description: '', status: 'pending' as const };
            const updatedObjectives = [...quest.objectives, newObjective];

            await groupQuestsAPI.patchQuest(parseInt(groupId!), questId, {
              objectives: updatedObjectives,
            });

            const updatedQuest = { ...quest, objectives: updatedObjectives };
            setQuests(prev => prev.map(q => q.id === questId ? updatedQuest : q));
            setViewingQuest(updatedQuest);

            return newKey;
          }}
          onObjectiveStatusChange={async (questId, objectiveKey, newStatus) => {
            const quest = quests.find(q => q.id === questId);
            if (!quest) return;

            const updatedObjectives = quest.objectives.map(obj =>
              obj.key === objectiveKey ? { ...obj, status: newStatus } : obj
            );

            await groupQuestsAPI.patchQuest(parseInt(groupId!), questId, {
              objectives: updatedObjectives,
            });

            // Обновляем состояние локально, без перезагрузки
            const updatedQuest = { ...quest, objectives: updatedObjectives };
            setQuests(prev => prev.map(q => q.id === questId ? updatedQuest : q));
            setViewingQuest(updatedQuest);
          }}
          onDelete={canDeleteQuests ? async () => {
            if (!viewingQuest) return;
            if (!window.confirm('Вы уверены, что хотите удалить этот квест?')) return;
            try {
              await groupQuestsAPI.deleteQuest(parseInt(groupId!), viewingQuest.id);
              setIsViewModalOpen(false);
              setViewingQuest(null);
              loadQuests();
            } catch (err) {
              setError(err instanceof Error ? err.message : 'Failed to delete quest');
            }
          } : undefined}
          canEdit={canEditQuests}
          canDelete={canDeleteQuests}
          characters={characters}
        />
      )}

      {createModalOpen && (
        <ModalPortal isOpen={createModalOpen} onClose={() => { setCreateModalOpen(false); setNewQuestHeader(''); }}>
          <h2 style={{ margin: 0 }}>Создание квеста</h2>
          <div className={modalStyles.modalBody} style={{ marginTop: '1rem' }}>
            <input
              type="text"
              value={newQuestHeader}
              onChange={e => setNewQuestHeader(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleCreateQuest(); }}
              className={inputStyles.input}
              placeholder="Название квеста"
              autoFocus
              style={{ width: '100%', boxSizing: 'border-box' }}
            />
          </div>
          <div className={modalStyles.buttons}>
            <button
              type="button"
              className={buttonStyles.button}
              onClick={() => { setCreateModalOpen(false); setNewQuestHeader(''); }}
            >
              Отмена
            </button>
            <button
              type="button"
              className={buttonStyles.button}
              onClick={handleCreateQuest}
              disabled={creating || !newQuestHeader.trim()}
            >
              {creating ? 'Создание...' : 'Создать'}
            </button>
          </div>
        </ModalPortal>
      )}
    </div>
    </ThemeProvider>
  );
};

export default GroupQuests;
