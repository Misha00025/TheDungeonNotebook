import React from 'react';
import { Outlet, useParams } from 'react-router-dom';
import { PageHeader, TabBar } from '@tdn/shared';
import { useWorkspace } from './Workspace';

const CampaignManagement: React.FC = () => {
  const { groupId = '' } = useParams();
  const { path } = useWorkspace();
  const basePath = path(`/${groupId}/gm`);

  return <>
    <PageHeader title="Управление" />
    <TabBar
      basePath={basePath}
      aria-label="Управление кампанией"
      tabs={[
        { id: 'general', label: 'Общее', path: 'settings' },
        { id: 'members', label: 'Участники', path: 'settings/members' },
        { id: 'export', label: 'Экспорт', path: 'settings/export' },
      ]}
    />
    <Outlet />
  </>;
};

export default CampaignManagement;
