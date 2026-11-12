import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import buttonStyles from '@tdn/shared/styles/components/Button.module.css';
import inputStyles from '@tdn/shared/styles/components/Input.module.css';
import modalStyles from '@tdn/shared/styles/modal.module.css';
import ModalPortal from '@tdn/shared/ui/ModalPortal/ModalPortal';
import MDEditor from '@uiw/react-md-editor';
import { useTheme, getEditorColorMode } from '@tdn/shared/theme/ThemeContext';
import { usePlatform } from '../../../../hooks/usePlatform';
import type {
  QuestStatus,
  ObjectiveStatus,
  QuestObjective,
  GroupQuest,
  PatchGroupQuestRequest,
} from '../../../../types/groupQuests';
import viewStyles from './QuestViewModal.module.css';
import IconButton from '@tdn/shared/ui/Buttons/IconButton/IconButton';

interface QuestViewModalProps {
  quest: GroupQuest | null;
  isOpen: boolean;
  onClose: () => void;
  onObjectiveStatusChange: (questId: number, objectiveKey: string, status: ObjectiveStatus) => Promise<void>;
  onObjectiveUpdate?: (questId: number, objectiveKey: string, updates: Partial<QuestObjective>) => Promise<void>;
  onObjectiveAdd?: (questId: number) => Promise<string | undefined>;
  onDescriptionUpdate?: (questId: number, description: string) => Promise<void>;
  onHeaderUpdate?: (questId: number, header: string) => Promise<void>;
  onQuestUpdate?: (questId: number, questData: PatchGroupQuestRequest) => Promise<void>;
  onDelete?: () => void;
  canEdit?: boolean;
  canDelete?: boolean;
  characters?: Array<{ id: number; name: string }>;
}

const OBJECTIVE_STATUS_OPTIONS: { value: ObjectiveStatus; label: string }[] = [
  { value: 'pending', label: 'В процессе' },
  { value: 'completed', label: 'Выполнена' },
  { value: 'failed', label: 'Провалена' },
  { value: 'cancelled', label: 'Отменена' },
];

const STATUS_LABEL_MAP: Record<QuestStatus, string> = {
  active: 'Активен',
  completed: 'Завершён',
  failed: 'Провален',
  cancelled: 'Отменён',
};

const STATUS_COLOR_MAP: Record<QuestStatus, string> = {
  active: '#4caf50',
  completed: '#2196f3',
  failed: '#f44336',
  cancelled: '#9e9e9e',
};

const STATUS_OPTIONS: { value: QuestStatus; label: string }[] = Object.entries(STATUS_LABEL_MAP).map(([value, label]) => ({
  value: value as QuestStatus,
  label,
}));

