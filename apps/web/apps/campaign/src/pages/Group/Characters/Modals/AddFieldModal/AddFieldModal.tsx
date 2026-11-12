import React, { useState, useEffect } from 'react';
import { TemplateField } from '../../../../../types/characterTemplates';
import buttonStyles from '@tdn/shared/styles/components/Button.module.css';
import modalStyles from '@tdn/shared/styles/modal.module.css';
import styles from './AddFieldModal.module.css';
import IconButton from '@tdn/shared/ui/Buttons/IconButton/IconButton';

interface AddFieldModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (fieldKey: string) => void;
  availableFields: { key: string; field: TemplateField }[];
}

const AddFieldModal: React.FC<AddFieldModalProps> = ({
  isOpen,
  onClose,
  onSave,
  availableFields,
}) => {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setError(null);
  }, [availableFields, isOpen]);

  const addField = (key: string) => {
    onSave(key);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className={modalStyles.overlay}>
      <div className={modalStyles.modal}>
        <h2>Добавить поле в категорию</h2>

        {error && <div className={modalStyles.error}>{error}</div>}

        {availableFields.length === 0 ? (
          <div className={styles.emptyState}>
            <p>Нет доступных полей для добавления</p>
          </div>
        ) : (
          <div className={styles.fieldsList}>
            {availableFields.map((value) => (
              <div key={value.key} className={styles.fieldItem}>
                <div className={styles.fieldInfo}>
                  <div className={styles.fieldName}>{value.field.name}</div>
                  {value.field.description && (
                    <div className={styles.fieldDescription}>
                      {value.field.description}
                    </div>
                  )}
                </div>
                <IconButton
                  icon="add"
                  onClick={() => addField(value.key)}
                  title="Добавить поле"
                  size="small"
                />
              </div>
            ))}
          </div>
        )}

        <div className={modalStyles.buttons}>
          <button
            type="button"
            onClick={onClose}
            className={buttonStyles.button}
          >
            Отмена
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddFieldModal;