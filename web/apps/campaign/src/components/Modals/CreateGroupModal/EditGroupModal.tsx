// EditGroupModal.tsx
import React, { useState, useEffect } from 'react';
import { Group } from '../../../types/group';
import { groupAPI, uploadAPI } from '../../../services/api';
import buttonStyles from '@tdn/shared/styles/components/Button.module.css';
import inputStyles from '@tdn/shared/styles/components/Input.module.css';
import modalStyles from '@tdn/shared/styles/modal.module.css';
import ModalPortal from '@tdn/shared/ui/ModalPortal/ModalPortal';

interface EditGroupModalProps {
  group: Group;
  isOpen: boolean;
  onClose: () => void;
  onGroupUpdated: (group: Group) => void;
}

const EditGroupModal: React.FC<EditGroupModalProps> = ({ 
  group, 
  isOpen, 
  onClose, 
  onGroupUpdated 
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [icon, setIcon] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Инициализируем форму данными группы
  useEffect(() => {
    if (group) {
      setName(group.name);
      setIcon(group.icon || '');
    }
  }, [group]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Проверка типа файла
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/bmp', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      alert('Недопустимый формат файла. Разрешены: JPEG, PNG, GIF, BMP, WebP.');
      return;
    }

    // Проверка размера файла (максимум 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('Файл слишком большой. Максимальный размер: 5MB.');
      return;
    }

    setUploadingImage(true);
    try {
      const uploadResult = await uploadAPI.uploadImage(file);
      setIcon(uploadResult.url);
    } catch (error) {
      alert('Ошибка загрузки изображения');
    } finally {
      setUploadingImage(false);
    }
  };

  const removeIcon = () => {
    setIcon('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!group) return;

    setLoading(true);
    setError(null);

    try {
      const groupData = {
        name,
        description: description || undefined,
        icon: icon || undefined,
      };
      
      const updatedGroup = await groupAPI.updateGroup(group.id, groupData);
      onGroupUpdated(updatedGroup);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update group');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    // Восстанавливаем исходные данные
    if (group) {
      setName(group.name);
      setIcon(group.icon || '');
    }
    onClose();
  };


  return (
    <ModalPortal isOpen={isOpen} onClose={onClose}>
        
        <h2>Редактировать группу</h2>
        <form onSubmit={handleSubmit}>
        <div className={modalStyles.modalBody}>
        
        {error && <div className={modalStyles.error}>{error}</div>}
        
          {/* Секция иконки группы */}
          <div className={modalStyles.formGroup}>
            <label>Иконка группы:</label>
            <div className={modalStyles.iconSection}>
              {icon ? (
                <div className={modalStyles.iconPreview}>
                  <img src={icon} alt="Иконка группы" className={modalStyles.iconImage} />
                  <button 
                    type="button" 
                    onClick={removeIcon}
                    className={buttonStyles.button}
                    style={{backgroundColor: 'var(--danger-color)', fontSize: '0.8rem', padding: '0.5rem 1rem'}}
                  >
                    Удалить
                  </button>
                </div>
              ) : (
                <div className={modalStyles.iconPlaceholder}>
                  Нет иконки
                </div>
              )}
              
              <input
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                disabled={uploadingImage}
                className={modalStyles.fileInput}
              />
              {uploadingImage && <div className={modalStyles.uploadStatus}>Загрузка изображения...</div>}
            </div>
          </div>

          <div className={modalStyles.formGroup}>
            <label>Название группы:</label>
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
            />
          </div>

          <div className={modalStyles.formGroup}>
            <label>ID группы:</label>
            <div className={modalStyles.readOnlyField}>{group.id}</div>
          </div>
          
          </div>
          <div className={modalStyles.buttons}>
            <button 
              type="button" 
              onClick={handleCancel} 
              className={buttonStyles.button}
              disabled={loading}
            >
              Отмена
            </button>
            <button 
              type="submit" 
              className={buttonStyles.button} 
              disabled={loading || uploadingImage}
            >
              {loading ? 'Сохранение...' : 'Сохранить'}
            </button>
          </div>
          </form>

  </ModalPortal>
  );
};

export default EditGroupModal;