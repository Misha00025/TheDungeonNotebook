import React, { useState, useEffect } from 'react';
import { TemplateField } from '../../../../../types/characterTemplates';
import buttonStyles from '@tdn/shared/styles/components/Button.module.css';
import inputStyles from '@tdn/shared/styles/components/Input.module.css';
import modalStyles from '@tdn/shared/styles/modal.module.css';
import uiStyles from '@tdn/shared/styles/ui.module.css';
import ModalPortal from '@tdn/shared/ui/ModalPortal/ModalPortal';

interface TemplateFieldModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (field: TemplateField, fieldKey: string) => void;
  field: TemplateField | null;
  fieldKey: string;
  title: string;
  fullEditMode?: boolean;
}

const TemplateFieldModal: React.FC<TemplateFieldModalProps> = ({
  isOpen,
  onClose,
  onSave,
  field,
  fieldKey,
  title,
  fullEditMode = true
}) => {
  const [name, setName] = useState('');
  const [value, setValue] = useState<number | ''>(0);
  const [maxValue, setMaxValue] = useState<number | ''>(0);
  const [formula, setFormula] = useState('');
  const [modifierFormula, setModifierFormula] = useState<string>(':value:');
  const [isProperty, setIsProperty] = useState<boolean>(false);
  const [isModifier, setIsModifier] = useState<boolean>(false);
  const [description, setDescription] = useState('');
  const [key, setKey] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Функция для генерации ключа на основе названия поля
  const generateFieldKey = (fieldName: string): string => {
    return fieldName
      .toLowerCase()
      .replace(/\s+/g, '_')
      .replace(/[^a-zа-я0-9_]/g, '');
  };

  // Заполняем форму данными при открытии
  useEffect(() => {
    if (field) {
      setName(field.name);
      setValue(field.value);
      setFormula(field.formula ? field.formula : '');
      setMaxValue(field.maxValue ? field.maxValue : 0);
      setIsProperty(field.maxValue ? true : false);
      setIsModifier(field.modifierFormula ? true : false);
      setDescription(field.description);
      setKey(generateFieldKey(field.name));
    } else {
      // Сброс формы при создании нового поля
      setName('');
      setValue(0);
      setMaxValue(0);
      setIsProperty(false);
      setIsModifier(false);
      setFormula('');
      setDescription('');
      setKey('');
    }
  }, [field, fieldKey, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      setError('Название поля обязательно');
      return;
    }

    if (!key.trim()) {
      setError('Ключ поля обязателен');
      return;
    }

    const fieldData: TemplateField = {
      name,
      value: value === ''? 0 : value,
      description,
      formula
    };

    if (isProperty)
      fieldData.maxValue = maxValue === ''? 0 : maxValue;
    if (isModifier)
      fieldData.modifierFormula = modifierFormula;

    onSave(fieldData, key);
    onClose();
  };

  const handleGenerateKey = () => {
    const generatedKey = generateFieldKey(name);
    setKey(generatedKey);
  };

  const handleChangeMaxValue = (event: React.ChangeEvent<HTMLInputElement>) => {
    const result = event.target.value === ''? '' : Number(event.target.value);
    if (value === maxValue)
      setValue(result);
    setMaxValue(result);
  }

  const handleBlurMaxValue = (event: React.ChangeEvent<HTMLInputElement>) => {
    const result = event.target.value === ''? 0 : Number(event.target.value);
    if (value === maxValue)
      setValue(result);
    setMaxValue(result);
  }

  return (
    <ModalPortal isOpen={isOpen} onClose={onClose}>
      <h2>{title}</h2>
      <form onSubmit={handleSubmit}>
      <div className={modalStyles.modalBody}>
      
      {error && <div className={modalStyles.error}>{error}</div>}
      

        {(fullEditMode &&
          <>
            <div className={modalStyles.formGroup}>
              <label>Название поля:</label>
              <input
                type="text"
                value={name}
                onChange={(e) => { setName(e.target.value); setKey(generateFieldKey(e.target.value)) }}
                onBlur={handleGenerateKey}
                className={inputStyles.input}
                required
              />
            </div>
            <div className={modalStyles.formGroup}>
              <label>Ключ поля:</label>
              <div className={uiStyles.keyInputGroup}>
                <input
                  type="text"
                  value={key}
                  onChange={(e) => setKey(e.target.value)}
                  className={inputStyles.input}
                  required
                />
                <button 
                  type="button" 
                  onClick={handleGenerateKey}
                  className={buttonStyles.button}
                >
                  Сгенерировать
                </button>
              </div>
              <small className={modalStyles.helpText}>
                Ключ будет использоваться в системе (только латинские буквы, цифры и _)
              </small>
            </div>
          </>
        )}
        <div className={modalStyles.formGroup}>
          <label>Формула:</label>
          <input
            type="text"
            value={formula}
            onChange={(e) => setFormula(e.target.value)}
            className={inputStyles.input}
          />
        </div>

        {fullEditMode && <div className={modalStyles.formGroup}>
          <label>Значение по умолчанию:</label>
          <input
            type="number"
            value={value}
            onChange={(e) => setValue(e.target.value === ''? '' : Number(e.target.value))}
            onBlur={(e) => setValue(e.target.value === ''? 0 : Number(e.target.value))}
            className={inputStyles.input}
            required
          />
        </div>}

        {fullEditMode &&
          <>
            {!isModifier && <div className={modalStyles.formGroup}>
              <label>
                <input
                  type="checkbox"
                  checked={isProperty}
                  className={inputStyles.input}
                  onChange={(e) => setIsProperty(e.target.checked)}
                />
                Поле с максимальным значением
              </label>
            </div>}

            {!isProperty && <div className={modalStyles.formGroup}>
              <label>
                <input
                  type="checkbox"
                  checked={isModifier}
                  className={inputStyles.input}
                  onChange={(e) => setIsModifier(e.target.checked)}
                />
                Поле с модификатором
              </label>
            </div>}
          </>
        }

        { isProperty && (
          <div className={modalStyles.formGroup}>
            <label>Максимальное значение по умолчанию:</label>
            <input
              type="number"
              value={maxValue}
              onChange={(e) => handleChangeMaxValue(e)}
              onBlur={(e) => handleBlurMaxValue(e)}
              className={inputStyles.input}
              required
            />
          </div>
        )}

        {isModifier && (
          <div className={modalStyles.formGroup}>
            <label>Формула модификатора:</label>
            <input
              type='text'
              value={modifierFormula}
              onChange={(e) => setModifierFormula(e.target.value)}
              className={inputStyles.input}
            />
          </div>
        )}
        {fullEditMode && <div className={modalStyles.formGroup}>
          <label>Описание поля:</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className={inputStyles.input}
            rows={3}
          />
        </div>}

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

export default TemplateFieldModal;