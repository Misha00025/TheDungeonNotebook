import React from 'react';
import { useAuth } from '@tdn/shared';
import buttonStyles from '@tdn/shared/styles/components/Button.module.css';

const Login: React.FC = () => {
  const { login } = useAuth();
  return (
    <main style={{ display: 'grid', placeItems: 'center', minHeight: '100vh', background: 'var(--bg-primary)' }}>
      <section style={{ display: 'grid', gap: '1rem', width: 'min(100% - 2rem, 360px)', padding: '1.5rem', background: 'var(--bg-secondary)', borderRadius: 'var(--border-radius-md)' }}>
        <h2>Вход в The Dungeon Notebook</h2>
        <p>Вход и регистрация выполняются у провайдера учётных записей.</p>
        <button className={buttonStyles.button} type="button" onClick={() => login()}>Войти</button>
      </section>
    </main>
  );
};

export default Login;
