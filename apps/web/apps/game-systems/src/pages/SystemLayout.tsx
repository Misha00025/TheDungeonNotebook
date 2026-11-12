import React from 'react';
import { useParams, Outlet } from 'react-router-dom';
import TabBar from '@tdn/shared/ui/PageLayout/TabBar';
import type { TabItem } from '@tdn/shared/ui/PageLayout/TabBar';
import { useGameSystemsPath } from '../navigation';

// Layout конкретной системы: вкладки контент/версии/правила вложены в систему.
// Не использует PageLayout (чтобы не дублировать кнопку меню из AppLayout).
// Внутренняя навигация относительна к корню приложения (useGameSystemsPath).
const SystemLayout: React.FC = () => {
  const { systemId } = useParams<{ systemId: string }>();
  const gameSystemsPath = useGameSystemsPath();

  const tabs: TabItem[] = [
    { id: 'content', label: 'Контент', path: 'content' },
    { id: 'versions', label: 'Версии', path: 'versions' },
    { id: 'rules', label: 'Правила', path: 'rules' },
  ];

  return (
    <div>
      <TabBar tabs={tabs} basePath={gameSystemsPath(`/systems/${systemId}`)} />
      <Outlet />
    </div>
  );
};

export default SystemLayout;
