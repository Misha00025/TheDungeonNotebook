import React, { useState, useEffect } from 'react';
import { CharacterTemplate } from '../../../../types/characterTemplates';
import { groupAPI } from '../../../../services/api';
import buttonStyles from '@tdn/shared/styles/components/Button.module.css';
import modalStyles from '@tdn/shared/styles/modal.module.css';
import styles from './CharacterResourcesModal.module.css';
import ModalPortal from '@tdn/shared/ui/ModalPortal/ModalPortal';

interface CharacterResourcesModalProps {
  isOpen: boolean;
  onClose: () => void;
  groupId: number;
  templates: CharacterTemplate[];
}

const CharacterResourcesModal: React.FC<CharacterResourcesModalProps> = ({
  isOpen,
  onClose,
  groupId,
  templates,
}) => {
  const [selectedFields, setSelectedFields] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Collect all unique field keys from all templates
  const allFieldKeys = Array.from(
    new Set(
      templates.flatMap(t => Object.keys(t.fields))
    )
  );

  const availableFieldKeys = allFieldKeys.filter(
    key => !selectedFields.includes(key)
  );

  useEffect(() => {
    if (isOpen) {
      loadCurrentResources();
    }
  }, [isOpen, groupId]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadCurrentResources = async () => {
    try {
      const fields = await groupAPI.getCharacterResources(groupId);
      setSelectedFields(fields);
    } catch (err) {
      console.error('Failed to load character resources:', err);
      setSelectedFields([]);
    }
  };

  const moveInArray = <T,>(arr: T[], from: number, to: number): T[] => {
    const next = [...arr];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    return next;
  };

  const handleDragStart = (index: number) => (e: React.DragEvent) => {
    setDragIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(index));
  };

  const handleDragOver = (index: number) => (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverIndex(index);
  };

  const handleDragLeave = () => () => {
    setDragOverIndex(null);
  };

  const handleDrop = (dropIndex: number) => (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (dragIndex === null || dragIndex === dropIndex) {
      setDragIndex(null);
      setDragOverIndex(null);
      return;
    }
    setSelectedFields(moveInArray(selectedFields, dragIndex, dropIndex));
    setDragIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDragIndex(null);
    setDragOverIndex(null);
  };

  const addField = (fieldKey: string) => {
    setSelectedFields(prev => [...prev, fieldKey]);
  };

  const removeField = (fieldKey: string) => {
    setSelectedFields(prev => prev.filter(f => f !== fieldKey));
  };

  const handleSave = async () => {
    setLoading(true);
    setError(null);
    try {
      await groupAPI.updateCharacterResources(groupId, selectedFields);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setLoading(false);
    }
  };

  const getFieldName = (fieldKey: string): string => {
    for (const t of templates) {
      const field = t.fields[fieldKey];
      if (field) return field.name;
    }
    return fieldKey;
  };

  return (
    <ModalPortal isOpen={isOpen} onClose={onClose}>
      <h2>Поля на главной странице персонажа</h2>
      <div className={modalStyles.modalBody}>
      <p className={styles.hint}>
        Выберите поля, которые будут отображаться на дашборде персонажа и на карточках в списке персонажей.
        Эти поля GM считает основными ресурсами (HP, Gold, MP и т.д.).
        Перетаскивайте или используйте кнопки ▲▼ для сортировки. ✕ — убрать из выбранных.
      </p>

      {error && <div className={modalStyles.error}>{error}</div>}

      {allFieldKeys.length === 0 ? (
        <p className={styles.empty}>Нет доступных полей. Сначала создайте шаблоны персонажей с полями.</p>
      ) : (
        <>
          <div className={styles.selectedSection}>
            <h3 className={styles.sectionTitle}>Выбранные поля</h3>
            {selectedFields.length === 0 ? (
              <p className={styles.emptyHint}>Поля не выбраны. Добавьте поля из списка "Доступные поля".</p>
            ) : (
              <div className={styles.list}>
                {selectedFields.map((fieldKey, index) => (
                  <div
                    key={fieldKey}
                    className={`${styles.item} ${dragIndex === index ? styles.dragging : ''} ${dragOverIndex === index ? styles.dragOver : ''}`}
                    draggable
                    onDragStart={handleDragStart(index)}
                    onDragOver={handleDragOver(index)}
                    onDragLeave={handleDragLeave()}
                    onDrop={handleDrop(index)}
                    onDragEnd={handleDragEnd}
                  >
                    <span className={styles.dragHandle}>⠿</span>
                    <span className={styles.fieldName}>{getFieldName(fieldKey)}</span>
                    <span className={styles.fieldKey}>{fieldKey}</span>
                    <div className={styles.fieldActions}>
                      <button
                        className={styles.moveBtn}
                        disabled={index === 0}
                        onClick={() => setSelectedFields(moveInArray(selectedFields, index, index - 1))}
                      >▲</button>
                      <button
                        className={styles.moveBtn}
                        disabled={index === selectedFields.length - 1}
                        onClick={() => setSelectedFields(moveInArray(selectedFields, index, index + 1))}
                      >▼</button>
                      <button
                        className={styles.removeBtn}
                        onClick={() => removeField(fieldKey)}
                      >✕</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className={styles.availableSection}>
            <h3 className={styles.sectionTitle}>Доступные поля</h3>
            {availableFieldKeys.length === 0 ? (
              <p className={styles.emptyHint}>Все поля уже выбраны.</p>
            ) : (
              <div className={styles.availableList}>
                {availableFieldKeys.map(fieldKey => (
                  <div key={fieldKey} className={styles.availableItem}>
                    <span className={styles.fieldName}>{getFieldName(fieldKey)}</span>
                    <span className={styles.fieldKey}>{fieldKey}</span>
                    <button
                      className={`${buttonStyles.button} ${buttonStyles.small}`}
                      onClick={() => addField(fieldKey)}
                    >
                      Добавить
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      </div>
      <div className={modalStyles.buttons}>
        <button className={buttonStyles.button} onClick={onClose}>
          Отмена
        </button>
        <button
          className={buttonStyles.button}
          onClick={handleSave}
          disabled={loading || allFieldKeys.length === 0}
        >
          {loading ? 'Сохранение...' : 'Сохранить'}
        </button>
      </div>
    </ModalPortal>
  );
};

export default CharacterResourcesModal;
