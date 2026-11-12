import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { GroupQuest } from '../../../types/groupQuests';
import { groupQuestsAPI, characterQuestsAPI } from '../../../services/api';
import { useCharacter } from '../../../contexts/CharacterContext';
import { useActionPermissions } from '../../../hooks/useActionPermissions';
import List from '@tdn/shared/ui/List/List';
import SearchBar from '@tdn/shared/ui/Search/SearchBar';
import QuestCard from '../Cards/QuestCard/QuestCard';
import QuestViewModal from '../Modals/QuestModal/QuestViewModal';
import { ThemeProvider } from '@tdn/shared/theme/ThemeContext';
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

const CharacterQuests: React.FC = () => {
  const { groupId, characterId } = useParams<{ groupId: string; characterId: string }>();
  const { quests, setQuests, refreshQuests, questsLoading } = useCharacter();
  const [error, setError] = useState<string | null>(null);
  const [viewingQuest, setViewingQuest] = useState<GroupQuest | null>(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const { canCreateCharacterQuests, canEditCharacterQuests, canDeleteCharacterQuests } = useActionPermissions();
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newQuestHeader, setNewQuestHeader] = useState('');
  const [creating, setCreating] = useState(false);

  const localRefreshQuests = async () => {
    try {
      const fresh = await characterQuestsAPI.getCharacterQuests(parseInt(groupId!), parseInt(characterId!));
      setQuests(fresh);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refresh quests');
    }
  };

  useEffect(() => {
    refreshQuests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      await characterQuestsAPI.createCharacterQuest(parseInt(groupId!), parseInt(characterId!), {
        header: newQuestHeader.trim(),
        description: '',
        status: 'active',
        reward: [],
        objectives: [],
      });
      setCreateModalOpen(false);
      setNewQuestHeader('');
      await localRefreshQuests();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create quest');
    } finally {
      setCreating(false);
    }
  };

  if (questsLoading) {
    return <div>Загрузка...</div>;
  }

  return (
    <ThemeProvider>
    <div>

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
        {canCreateCharacterQuests && (
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

        if (!hasAny) {
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

            const updatedQuest = {
              ...quest,
              header: questData.header ?? quest.header,
              description: questData.description ?? quest.description,
              reward: questData.reward ?? quest.reward,
              status: questData.status ?? quest.status,
              objectives: questData.objectives ?? quest.objectives,
              assignedCharacters: questData.assignedCharacters ?? quest.assignedCharacters,
            };

            await groupQuestsAPI.patchQuest(parseInt(groupId!), questId, questData);

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

            const updatedQuest = { ...quest, objectives: updatedObjectives };
            setQuests(prev => prev.map(q => q.id === questId ? updatedQuest : q));
            setViewingQuest(updatedQuest);
          }}
          onDelete={canDeleteCharacterQuests ? async () => {
            if (!viewingQuest) return;
            if (!window.confirm('Вы уверены, что хотите удалить этот квест?')) return;
            try {
              await groupQuestsAPI.deleteQuest(parseInt(groupId!), viewingQuest.id);
              setIsViewModalOpen(false);
              setViewingQuest(null);
              await localRefreshQuests();
            } catch (err) {
              setError(err instanceof Error ? err.message : 'Failed to delete quest');
            }
          } : undefined}
          canEdit={canEditCharacterQuests}
          canDelete={canDeleteCharacterQuests}
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

export default CharacterQuests;
