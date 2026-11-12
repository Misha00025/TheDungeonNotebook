import React from 'react';
import { useAuth } from '@tdn/shared';
import { useTheme } from '@tdn/shared';
import buttonStyles from '@tdn/shared/styles/components/Button.module.css';
import inputStyles from '@tdn/shared/styles/components/Input.module.css';
import modalStyles from '@tdn/shared/styles/modal.module.css';
import { useProfileNavigate } from '../navigation';

// Страница входа — переиспользует общий AuthContext из @tdn/shared.
// Внутренняя навигация относительна к корню приложения (useProfileNavigate).
const Login: React.FC = () => {
  const [username, setUsername] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const { login } = useAuth();
  const navigate = useProfileNavigate();
  const { setPreset } = useTheme();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await login(username, password);
      navigate('/profile', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        background: 'var(--bg-primary)',
      }}
    >
      <form
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
          width: '100%',
          maxWidth: '360px',
          backgroundColor: 'var(--bg-secondary)',
          padding: '1.5rem',
          borderRadius: 'var(--border-radius-md)',
        }}
        onSubmit={handleSubmit}
      >
        <h2 style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          Вход в систему
        </h2>

        {error && <div className={modalStyles.error}>{error}</div>}

        <input
          className={inputStyles.input}
          type="text"
          placeholder="Имя пользователя"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
        />
        <input
          className={inputStyles.input}
          type="password"
          placeholder="Пароль"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        <button className={buttonStyles.button} type="submit" disabled={loading}>
          {loading ? 'Загрузка...' : 'Войти'}
        </button>

        <button
          type="button"
          className={buttonStyles.button}
          onClick={() => setPreset('dark')}
          style={{ marginTop: '0.5rem' }}
        >
          Переключить тему (dark)
        </button>
      </form>
    </div>
  );
};

export default Login;