const QuestViewModal: React.FC<QuestViewModalProps> = ({
  quest,
  isOpen,
  onClose,
  onObjectiveStatusChange,
  onObjectiveUpdate,
  onObjectiveAdd,
  onDescriptionUpdate,
  onHeaderUpdate,
  onQuestUpdate,
  onDelete,
  canEdit = false,
  canDelete = false,
  characters,
}) => {
  const { themeConfig } = useTheme();
  const isMobile = usePlatform();

  // Header editing
  const [editingHeader, setEditingHeader] = useState(false);
  const [editingHeaderValue, setEditingHeaderValue] = useState('');
  const headerInputRef = useRef<HTMLInputElement>(null);

  // Objective editing
  const [editingObjectiveKey, setEditingObjectiveKey] = useState<string | null>(null);
  const [editingObjectiveValue, setEditingObjectiveValue] = useState('');
  const editInputRef = useRef<HTMLInputElement>(null);

  // Description editing
  const [editingDescription, setEditingDescription] = useState(false);
  const [editingDescriptionValue, setEditingDescriptionValue] = useState('');

  // Description collapse
  const [completedExpanded, setCompletedExpanded] = useState(false);
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);
  const descriptionRef = useRef<HTMLDivElement>(null);
  const [descriptionOverflow, setDescriptionOverflow] = useState(false);
  const editorRef = useRef<HTMLDivElement>(null);
  const [charactersModalOpen, setCharactersModalOpen] = useState(false);

  useEffect(() => {
    setEditingHeader(false);
    setEditingObjectiveKey(null);
    setEditingDescription(false);
    setCompletedExpanded(false);
    setDescriptionExpanded(false);
  }, [isOpen, quest]);

  useEffect(() => {
    if (editingHeader && headerInputRef.current) {
      headerInputRef.current.focus();
      headerInputRef.current.select();
    }
  }, [editingHeader]);

  useEffect(() => {
    if (editingObjectiveKey && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingObjectiveKey]);

  useEffect(() => {
    if (descriptionRef.current && !descriptionExpanded) {
      const el = descriptionRef.current;
      setDescriptionOverflow(el.scrollHeight > el.clientHeight + 2);
    }
  }, [quest?.description, descriptionExpanded]);

  const themeMode = getEditorColorMode(themeConfig);

  // Header handlers
  const handleStartEditHeader = () => {
    if (!quest) return;
    setEditingHeaderValue(quest.header);
    setEditingHeader(true);
  };

  const handleFinishEditHeader = () => {
    if (editingHeader && quest && onHeaderUpdate && editingHeaderValue !== quest.header) {
      onHeaderUpdate(quest.id, editingHeaderValue);
    }
    setEditingHeader(false);
  };

  // Objective handlers
  const handleStartEditObjective = (key: string, description: string) => {
    setEditingObjectiveKey(key);
    setEditingObjectiveValue(description);
  };

  const handleFinishEditObjective = () => {
    if (editingObjectiveKey && onObjectiveUpdate && quest) {
      const objective = quest.objectives.find(o => o.key === editingObjectiveKey);
      if (objective && editingObjectiveValue !== objective.description) {
        onObjectiveUpdate(quest.id, editingObjectiveKey, { description: editingObjectiveValue });
      }
    }
    setEditingObjectiveKey(null);
    setEditingObjectiveValue('');
  };

  // Description handlers
  const handleStartEditDescription = () => {
    if (!quest) return;
    setEditingDescriptionValue(quest.description);
    setEditingDescription(true);
  };

  const handleSaveDescription = async () => {
    if (quest && editingDescriptionValue !== quest.description) {
      await onDescriptionUpdate?.(quest.id, editingDescriptionValue);
    }
    setEditingDescription(false);
  };

  const handleCancelDescription = () => {
    setEditingDescription(false);
  };

  // Characters handlers
  const handleToggleCharacter = async (charId: number) => {
    if (!quest || !onQuestUpdate) return;
    const newAssigned = quest.assignedCharacters.includes(charId)
      ? quest.assignedCharacters.filter(id => id !== charId)
      : [...quest.assignedCharacters, charId];
    await onQuestUpdate(quest.id, {
      header: quest.header,
      description: quest.description,
      reward: quest.reward,
      status: quest.status,
      objectives: quest.objectives,
      assignedCharacters: newAssigned,
    });
  };

  const renderObjective = (obj: QuestObjective) => (
    <div
      key={obj.key}
      className={`${viewStyles.objectiveRow} ${
        viewStyles[`objectiveStatus_${obj.status}`] || ''
      } ${obj.status !== 'pending' ? viewStyles.objectiveCompact : ''} ${
        obj.status === 'cancelled' ? viewStyles.objectiveCancelled : ''
      }`}
    >
      {editingObjectiveKey === obj.key ? (
        <input
          ref={editInputRef}
          type="text"
          value={editingObjectiveValue}
          onChange={e => setEditingObjectiveValue(e.target.value)}
          onBlur={handleFinishEditObjective}
          onKeyDown={e => {
            if (e.key === 'Enter') { e.preventDefault(); handleFinishEditObjective(); }
            if (e.key === 'Escape') { setEditingObjectiveKey(null); }
          }}
          className={inputStyles.input}
          style={{ flex: 1 }}
          onClick={e => e.stopPropagation()}
        />
      ) : (
        <span
          className={`${viewStyles.objectiveText} ${!obj.description ? viewStyles.objectivePlaceholder : ''}`}
          onClick={() => handleStartEditObjective(obj.key, obj.description)}
          style={{ cursor: 'pointer' }}
          title="Нажмите чтобы изменить"
        >
          {obj.description || 'Введите описание цели...'}
        </span>
      )}
      <select
        value={obj.status}
        onChange={e => onObjectiveStatusChange(quest!.id, obj.key, e.target.value as any)}
        className={`${inputStyles.input} ${viewStyles.objectiveSelect}`}
      >
        {OBJECTIVE_STATUS_OPTIONS.map(opt => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );

  if (!quest) {
    return (
      <ModalPortal isOpen={isOpen} onClose={onClose}>
        <p>Загрузка квеста...</p>
      </ModalPortal>
    );
  }

  const sortedObjectives = [...quest.objectives].sort((a, b) => {
    const order: Record<string, number> = { pending: 0, completed: 1, failed: 2, cancelled: 3 };
    return (order[a.status] ?? 99) - (order[b.status] ?? 99);
  });

  const activeObjectives = sortedObjectives.filter(o => o.status === 'pending');
  const completedObjectivesList = sortedObjectives.filter(o => o.status !== 'pending');

  return (
    <ModalPortal isOpen={isOpen} onClose={onClose}>
      <div className={viewStyles.viewHeader}>
        {editingHeader ? (
          <input
            ref={headerInputRef}
            type="text"
            value={editingHeaderValue}
            onChange={e => setEditingHeaderValue(e.target.value)}
            onBlur={handleFinishEditHeader}
            onKeyDown={e => {
              if (e.key === 'Enter') { e.preventDefault(); handleFinishEditHeader(); }
              if (e.key === 'Escape') { setEditingHeader(false); }
            }}
            className={inputStyles.input}
            style={{ flex: 1, fontSize: '1.25rem', fontWeight: 700 }}
          />
        ) : (
          <h2
            style={{ margin: 0, cursor: canEdit ? 'pointer' : 'default' }}
            onClick={() => canEdit && handleStartEditHeader()}
            title={canEdit ? 'Нажмите чтобы изменить' : undefined}
          >
            {quest.header}
          </h2>
        )}
        {canEdit ? (
          <select
            value={quest.status}
            onChange={e => {
              if (!quest || !onQuestUpdate) return;
              const newStatus = e.target.value;
              if (newStatus === quest.status) return;
              onQuestUpdate(quest.id, {
                header: quest.header,
                description: quest.description,
                reward: quest.reward,
                status: newStatus as QuestStatus,
                objectives: quest.objectives,
                assignedCharacters: quest.assignedCharacters,
              });
            }}
            className={inputStyles.input}
            style={{ width: 'auto', padding: '0.25rem 0.5rem', fontSize: '0.85rem' }}
          >
            {STATUS_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        ) : (
          <span
            className={viewStyles.viewStatusBadge}
            style={{
              backgroundColor: STATUS_COLOR_MAP[quest.status],
              color: '#fff',
            }}
          >
            {STATUS_LABEL_MAP[quest.status]}
          </span>
        )}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.25rem' }}>
          {canEdit && characters && (
            <IconButton icon="people" onClick={() => setCharactersModalOpen(true)} title="Персонажи" size="small" variant="primary" />
          )}
          {canDelete && onDelete && (
            <IconButton icon="delete" onClick={() => {
              if (window.confirm('Вы уверены, что хотите удалить квест?')) {
                onDelete?.();
              }
            }} title="Удалить" size="small" variant="danger" />
          )}
        </div>
      </div>

      <div className={modalStyles.modalBody}>
        {/* Description */}
        {!editingDescription && (
          <div style={{ marginBottom: '1rem', position: 'relative' }}>
            {quest.description ? (
              <>
                <div
                  ref={descriptionRef}
                  className={`${viewStyles.descriptionBlock} ${
                    !descriptionExpanded ? viewStyles.descriptionCollapsed : viewStyles.descriptionExpanded
                  }`}
                >
                  <ReactMarkdown>{quest.description}</ReactMarkdown>
                </div>
                {canEdit && (
                  <div className={viewStyles.descriptionEditBtnWrapper}>
                    <IconButton icon="edit" onClick={handleStartEditDescription} title="Редактировать описание" size="small" variant="primary" />
                  </div>
                )}
                {!descriptionExpanded && descriptionOverflow && (
                  <div className={viewStyles.descriptionExpandPlate} onClick={() => setDescriptionExpanded(true)}>
                    Показать полностью
                  </div>
                )}
                {descriptionExpanded && (
                  <div className={viewStyles.descriptionCollapseBtn} onClick={() => setDescriptionExpanded(false)}>
                    Свернуть
                  </div>
                )}
              </>
            ) : canEdit ? (
              <div
                className={viewStyles.addDescriptionPlaceholder}
                onClick={handleStartEditDescription}
              >
                <span className={viewStyles.addObjectiveIcon}>+</span>
                <span>Добавить описание</span>
              </div>
            ) : null}
          </div>
        )}

        {editingDescription && (
          <div style={{ marginBottom: '1rem' }}>
            <div ref={editorRef} data-color-mode={themeMode}>
              <MDEditor
                value={editingDescriptionValue}
                onChange={value => setEditingDescriptionValue(value || '')}
                preview="edit"
                height={120}
                textareaProps={{ lang: 'ru', spellCheck: true }}
                previewOptions={{ disallowedElements: ['script', 'style'] }}
              />
            </div>
            <div className={modalStyles.buttons} style={isMobile ? { flexDirection: 'row' } : undefined}>
<button type="button" onClick={handleCancelDescription} className={buttonStyles.button} style={isMobile ? { flex: 1, padding: '0.5rem', fontSize: '0.85rem' } : undefined}>
  Отмена
</button>
<button type="button" onClick={handleSaveDescription} className={buttonStyles.button} style={isMobile ? { flex: 1, padding: '0.5rem', fontSize: '0.85rem' } : undefined}>
  Сохранить
</button>
            </div>
          </div>
        )}

        {/* Objectives */}
        <div className={viewStyles.objectivesSection}>
          {activeObjectives.map(obj => renderObjective(obj))}

          {canEdit && (
            <div
              className={viewStyles.addObjectiveRow}
              onClick={async () => {
                const newKey = await onObjectiveAdd?.(quest.id);
                if (newKey) {
                  handleStartEditObjective(newKey, '');
                }
              }}
            >
              <span className={viewStyles.addObjectiveIcon}>+</span>
              <span>Добавить цель</span>
            </div>
          )}

          {completedObjectivesList.length > 0 && (
            <>
              <div
                className={viewStyles.completedToggle}
                onClick={() => setCompletedExpanded(!completedExpanded)}
              >
                <span>{completedExpanded ? '▼' : '▶'}</span>
                <span>Завершённые и прочие ({completedObjectivesList.length})</span>
              </div>
              {completedExpanded && completedObjectivesList.map(obj => renderObjective(obj))}
            </>
          )}
        </div>



        {/* Reward - показываем если есть */}
        {quest.reward && quest.reward.length > 0 && (
          <div className={viewStyles.rewardsSection}>
            {quest.reward.map((item, idx) => (
              <span key={idx} className={viewStyles.rewardTag}>
                {item}
              </span>
            ))}
          </div>
        )}
      </div>

      {isMobile ? (
        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
          <button type="button" className={buttonStyles.button} style={{ flex: 1, padding: '0.5rem', fontSize: '0.85rem' }} onClick={onClose}>
            ✕ Закрыть
          </button>
        </div>
      ) : (
        <div className={modalStyles.buttons}>
          <button type="button" className={buttonStyles.button} onClick={onClose}>
            Закрыть
          </button>
        </div>
      )}
      {/* Mini modal for characters */}
      {charactersModalOpen && (
        <ModalPortal isOpen={charactersModalOpen} onClose={() => setCharactersModalOpen(false)}>
          <h2 style={{ margin: 0 }}>Назначенные персонажи</h2>
          <div className={modalStyles.modalBody} style={{ marginTop: '1rem' }}>
            {!characters || characters.length === 0 ? (
              <p style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>Нет доступных персонажей</p>
            ) : (
              <>
                <div className={viewStyles.characterList}>
                  {quest.assignedCharacters.length === 0 ? (
                    <p style={{ color: 'var(--text-secondary)', fontStyle: 'italic', padding: '0.5rem 0' }}>
                      Персонажи не назначены
                    </p>
                  ) : (
                    quest.assignedCharacters.map(charId => {
                      const char = characters.find(c => c.id === charId);
                      return (
                        <div key={charId} className={viewStyles.characterListItem}>
                          <span>{char?.name || `ID: ${charId}`}</span>
                          <button
                            type="button"
                            className={viewStyles.characterRemoveBtn}
                            onClick={() => handleToggleCharacter(charId)}
                          >
                            ✕
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
                <div className={viewStyles.rewardInputRow}>
                  <select
                    value=""
                    onChange={e => {
                      const val = parseInt(e.target.value);
                      if (val && !quest.assignedCharacters.includes(val)) {
                        handleToggleCharacter(val);
                      }
                    }}
                    className={inputStyles.input}
                  >
                    <option value="">Выберите персонажа...</option>
                    {characters
                      .filter(char => !quest.assignedCharacters.includes(char.id))
                      .map(char => (
                        <option key={char.id} value={char.id}>
                          {char.name}
                        </option>
                      ))}
                  </select>
                </div>
              </>
            )}
          </div>
          <div className={modalStyles.buttons}>
            <button type="button" className={buttonStyles.button} onClick={() => setCharactersModalOpen(false)}>
              Закрыть
            </button>
          </div>
        </ModalPortal>
      )}
    </ModalPortal>
  );
};

export default QuestViewModal;
