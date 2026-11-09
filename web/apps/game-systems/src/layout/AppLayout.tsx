import React from 'react';
import { Outlet } from 'react-router-dom';
import PageLayout from '@tdn/shared/ui/PageLayout/PageLayout';
import PageHeader from '@tdn/shared/ui/PageLayout/PageHeader';

// Общий layout для авторизованных разделов «Игровых систем».
// Собственной навигации/панели нет — её передаёт хаб (host). PageLayout
// рендерит панель только при переданном navItems, поэтому здесь он не
// передаётся (см. apps/campaign — тот же подход).
const AppLayout: React.FC = () => {
  return (
    <PageLayout
      breadcrumbs={[{ label: 'Игровые системы' }]}
      header={<PageHeader title="Игровые системы" />}
      tabs={[]}
      tabBasePath=""
    >
      <Outlet />
    </PageLayout>
  );
};

export default AppLayout;
