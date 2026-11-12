import React, { useState, useEffect } from 'react';
import { GroupItem, CreateGroupItemRequest, UpdateGroupItemRequest } from '../../../../types/groupItems';
import buttonStyles from '@tdn/shared/styles/components/Button.module.css';
import inputStyles from '@tdn/shared/styles/components/Input.module.css';
import modalStyles from '@tdn/shared/styles/modal.module.css';
import ModalPortal from '@tdn/shared/ui/ModalPortal/ModalPortal';
import { SkillAttribute } from '../../../../types/groupSkills';
import { generateKey } from '@tdn/shared/utils/generateKey';
import IconButton from '@tdn/shared/ui/Buttons/IconButton/IconButton';
import EvaluatedInput from '@tdn/shared/ui/EvaluatedInput/EvaluatedInput';

interface GroupItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (itemData: CreateGroupItemRequest | UpdateGroupItemRequest) => Promise<void>;
  editingItem?: GroupItem | null;
  title: string;
}

const GroupItemModal: React.FC<GroupItemModalProps> = ({
  isOpen,
  onClose,
  onSave,
  editingItem,
  title
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState<number | ''>(0);
  const [imageLink, setImageLink] = useState('');
  const [attributes, setAttributes] = useState<SkillAttribute[]>([]);
  const [newAttribute, setNewAttribute] = useState<Partial<SkillAttribute>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [customValues, setCustomValues] = useState<{[key: string]: string}>({});

  // Заполняем форму данными при редактировании
  useEffect(() => {
    if (editingItem) {
      setName(editingItem.name);
      setDescription(editingItem.description);
      setPrice(editingItem.price);
      setAttributes([...editingItem.attributes ?? []]);
      setImageLink(editingItem.image_link || '');
      setCustomValues({});
    } else {
      // Сброс формы при создании нового предмета
      setName('');
      setDescription('');
      setPrice('');
      setAttributes([]);
      setImageLink('');
      setCustomValues({});
    }
  }, [editingItem, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const itemData = {
        name,
        description,
        price: price === '' ? 0 : price,
        image_link: imageLink || undefined,
        attributes: attributes
      };

      await onSave(itemData);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save item');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNewAttribute = () => {
    if (!newAttribute.name || !newAttribute.value) {
      setError('Ключ, название и значение обязательны для нового атрибута');
      return;
    }

    setAttributes(prev => [...prev, {
      key: generateKey(newAttribute.name!),
      name: newAttribute.name!,
      description: "",
      value: newAttribute.value!
    }]);

    setNewAttribute({});
    setError(null);
  };

  const handleUpdateAttribute = (index: number, updates: Partial<SkillAttribute>) => {
    setAttributes(prev => prev.map((attr, i) => 
      i === index ? { ...attr, ...updates } : attr
    ));
  };

  const handleRemoveAttribute = (index: number) => {
    setAttributes(prev => prev.filter((_, i) => i !== index));
  };

  const renderAttributeValueInput = (attr: SkillAttribute, index: number, isNew: boolean = false) => {
    
    const currentValue = isNew ? newAttribute.value || '' : attr.value;

      return (
        <div className={modalStyles.attributeValueContainer}>
            <div className={modalStyles.customInputContainer}>
              <input
                type="text"
                value={customValues[attr.key] || currentValue}
                onChange={(e) => {
                  const customValue = e.target.value;
                  setCustomValues(prev => ({ ...prev, [attr.key]: customValue }));
                  
                  if (isNew) {
                    setNewAttribute(prev => ({ ...prev, value: customValue }));
                  } else {
                    handleUpdateAttribute(index, { value: customValue });
                  }
                }}
                className={inputStyles.input}
                placeholder="Введите своё значение"
              />
              <button
                type="button"
                onClick={() => {
                  setCustomValues(prev => {
                    const newCustom = { ...prev };
                    delete newCustom[attr.key];
                    return newCustom;
                  });
                  if (isNew) {
                    setNewAttribute(prev => ({ ...prev, value: '' }));
                  } else {
                    handleUpdateAttribute(index, { value: '' });
                  }
                }}
                className={buttonStyles.button}
              >
                ×
              </button>

            </div>
        </div>
      );
    };


  return (
    <ModalPortal isOpen={isOpen} onClose={onClose}>
        
        <h2>{title}</h2>
        <form onSubmit={handleSubmit}>
        <div className={modalStyles.modalBody}>
        
        {error && <div className={modalStyles.error}>{error}</div>}
        
          <div className={modalStyles.formGroup}>
            <label>Название:</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputStyles.input}
              required
            />
          </div>

          <div className={modalStyles.formGroup}>
            <label>Описание:</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className={inputStyles.input}
              rows={3}
              required
            />
          </div>

          <div className={modalStyles.formGroup}>
            <label>Цена:</label>
            <EvaluatedInput
              initialValue={price === '' ? '' : price.toString()}
              onCommit={(value) => setPrice(value.trim() === '' ? 0 : Math.max(0, Number(value.trim())))}
              className={inputStyles.input}
              placeholder="Цена"
              required
            />
          </div>

          <div className={modalStyles.formGroup}>
            <label>Ссылка на изображение (в разработке):</label>
            <input
              type="text"
              value={imageLink}
              onChange={(e) => setImageLink(e.target.value)}
              className={inputStyles.input}
            />
          </div>

          <div className={modalStyles.attributesSection}>
            <h3>Атрибуты предмета</h3>
            
            {attributes.map((attr, index) => {
              return (
                <div key={index} className={modalStyles.attributeItem}>
                  <div className={modalStyles.attributeContent}>
                    <div className={modalStyles.attributeHeader}>
                      <span className={modalStyles.attributeName}>{attr.name}</span>
                    </div>
                    {renderAttributeValueInput(attr, index)}
                  </div>
                  <IconButton 
                    icon='delete'
                    title='Удалить'
                    onClick={() => handleRemoveAttribute(index)}
                    variant='danger'
                  />
                </div>
              );
            })}
          </div>

          <div className={modalStyles.addAttribute}>
              <h4>Добавить атрибут</h4>
              <input
                type="text"
                value={newAttribute.name || ''}
                onChange={(e) => setNewAttribute(prev => ({ ...prev, name: e.target.value }))}
                className={inputStyles.input}
                placeholder="Название"
              />
              {renderAttributeValueInput(newAttribute as SkillAttribute, -1, true)}

              <div className={modalStyles.attributeActions}>
                  <button type="button" onClick={handleCreateNewAttribute} className={buttonStyles.button}>
                    Создать новый атрибут
                  </button>
              </div>
            </div>

          </div>
          <div className={modalStyles.buttons}>
            <button type="button" onClick={onClose} className={buttonStyles.button}>
              Отмена
            </button>
            <button type="submit" className={buttonStyles.button} disabled={loading}>
              {loading ? 'Сохранение...' : 'Сохранить'}
            </button>
          </div>
          </form>

  </ModalPortal>
  );
};

export default GroupItemModal;