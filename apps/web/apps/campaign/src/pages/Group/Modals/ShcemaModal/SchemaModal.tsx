// components/Modals/SchemaModal/SchemaModal.tsx
import React, { useState, useEffect } from 'react';
import buttonStyles from '@tdn/shared/styles/components/Button.module.css';
import modalStyles from '@tdn/shared/styles/modal.module.css';
import ModalPortal from '@tdn/shared/ui/ModalPortal/ModalPortal';
import styles from './SchemaModal.module.css';
import IconButton from '@tdn/shared/ui/Buttons/IconButton/IconButton';

interface SchemaModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (groupBy: string[]) => Promise<void>;
  availableAttributes: string[];
  currentSchema: string[];
  title: string;
}

const SchemaModal: React.FC<SchemaModalProps> = ({
  isOpen,
  onClose,
  onSave,
  availableAttributes,
  currentSchema,
  title
}) => {
  const [selectedAttributes, setSelectedAttributes] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);

  useEffect(() => {
    if (isOpen) {
      setSelectedAttributes([...currentSchema]);
    }
  }, [isOpen, currentSchema]);

  const handleAddAttribute = (attribute: string) => {
    if (!selectedAttributes.includes(attribute)) {
      setSelectedAttributes([...selectedAttributes, attribute]);
    }
  };

  const handleRemoveAttribute = (attribute: string) => {
    setSelectedAttributes(selectedAttributes.filter(a => a !== attribute));
  };

  const handleMoveAttribute = (fromIndex: number, toIndex: number) => {
    const newAttributes = [...selectedAttributes];
    const [removed] = newAttributes.splice(fromIndex, 1);
    newAttributes.splice(toIndex, 0, removed);
    setSelectedAttributes(newAttributes);
  };

  const handleDragStart = (index: number) => {
    setDraggingIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (draggingIndex !== null && draggingIndex !== dropIndex) {
      handleMoveAttribute(draggingIndex, dropIndex);
    }
    setDraggingIndex(null);
  };

  const handleDragEnd = () => {
    setDraggingIndex(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await onSave(selectedAttributes);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save schema');
    } finally {
      setLoading(false);
    }
  };

  const availableToAdd = availableAttributes.filter(
    attr => !selectedAttributes.includes(attr)
  );


  return (
    <ModalPortal isOpen={isOpen} onClose={onClose}>
        
        <h2>{title}</h2>
        <form onSubmit={handleSubmit}>
        <div className={modalStyles.modalBody}>
        
        {error && <div className={modalStyles.error}>{error}</div>}
        
          <div className={styles.schemaSection}>
            <div className={styles.schemaHeader}>
              <h3>Иерархия группировки</h3>
              <p className={styles.hint}>
                Атрибуты будут применяться сверху вниз в указанном порядке
              </p>
            </div>
            
            <div className={styles.schemaList}>
              {selectedAttributes.length === 0 ? (
                <div className={styles.emptySchema}>
                  <p>Схема группировки не настроена. Элементы будут отображаться без группировки.</p>
                  <p>Выберите атрибуты из списка справа, чтобы создать иерархию.</p>
                </div>
              ) : (
                selectedAttributes.map((attribute, index) => (
                  <div
                    key={attribute}
                    className={`${styles.schemaItem} ${draggingIndex === index ? styles.dragging : ''}`}
                    draggable
                    onDragStart={() => handleDragStart(index)}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDrop={(e) => handleDrop(e, index)}
                    onDragEnd={handleDragEnd}
                  >
                    <div className={styles.dragHandle}>⋮⋮</div>
                    <div className={styles.schemaContent}>
                      <span className={styles.levelIndicator}>Уровень {index + 1}</span>
                      <span className={styles.attributeName}>{attribute}</span>
                    </div>
                    <IconButton 
                      icon='delete'
                      title='Удалить из схемы'
                      onClick={() => handleRemoveAttribute(attribute)}
                      variant='danger'
                    />
                  </div>
                ))
              )}
            </div>
          </div>

          <div className={styles.availableSection}>
            <h3>Доступные атрибуты</h3>
            <p className={styles.hint}>
              {availableToAdd.length === 0 
                ? 'Все атрибуты уже добавлены в схему'
                : 'Выберите атрибуты для добавления в схему группировки'}
            </p>
            
            <div className={styles.availableList}>
              {availableToAdd.map(attribute => (
                <div key={attribute} className={styles.availableItem}>
                  <span className={styles.attributeName}>{attribute}</span>
                  <button
                    type="button"
                    onClick={() => handleAddAttribute(attribute)}
                    className={`${buttonStyles.button} ${buttonStyles.small}`}
                  >
                    Добавить
                  </button>
                </div>
              ))}
              
              {availableToAdd.length === 0 && (
                <div className={styles.noAttributes}>
                  Нет доступных атрибутов для добавления
                </div>
              )}
            </div>
          </div>

          <div className={styles.previewSection}>
            <h3>Предварительный просмотр</h3>
            <div className={styles.preview}>
              <p className={styles.hint}>Структура будет выглядеть следующим образом:</p>
              <div className={styles.previewTree}>
                {selectedAttributes.length > 0 ? (
                  selectedAttributes.map((attribute, index) => (
                    <div key={attribute} className={styles.previewLevel}>
                      {'  '.repeat(index)}• {attribute}
                    </div>
                  ))
                ) : (
                  <div className={styles.noGrouping}>
                    ↳ Без группировки (плоский список)
                  </div>
                )}
              </div>
            </div>
          </div>

          </div>
          <div className={modalStyles.buttons}>
            <button type="button" onClick={onClose} className={buttonStyles.button}>
              Отмена
            </button>
            <button type="submit" className={buttonStyles.button} disabled={loading}>
              {loading ? 'Сохранение...' : 'Сохранить схему'}
            </button>
          </div>
          </form>

  </ModalPortal>
  );
};

export default SchemaModal;