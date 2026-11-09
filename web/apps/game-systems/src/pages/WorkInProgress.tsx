import React from 'react';
import { useLocation } from 'react-router-dom';
import styles from '@tdn/shared/styles/common.module.css';

// Универсальная заглушка для ещё не реализованных разделов «Игровых систем».
const WorkInProgress: React.FC = () => {
  const location = useLocation();
  return (
    <div className={styles.container} style={{ padding: '2rem' }}>
      <h2>Раздел в разработке</h2>
      <p>Маршрут <code>{location.pathname}</code> — скелет приложения «Игровые системы».</p>
      <p>Наполнение (системы, контент, версии, правила) появится в следующих итерациях.</p>
    </div>
  );
};

export default WorkInProgress;
