import React, { useState } from 'react';
import { Notification } from '@tdn/shared';
import { useAuth } from '@tdn/shared/auth/useAuth';
import { userAPI } from '../../services/api';
import buttonStyles from '@tdn/shared/styles/components/Button.module.css';
import inputStyles from '@tdn/shared/styles/components/Input.module.css';
import commonStyles from '@tdn/shared/styles/common.module.css';

type CompleteRegistrationProps = { onCompleted: () => Promise<void> };

const CompleteRegistration: React.FC<CompleteRegistrationProps> = ({ onCompleted }) => {
  const [nickname, setNickname] = useState('');
  const [visibleName, setVisibleName] = useState('');
  const [imageLink, setImageLink] = useState('');
  const [loading, setLoading] = useState(false);
  const [created, setCreated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { authenticated, userId } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (!created) {
        const profileData = {
          nickname,
          visibleName,
          imageLink: imageLink || undefined,
        };
        await userAPI.createProfile(profileData);
        setCreated(true);
      }
      await onCompleted();
    } catch {
      setError('Не удалось создать или обновить профиль. Попробуйте ещё раз.');
    } finally {
      setLoading(false);
    }
  };

  if (!authenticated || userId === null) return null;

  return (
    <div className={commonStyles.container}>
      <h1>Профиль The Dungeon Notebook</h1>
      <p>Создайте профиль, чтобы продолжить.</p>

      {error && <Notification kind="error" eventKey={error}>{error}</Notification>}

      <form onSubmit={handleSubmit} className={commonStyles.form}>
        <div className={commonStyles.formGroup}>
          <label>Никнейм:</label>
          <input
            type="text"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            className={inputStyles.input}
            required
          />
        </div>

        <div className={commonStyles.formGroup}>
          <label>Видимое имя:</label>
          <input
            type="text"
            value={visibleName}
            onChange={(e) => setVisibleName(e.target.value)}
            className={inputStyles.input}
            required
          />
        </div>

        <div className={commonStyles.formGroup}>
          <label>Ссылка на изображение (опционально):</label>
          <input
            type="text"
            value={imageLink}
            onChange={(e) => setImageLink(e.target.value)}
            className={inputStyles.input}
          />
        </div>

        <div className={commonStyles.formActions}>
          <button type="submit" className={buttonStyles.button} disabled={loading}>
            {loading ? 'Создание...' : 'Создать профиль'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default CompleteRegistration;
