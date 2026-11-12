import React, { useState, useEffect } from 'react';
import buttonStyles from '@tdn/shared/styles/components/Button.module.css';
import inputStyles from '@tdn/shared/styles/components/Input.module.css';
import modalStyles from '@tdn/shared/styles/modal.module.css';
import { TemplateCategory } from '../../../../../types/groupSchemas';
import ModalPortal from '@tdn/shared/ui/ModalPortal/ModalPortal';

interface CategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (category: TemplateCategory) => void;
  category?: TemplateCategory | null;
  title: string;
}

const CategoryModal: React.FC<CategoryModalProps> = ({
  isOpen,
  onClose,
  onSave,
  category,
  title
}) => {
  const [name, setName] = useState('');

  useEffect(() => {
    if (category) {
      setName(category.name);
    } else {
      setName('');
    }
  }, [category, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      name,
      fields: category?.fields || []
    });
  };

  return (
    <ModalPortal isOpen={isOpen} onClose={onClose}>
      <h2>{title}</h2>
      <form onSubmit={handleSubmit}>
      <div className={modalStyles.modalBody}>
        <div className={modalStyles.formGroup}>
          <label>Название категории:</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputStyles.input}
            required
          />
        </div>

        </div>
        <div className={modalStyles.buttons}>
          <button type="button" onClick={onClose} className={buttonStyles.button}>
            Отмена
          </button>
          <button type="submit" className={buttonStyles.button}>
            Сохранить
          </button>
        </div>
        </form>
    </ModalPortal>
  );
};

export default CategoryModal;