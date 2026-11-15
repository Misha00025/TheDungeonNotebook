import React from 'react';
import { useAuth } from '@tdn/shared';
import buttonStyles from '@tdn/shared/styles/components/Button.module.css';

const Login: React.FC = () => {
  const { login } = useAuth();
  return (
    <main style={{ display: 'grid', placeItems: 'center', minHeight: '100vh', background: 'var(--bg-primary)' }}>
      <section style={{ display: 'grid', justifyItems: 'center', gap: '1rem', width: 'min(100% - 2rem, 360px)', padding: '1.5rem', background: 'var(--bg-secondary)', borderRadius: 'var(--border-radius-md)' }}>
        <h2 style={{ textAlign: 'center' }}>Вы не авторизованы</h2>
        <button className={buttonStyles.button} type="button" onClick={() => login()}>Войти</button>
      </section>
    </main>
  );
};

export default Login;
