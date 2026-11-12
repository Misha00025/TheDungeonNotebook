import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { CharacterField } from '../../../../types/characters';
import { CharacterItem } from '../../../../types/characterItems';
import { GroupSkill } from '../../../../types/groupSkills';
import { characterCommandsAPI, characterItemsAPI } from '../../../../services/api';
import { useCharacter } from '../../../../contexts/CharacterContext';
import commonStyles from '@tdn/shared/styles/common.module.css';
import modalStyles from '@tdn/shared/styles/modal.module.css';
import buttonStyles from '@tdn/shared/styles/components/Button.module.css';
import EvaluatedInput from '@tdn/shared/ui/EvaluatedInput/EvaluatedInput';
import { useActionPermissions } from '../../../../hooks/useActionPermissions';
import { useDashboardSettingsContext } from '../../../../contexts/DashboardSettingsContext';
import DashboardSortModal from '../Modals/DashboardSortModal/DashboardSortModal';
import ItemCard from '../../Cards/ItemCard/ItemCard';
import SkillCard from '../../Cards/SkillCard/SkillCard';
import styles from './CharacterDashboard.module.css';

const CharacterDashboard: React.FC = () => {
  const { groupId, characterId } = useParams<{ groupId: string; characterId: string }>();
  const { character, setCharacter, items, skills, setItems, refreshCharacter, refreshItems, refreshSkills, itemsLoading, skillsLoading } = useCharacter();
  const [error, setError] = useState<string | null>(null);
  const [isSortModalOpen, setIsSortModalOpen] = useState(false);
  const { canEditThisCharacter } = useActionPermissions();
  const { settings, toggleEquipped, togglePinnedSkill } = useDashboardSettingsContext();

  useEffect(() => {
    refreshCharacter();
    refreshItems();
    refreshSkills();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleUpdateField = async (fieldKey: string, newValue: string) => {
    if (!character) return;
    try {
      const field = character.fields[fieldKey];
      const result = await characterCommandsAPI.executeCommand(
        Number(groupId), Number(characterId),
        {
          type: 'UpdateField',
          payload: { key: fieldKey, field: { ...field, value: Number(newValue) } },
        }
      );
      setCharacter(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update field');
    }
  };

  const handleUpdateItemAmount = async (itemId: number, newAmount: number) => {
    try {
      const item = items.find(i => i.id === itemId);
      if (!item) return;
      const updatedItem = await characterItemsAPI.updateCharacterItem(
        Number(groupId), Number(characterId), itemId,
        { name: item.name, description: item.description, amount: newAmount, price: item.price, image_link: item.image_link || undefined }
      );
      setItems(prev => prev.map(item => item.id === itemId ? updatedItem : item));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update item amount');
    }
  };

  const resourceFields = settings.fields
    .map(key => character ? [key, character.fields[key]] as [string, CharacterField] : null)
    .filter((entry): entry is [string, CharacterField] => entry !== null && entry[1] !== undefined);

  const resourceItems = settings.items
    .map(id => items.find(item => item.id === id))
    .filter((item): item is CharacterItem => item !== undefined);

  const equippedItems = settings.equipped
    .map(id => items.find(item => item.id === id))
    .filter((item): item is CharacterItem => item !== undefined);

  const pinnedSkills = settings.pinnedSkills
    .map(id => skills.find(skill => skill.id === id))
    .filter((skill): skill is GroupSkill => skill !== undefined);

  const hasContent = resourceFields.length > 0 || resourceItems.length > 0 || equippedItems.length > 0 || pinnedSkills.length > 0;

  return (
    <div className={commonStyles.container}>
      {error && <div className={modalStyles.error}>{error}</div>}

      {(itemsLoading || skillsLoading) && <div className={styles.loading}>Загрузка...</div>}

      {!hasContent ? (
        <div className={styles.emptyState}>
          <p>Главная страница пока пуста.</p>
          <p>Добавьте сюда то, что хотите видеть в первую очередь:</p>
          <div className={styles.emptyActions}>
            <Link to="stats" className={buttonStyles.button}>Перейти к статам</Link>
            <Link to="items" className={buttonStyles.button}>Перейти к инвентарю</Link>
            <Link to="skills" className={buttonStyles.button}>Перейти к способностям</Link>
          </div>
        </div>
      ) : (
        <div style={{ position: 'relative' }}>
          <button
            className={styles.settingsButton}
            onClick={() => setIsSortModalOpen(true)}
            title="Настроить порядок"
          >
            ⚙️
          </button>
          <div className={styles.dashboardGrid}>
            {/* Первая колонка: Поля + Предметы */}
            <div className={styles.column}>
              <div className={styles.section}>
                <h3 className={styles.sectionTitle}>Поля</h3>
                {resourceFields.length > 0 ? (
                  <table className={styles.table}>
                    <tbody>
                      {resourceFields.map(([fieldKey, field]) => (
                        <FieldResourceRow
                          key={fieldKey}
                          field={field}
                          editable={canEditThisCharacter}
                          onUpdate={(value) => handleUpdateField(fieldKey, value)}
                        />
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className={styles.placeholder}>
                    <p>Нет выбранных полей.</p>
                    <p>Нажмите <span className={styles.gearHint}>⚙️</span>, чтобы настроить отображение.</p>
                  </div>
                )}
              </div>
              <div className={styles.section}>
                <h3 className={styles.sectionTitle}>Предметы</h3>
                {resourceItems.length > 0 ? (
                  <table className={styles.table}>
                    <tbody>
                      {resourceItems.map(item => (
                        <ItemResourceRow
                          key={item.id}
                          item={item}
                          editable={canEditThisCharacter}
                          onUpdateAmount={(amount) => handleUpdateItemAmount(item.id, amount)}
                        />
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className={styles.placeholder}>
                    <p>Нет выбранных предметов.</p>
                    <p>Перейдите во вкладку «Инвентарь» и добавьте предметы, затем настройте отображение через ⚙️.</p>
                  </div>
                )}
              </div>
            </div>

            {/* Вторая колонка: Экипировка */}
            <div className={styles.column}>
              <div className={styles.cardSection}>
                <h3 className={styles.sectionTitle}>Экипировка</h3>
                {equippedItems.length > 0 ? (
                  <div className={styles.cardList}>
                    {equippedItems.map(item => (
                      <ItemCard
                        key={item.id}
                        item={item}
                        showActions={false}
                        showAmount={false}
                        onRemoveFromDashboard={() => toggleEquipped(item.id)}
                      />
                    ))}
                  </div>
                ) : (
                  <div className={styles.placeholder}>
                    <p>Нет экипированных предметов.</p>
                    <p>Отметьте предметы как экипированные во вкладке «Инвентарь», затем настройте отображение через ⚙️.</p>
                  </div>
                )}
              </div>
            </div>

            {/* Третья колонка: Способности */}
            <div className={styles.column}>
              <div className={styles.cardSection}>
                <h3 className={styles.sectionTitle}>Способности</h3>
                {pinnedSkills.length > 0 ? (
                  <div className={styles.cardList}>
                    {pinnedSkills.map(skill => (
                      <SkillCard
                        key={skill.id}
                        skill={skill}
                        showActions={false}
                        onRemoveFromDashboard={() => togglePinnedSkill(skill.id)}
                      />
                    ))}
                  </div>
                ) : (
                  <div className={styles.placeholder}>
                    <p>Нет закреплённых способностей.</p>
                    <p>Перейдите во вкладку «Способности» и закрепите нужные, затем настройте отображение через ⚙️.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <DashboardSortModal
        isOpen={isSortModalOpen}
        onClose={() => setIsSortModalOpen(false)}
        groupId={Number(groupId)}
        characterId={Number(characterId)}
        character={character}
        items={items}
        skills={skills}
      />
    </div>
  );
};

interface FieldResourceRowProps {
  field: CharacterField;
  editable: boolean;
  onUpdate: (value: string) => void;
}

const FieldResourceRow: React.FC<FieldResourceRowProps> = ({ field, editable, onUpdate }) => {
  const [isEditing, setIsEditing] = useState(false);

  const renderProgressBar = (f: CharacterField) => {
    const percentage = (f.value / f.maxValue!) * 100;
    return (
      <div className={styles.progressContainer}>
        <div
          className={styles.progressBar}
          style={{
            width: `${percentage}%`,
            backgroundColor: `color-mix(in srgb, var(--progress-bar-from) ${100 - percentage}%, var(--progress-bar-to))`
          }}
        >
          <span className={styles.progressText}>{f.value}/{f.maxValue}</span>
        </div>
      </div>
    );
  };

  const renderValue = () => {
    if (isEditing && editable) {
      return (
        <EvaluatedInput
          initialValue={field.value.toString()}
          onCommit={(value) => {
            onUpdate(value);
            setIsEditing(false);
          }}
          onCancel={() => setIsEditing(false)}
          className={styles.editInput}
          autoFocus
        />
      );
    }

    return (
      <div
        className={editable ? styles.editableValue : styles.resourceValue}
        onClick={() => editable && setIsEditing(true)}
      >
        {field.maxValue !== undefined ? renderProgressBar(field) : field.value}
      </div>
    );
  };

  return (
    <tr className={styles.row}>
      <td className={styles.nameCell}><span className={styles.fieldName}>{field.name}</span></td>
      <td className={styles.valueCell}>{renderValue()}</td>
    </tr>
  );
};

interface ItemResourceRowProps {
  item: CharacterItem;
  editable: boolean;
  onUpdateAmount: (amount: number) => void;
}

const ItemResourceRow: React.FC<ItemResourceRowProps> = ({ item, editable, onUpdateAmount }) => {
  const [isEditing, setIsEditing] = useState(false);

  return (
    <tr className={styles.row}>
      <td className={styles.nameCell}>{item.name}</td>
      <td className={styles.valueCell}>
        <div className={styles.itemControls}>
          {editable && (
            <button
              className={styles.itemButton}
              onClick={() => onUpdateAmount(Math.max(0, item.amount - 5))}
              disabled={item.amount <= 0}
            >
              -5
            </button>
          )}
          {editable && (
            <button
              className={styles.itemButton}
              onClick={() => onUpdateAmount(Math.max(0, item.amount - 1))}
              disabled={item.amount <= 0}
            >
              -1
            </button>
          )}
          {isEditing && editable ? (
            <EvaluatedInput
              initialValue={item.amount.toString()}
              onCommit={(value) => {
                const num = Math.max(0, parseInt(value) || 0);
                onUpdateAmount(num);
                setIsEditing(false);
              }}
              onCancel={() => setIsEditing(false)}
              className={styles.editInput}
              autoFocus
            />
          ) : (
            <span
              className={editable ? styles.editableValue : styles.resourceValue}
              onClick={() => editable && setIsEditing(true)}
            >
              {item.amount}
            </span>
          )}
          {editable && (
            <button
              className={styles.itemButton}
              onClick={() => onUpdateAmount(item.amount + 1)}
            >
              +1
            </button>
          )}
          {editable && (
            <button
              className={styles.itemButton}
              onClick={() => onUpdateAmount(item.amount + 5)}
            >
              +5
            </button>
          )}
        </div>
      </td>
    </tr>
  );
};

export default CharacterDashboard;
