// components/Modals/SkillAttributesModal.tsx
import React, { useState, useEffect } from 'react';
import { SkillAttributeDefinition } from '../../../../types/groupSkills';
import buttonStyles from '@tdn/shared/styles/components/Button.module.css';
import inputStyles from '@tdn/shared/styles/components/Input.module.css';
import modalStyles from '@tdn/shared/styles/modal.module.css';
import styles from './SkillAttributesModal.module.css';
import IconButton from '@tdn/shared/ui/Buttons/IconButton/IconButton';

interface SkillAttributesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (attributes: SkillAttributeDefinition[]) => Promise<void>;
  attributes: SkillAttributeDefinition[];
  title: string;
}

const SkillAttributesModal: React.FC<SkillAttributesModalProps> = ({
  isOpen,
  onClose,
  onSave,
  attributes,
  title
}) => {
  const [localAttributes, setLocalAttributes] = useState<SkillAttributeDefinition[]>([]);
  const [newAttribute, setNewAttribute] = useState<Partial<SkillAttributeDefinition>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setLocalAttributes([...attributes]);
    }
  }, [attributes, isOpen]);

  const handleAddAttribute = () => {
    if (!newAttribute.key || !newAttribute.name) {
      setError('Ключ и название обязательны');
      return;
    }

    if (localAttributes.find(attr => attr.key === newAttribute.key)) {
      setError('Атрибут с таким ключом уже существует');
      return;
    }

    setLocalAttributes(prev => [...prev, {
      key: newAttribute.key!,
      name: newAttribute.name!,
      description: newAttribute.description || '',
      isFiltered: newAttribute.isFiltered || false,
      knownValues: []
    }]);

    setNewAttribute({});
    setError(null);
  };

  const handleRemoveAttribute = (index: number) => {
    setLocalAttributes(prev => prev.filter((_, i) => i !== index));
  };

  const handleUpdateAttribute = (index: number, field: keyof SkillAttributeDefinition, value: any) => {
    setLocalAttributes(prev => prev.map((attr, i) => 
      i === index ? { ...attr, [field]: value } : attr
    ));
  };

  // Функции для сортировки
  const moveAttributeUp = (index: number) => {
    if (index <= 0) return;
    const newAttributes = [...localAttributes];
    [newAttributes[index - 1], newAttributes[index]] = [newAttributes[index], newAttributes[index - 1]];
    setLocalAttributes(newAttributes);
  };

  const moveAttributeDown = (index: number) => {
    if (index >= localAttributes.length - 1) return;
    const newAttributes = [...localAttributes];
    [newAttributes[index], newAttributes[index + 1]] = [newAttributes[index + 1], newAttributes[index]];
    setLocalAttributes(newAttributes);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await onSave(localAttributes);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save attributes');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className={modalStyles.overlay}>
      <div className={modalStyles.modal}>
        <h2>{title}</h2>
        
        {error && <div className={modalStyles.error}>{error}</div>}
        
        <div className={styles.attributesTable}>
          <h3>Существующие атрибуты</h3>
          <div className={styles.tableContainer}>
            <div className={styles.tableHeader}>
              <div className={styles.columnOrder}>Порядок</div>
              <div className={styles.columnKey}>Ключ</div>
              <div className={styles.columnName}>Название</div>
              <div className={styles.columnDescription}>Описание</div>
              <div className={styles.columnFiltered}>Фильтруемый</div>
              <div className={styles.columnActions}>Действия</div>
            </div>
            
            {localAttributes.map((attr, index) => (
              <div key={index} className={styles.tableRow}>
                <div className={styles.columnOrder}>
                  <div className={styles.orderControls}>
                    {index !== 0 && (<IconButton
                      icon='arrow-up'
                      title='Поднять'
                      onClick={() => moveAttributeUp(index)}
                    />)}
                    {index !== localAttributes.length && (<IconButton
                      icon='arrow-down'
                      title='Опустить'
                      onClick={() => moveAttributeDown(index)}
                    />)}
                  </div>
                </div>
                <div className={styles.columnKey}>
                  <input
                    type="text"
                    value={attr.key}
                    onChange={(e) => handleUpdateAttribute(index, 'key', e.target.value)}
                    className={inputStyles.input}
                    placeholder="Ключ"
                  />
                </div>
                <div className={styles.columnName}>
                  <input
                    type="text"
                    value={attr.name}
                    onChange={(e) => handleUpdateAttribute(index, 'name', e.target.value)}
                    className={inputStyles.input}
                    placeholder="Название"
                  />
                </div>
                <div className={styles.columnDescription}>
                  <input
                    type="text"
                    value={attr.description || ''}
                    onChange={(e) => handleUpdateAttribute(index, 'description', e.target.value)}
                    className={inputStyles.input}
                    placeholder="Описание"
                  />
                </div>
                <div className={styles.columnFiltered}>
                  <label className={styles.checkboxLabel}>
                    <input
                      type="checkbox"
                      checked={attr.isFiltered}
                      onChange={(e) => handleUpdateAttribute(index, 'isFiltered', e.target.checked)}
                    />
                    Фильтруемый
                  </label>
                </div>
                <div className={styles.columnActions}>
                  <IconButton
                    icon='delete'
                    title='Удалить'
                    onClick={() => handleRemoveAttribute(index)}
                    variant='danger'
                    size='small'
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className={styles.addAttribute}>
          <h3>Добавить атрибут</h3>
          <div className={styles.newAttributeForm}>
            <input
              type="text"
              value={newAttribute.key || ''}
              onChange={(e) => setNewAttribute(prev => ({ ...prev, key: e.target.value }))}
              className={inputStyles.input}
              placeholder="Ключ"
            />
            <input
              type="text"
              value={newAttribute.name || ''}
              onChange={(e) => setNewAttribute(prev => ({ ...prev, name: e.target.value }))}
              className={inputStyles.input}
              placeholder="Название"
            />
            <button
              type="button"
              onClick={handleAddAttribute}
              className={buttonStyles.button}
            >
              Добавить
            </button>
          </div>
        </div>

        <div className={modalStyles.buttons}>
          <button type="button" onClick={onClose} className={buttonStyles.button}>
            Отмена
          </button>
          <button 
            type="button" 
            onClick={handleSubmit}
            className={buttonStyles.button}
            disabled={loading}
          >
            {loading ? 'Сохранение...' : 'Сохранить'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SkillAttributesModal;