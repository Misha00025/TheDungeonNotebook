import React from 'react';
import { useParams } from 'react-router-dom';
import styles from '@tdn/shared/styles/common.module.css';

// Обзор конкретной системы (заглушка — наполнение в 3.6+).
const SystemOverview: React.FC = () => {
  const { systemId } = useParams<{ systemId: string }>();
  return (
    <div className={styles.container} style={{ padding: '2rem' }}>
      <h2>Система {systemId}</h2>
      <p>Обзор системы появится в следующих итерациях.</p>
    </div>
  );
};

export default SystemOverview;
