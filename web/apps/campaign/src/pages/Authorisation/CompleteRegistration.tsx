// src/pages/CompleteRegistration.tsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '@tdn/shared/auth/useAuth';
import { userAPI } from '../../services/api';
import { useCampaignNavigate } from '../../navigation';
import buttonStyles from '@tdn/shared/styles/components/Button.module.css';
import inputStyles from '@tdn/shared/styles/components/Input.module.css';
import commonStyles from '@tdn/shared/styles/common.module.css';
import modalStyles from '@tdn/shared/styles/modal.module.css';
import { useProfile } from '@tdn/shared/auth/useProfile';

const CompleteRegistration: React.FC = () => {
  const [nickname, setNickname] = useState('');
  const [visibleName, setVisibleName] = useState('');
  const [imageLink, setImageLink] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { accessToken } = useAuth();
  const { fetchProfile } = useProfile();
  const navigate = useCampaignNavigate();

  useEffect(() => {
    if (!accessToken) {
      navigate('/login', { replace: true });
    }
  }, [accessToken, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const profileData = {
        nickname,
        visibleName,
        imageLink: imageLink || undefined,
      };
      await userAPI.createProfile(profileData);
      await fetchProfile()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create profile');
    } finally {
      setLoading(false);
      window.location.reload();
    }
  };

  if (!accessToken) {
    return null;
  }

  return (
    <div className={commonStyles.container}>
      <h1>Завершение регистрации</h1>
      <p>Пожалуйста, создайте ваш профиль</p>

      {error && <div className={modalStyles.error}>{error}</div>}

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