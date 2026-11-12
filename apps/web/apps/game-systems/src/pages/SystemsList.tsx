import React from 'react';
import styles from '@tdn/shared/styles/common.module.css';

// Список игровых систем (заглушка — наполнение в 3.6+).
const SystemsList: React.FC = () => {
  return (
    <div className={styles.container} style={{ padding: '2rem' }}>
      <h2>Системы</h2>
      <p>Список игровых систем появится в следующих итерациях.</p>
    </div>
  );
};

export default SystemsList;
