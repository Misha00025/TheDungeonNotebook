// components/Modals/SkillModal.tsx
import React, { useState, useEffect, useRef } from 'react';
import buttonStyles from '@tdn/shared/styles/components/Button.module.css';
import inputStyles from '@tdn/shared/styles/components/Input.module.css';
import modalStyles from '@tdn/shared/styles/modal.module.css';
import ModalPortal from '@tdn/shared/ui/ModalPortal/ModalPortal';
import styles from './SkillModal.module.css';
import MDEditor from '@uiw/react-md-editor';
import { useTheme, getEditorColorMode } from '@tdn/shared/theme/ThemeContext';
import { generateKey } from '@tdn/shared/utils/generateKey';
import IconButton from '@tdn/shared/ui/Buttons/IconButton/IconButton';
import { CreateGroupSkillRequest, GroupSkill, SkillAttribute, SkillAttributeDefinition, UpdateGroupSkillRequest } from '../../../../types/groupSkills';

interface SkillModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (skillData: CreateGroupSkillRequest | UpdateGroupSkillRequest) => Promise<void>;
  editingSkill?: GroupSkill | null;
  availableAttributes: SkillAttributeDefinition[];
  possibleValuesForFilteredAttributes: { [key: string]: string[] };
  title: string;
}

const SkillModal: React.FC<SkillModalProps> = ({
  isOpen,
  onClose,
  onSave,
  editingSkill,
  availableAttributes,
  possibleValuesForFilteredAttributes,
  title
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [secret, setSecret] = useState(false);
  const [attributes, setAttributes] = useState<SkillAttribute[]>([]);
  const [newAttribute, setNewAttribute] = useState<Partial<SkillAttribute>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { themeConfig } = useTheme();
  const editorRef = useRef<HTMLDivElement>(null);
  const [customValues, setCustomValues] = useState<{[key: string]: string}>({});


  useEffect(() => {
    if (editingSkill) {
      setName(editingSkill.name);
      setDescription(editingSkill.description);
      setAttributes([...editingSkill.attributes]);
      setSecret(editingSkill.isSecret)
    } else {
      setName('');
      setDescription('');
      setSecret(false);
      const filteredAttributes = availableAttributes
        .filter(attr => attr.isFiltered)
        .map(attr => ({
          key: attr.key,
          name: attr.name,
          description: attr.description,
          value: ''
        }));
      setAttributes(filteredAttributes);
    }
    if (!isOpen) {
      setCustomValues({});
    }
    setNewAttribute({});
  }, [editingSkill, isOpen, availableAttributes]);

  const handleUpdateAttribute = (index: number, updates: Partial<SkillAttribute>) => {
    setAttributes(prev => prev.map((attr, i) => 
      i === index ? { ...attr, ...updates } : attr
    ));
  };

  // Добавляем обработчик горячих клавиш
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!editorRef.current?.contains(e.target as Node)) return;

      const isCtrl = e.ctrlKey || e.metaKey;
      if (!isCtrl) return;

      // Преобразуем код клавиши в символ независимо от раскладки
      const keyMap: { [key: string]: string } = {
        'KeyB': 'b',
        'KeyI': 'i',
        'KeyK': 'k',
        'KeyL': 'l'
      };

      const key = keyMap[e.code];
      if (key) {
        e.preventDefault();
        
        // Создаем новое событие с английским символом
        const newEvent = new KeyboardEvent('keydown', {
          key: key,
          code: e.code,
          ctrlKey: true,
          metaKey: e.metaKey,
          bubbles: true,
          cancelable: true
        });
        
        e.target?.dispatchEvent(newEvent);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleAddAttribute = () => {
    if (!newAttribute.key || !newAttribute.value) {
      setError('Ключ и значение обязательны');
      return;
    }

    const attributeDef = availableAttributes.find(attr => attr.key === newAttribute.key);
    
    setAttributes(prev => [...prev, {
      key: newAttribute.key!,
      name: attributeDef?.name || newAttribute.key!,
      description: attributeDef?.description,
      value: newAttribute.value!
    }]);

    setNewAttribute({});
    setError(null);
  };

  const handleCreateNewAttribute = () => {
    if (!newAttribute.name || !newAttribute.value) {
      setError('Ключ, название и значение обязательны для нового атрибута');
      return;
    }

    setAttributes(prev => [...prev, {
      key: generateKey(newAttribute.name!),
      name: newAttribute.name!,
      description: newAttribute.description,
      value: newAttribute.value!
    }]);

    setNewAttribute({});
    setError(null);
  };

  const handleRemoveAttribute = (index: number) => {
    setAttributes(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
  
    try {
      const skillData = {
        name,
        description,
        attributes: attributes.map(attr => ({
          key: attr.key,
          name: attr.name,
          value: attr.value
        })),
        isSecret: secret
      };
  
      await onSave(skillData);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save skill');
    } finally {
      setLoading(false);
    }
  };
  

  // Функция рендеринга поля ввода для атрибута
  const renderAttributeValueInput = (attr: SkillAttribute, index: number, isNew: boolean = false) => {
    const attributeDef = availableAttributes.find(a => a.key === attr.key);
    const isFiltered = attributeDef?.isFiltered;
    const possibleValues = possibleValuesForFilteredAttributes[attr.key] || [];
    
    const currentValue = isNew ? newAttribute.value || '' : attr.value;
    const showCustomInput = customValues[attr.key] || 
                           (isFiltered && !possibleValues.includes(currentValue));

    if (isFiltered && possibleValues.length > 0) {
      return (
        <div className={modalStyles.attributeValueContainer}>
          <select
            value={showCustomInput ? '__custom__' : currentValue}
            onChange={(e) => {
              const newValue = e.target.value;
              
              if (newValue === '__custom__') {
                setCustomValues(prev => ({ ...prev, [attr.key]: currentValue || '' }));
                if (isNew) {
                  setNewAttribute(prev => ({ ...prev, value: '' }));
                } else {
                  handleUpdateAttribute(index, { value: '' });
                }
              } else {
                // Использовать выбранное значение
                setCustomValues(prev => {
                  const newCustom = { ...prev };
                  delete newCustom[attr.key];
                  return newCustom;
                });
                if (isNew) {
                  setNewAttribute(prev => ({ ...prev, value: newValue }));
                } else {
                  handleUpdateAttribute(index, { value: newValue });
                }
              }
            }}
            className={inputStyles.input}
          >
            {possibleValues.map(value => (
              <option key={value} value={value}>{value}</option>
            ))}
            <option value="__custom__">✏️ Ввести своё значение...</option>
          </select>

          {showCustomInput && (
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
          )}
        </div>
      );
    }
    return (
      <input
        type="text"
        value={currentValue}
        onChange={(e) => isNew
          ? setNewAttribute(prev => ({ ...prev, value: e.target.value }))
          : handleUpdateAttribute(index, { value: e.target.value })
        }
        className={inputStyles.input}
        placeholder="Значение"
        required={!isNew}
      />
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
            <div ref={editorRef} className={styles.editorContainer} data-color-mode={getEditorColorMode(themeConfig)}>
              <MDEditor
                value={description}
                onChange={(value) => setDescription(value || '')}
                preview="edit"
                height={300}
                style={{ width: '100%' }}
                textareaProps={{
                  lang: 'ru',
                  className: styles.markdownTextarea,
                  spellCheck: true
                }}
                previewOptions={{
                  disallowedElements: ['script', 'style']
                }}
              />
            </div>
            <div className={styles.markdownHint}>
              Поддерживает Markdown: **жирный**, *курсив*, `код`, списки и многое другое.
            </div>
          </div>
          <label>
              <input
                type="checkbox"
                checked={secret}
                className={inputStyles.input}
                onChange={(e) => setSecret(e.target.checked)}
              />
              Скрытый
            </label>
          <div className={modalStyles.attributesSection}>
            <h3>Атрибуты навыка</h3>
            
            {/* Список существующих атрибутов с возможностью редактирования */}
            {attributes.map((attr, index) => {
              const attributeDef = availableAttributes.find(a => a.key === attr.key);
              const isFiltered = attributeDef?.isFiltered;
              
              return (
                <div key={index} className={modalStyles.attributeItem}>
                  <div className={modalStyles.attributeContent}>
                    <div className={modalStyles.attributeHeader}>
                      <span className={modalStyles.attributeName}>{attr.name}</span>
                      {isFiltered && <span className={styles.filteredBadge}>🔍</span>}
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

            {/* Секция добавления нового атрибута */}
            <div className={modalStyles.addAttribute}>
              <h4>Добавить атрибут</h4>
              
              <select
                value={newAttribute.key || ''}
                onChange={(e) => {
                  const selected = availableAttributes.find(attr => attr.key === e.target.value);
                  setNewAttribute({
                    key: e.target.value,
                    name: selected?.name || '',
                    description: selected?.description,
                    value: ''
                  });
                }}
                className={inputStyles.input}
              >
                <option value="">Выберите атрибут</option>
                {availableAttributes.map(attr => (
                  <option key={attr.key} value={attr.key}>
                    {attr.name} ({attr.key}) {attr.isFiltered ? '🔍' : ''}
                  </option>
                ))}
              </select>

              {!newAttribute.key && (
                <>
                  <input
                    type="text"
                    value={newAttribute.name || ''}
                    onChange={(e) => setNewAttribute(prev => ({ ...prev, name: e.target.value }))}
                    className={inputStyles.input}
                    placeholder="Название нового атрибута"
                  />
                  <input
                    type="text"
                    value={newAttribute.description || ''}
                    onChange={(e) => setNewAttribute(prev => ({ ...prev, description: e.target.value }))}
                    className={inputStyles.input}
                    placeholder="Описание"
                  />
                </>
              )}

              {renderAttributeValueInput(newAttribute as SkillAttribute, -1, true)}

              <div className={modalStyles.attributeActions}>
                {newAttribute.key ? (
                  <button type="button" onClick={handleAddAttribute} className={buttonStyles.button}>
                    Добавить выбранный атрибут
                  </button>
                ) : (
                  <button type="button" onClick={handleCreateNewAttribute} className={buttonStyles.button}>
                    Создать новый атрибут
                  </button>
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
              {loading ? 'Сохранение...' : 'Сохранить'}
            </button>
          </div>
          </form>

  </ModalPortal>
  );
};

export default SkillModal;