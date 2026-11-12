// Profile.tsx
import React, { useEffect, useState } from 'react';
import { useProfile } from '@tdn/shared/auth/useProfile';
import { userAPI } from '@tdn/shared';
import buttonStyles from '@tdn/shared/styles/components/Button.module.css';
import inputStyles from '@tdn/shared/styles/components/Input.module.css';
import styles from '@tdn/shared/styles/common.module.css';
import { useAuth } from '@tdn/shared/auth/AuthContext';
import { uploadAPI } from '../services/api';

const Profile: React.FC = () => {
  const { profile, loading, error, fetchProfile } = useProfile();
  const { logout } = useAuth();
  
  const [editMode, setEditMode] = useState(false);
  const [formData, setFormData] = useState({
    visibleName: '',
    imageLink: ''
  });
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  useEffect(() => {
    fetchProfile();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Инициализируем форму данными профиля
  useEffect(() => {
    if (profile) {
      setFormData({
        visibleName: profile.visibleName,
        imageLink: profile.imageLink || ''
      });
    }
  }, [profile]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Проверка типа файла
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/bmp', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      alert('Недопустимый формат файла. Разрешены: JPEG, PNG, GIF, BMP, WebP.');
      return;
    }

    // Проверка размера файла (например, максимум 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('Файл слишком большой. Максимальный размер: 5MB.');
      return;
    }

    setUploadingImage(true);
    try {
      const uploadResult = await uploadAPI.uploadImage(file);
      setFormData(prev => ({ ...prev, imageLink: uploadResult.url }));
    } catch (error) {
      alert('Ошибка загрузки изображения');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSave = async () => {
    if (!profile) return;

    setSaving(true);
    try {
      await userAPI.updateProfile(profile.id, {
        visibleName: formData.visibleName,
        imageLink: formData.imageLink || undefined
      });
      await fetchProfile(); // Обновляем данные профиля
      setEditMode(false);
    } catch (error) {
      alert('Ошибка сохранения профиля');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    if (profile) {
      setFormData({
        visibleName: profile.visibleName,
        imageLink: profile.imageLink || ''
      });
    }
    setEditMode(false);
  };

  const removeAvatar = () => {
    setFormData(prev => ({ ...prev, imageLink: 'none' }));
  };

  if (loading) return <div className={styles.container}>Загрузка...</div>;
  if (error) return <div className={styles.container}>Ошибка: {error}</div>;

  return (
    <div className={styles.container}>
      <h1>Профиль пользователя</h1>
      
      {profile && (
        <div className={styles.profile}>
          {/* Аватар */}
          <div className={styles.avatarSection}>
            {formData.imageLink ? (
              <img 
                src={formData.imageLink} 
                alt="Аватар" 
                className={styles.avatar}
              />
            ) : (
              <div className={styles.avatarPlaceholder}>
                Нет аватара
              </div>
            )}
            
            {editMode && (
              <div className={styles.uploadSection}>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  disabled={uploadingImage}
                  className={styles.fileInput}
                />
                {formData.imageLink && (
                  <button 
                    type="button" 
                    onClick={removeAvatar}
                    className={buttonStyles.button}
                    style={{backgroundColor: 'var(--danger-color)', fontSize: '0.8rem', padding: '0.5rem 1rem'}}
                  >
                    Удалить аватар
                  </button>
                )}
                {uploadingImage && <div className={styles.uploadStatus}>Загрузка изображения...</div>}
              </div>
            )}
          </div>

          {/* Информация */}
          <div className={styles.info}>
            <div className={styles.field}>
              <strong>ID:</strong> {profile.id}
            </div>
            <div className={styles.field}>
              <strong>Никнейм:</strong> {profile.nickname}
            </div>
            
            {editMode ? (
              <div className={styles.formGroup}>
                <label htmlFor="visibleName">Видимое имя:</label>
                <input
                  id="visibleName"
                  type="text"
                  name="visibleName"
                  value={formData.visibleName}
                  onChange={handleInputChange}
                  className={inputStyles.input}
                  placeholder="Введите видимое имя"
                />
              </div>
            ) : (
              <div className={styles.field}>
                <strong>Видимое имя:</strong> {profile.visibleName}
              </div>
            )}
          </div>
        </div>
      )}

      <div className={styles.footer}>
        {editMode ? (
          <>
            <button 
              className={buttonStyles.button} 
              onClick={handleSave}
              disabled={saving || uploadingImage}
            >
              {saving ? 'Сохранение...' : 'Сохранить'}
            </button>
            <button 
              className={buttonStyles.button} 
              onClick={handleCancel}
              disabled={saving}
              style={{backgroundColor: 'var(--text-secondary)'}}
            >
              Отмена
            </button>
          </>
        ) : (
          <>
            <button 
              className={buttonStyles.button} 
              onClick={() => setEditMode(true)}
            >
              Редактировать профиль
            </button>
            <button 
              className={buttonStyles.button} 
              onClick={logout}
              style={{backgroundColor: 'var(--danger-color)'}}
            >
              Выйти
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default Profile;
