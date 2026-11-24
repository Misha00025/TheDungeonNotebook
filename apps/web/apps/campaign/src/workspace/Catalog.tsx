import React from 'react';
import { useParams } from 'react-router-dom';
import { PageHeader, TabBar } from '@tdn/shared';
import { useWorkspace } from './Workspace';
import { useCampaignWorkspace } from './Shell';
import CatalogBrowser, { CatalogAttributeValuesEditor } from './CatalogBrowser';
import type { CatalogKind } from './catalogTypes';

export { CatalogAttributeValuesEditor };

const Catalog: React.FC<{ kind?: CatalogKind }> = ({ kind = 'Item' }) => {
  const { groupId = '' } = useParams();
  const campaignId = Number(groupId);
  const { path } = useWorkspace();
  const { mode, permissions, permissionsLoading, reloadPermissions } = useCampaignWorkspace();
  const canManage = mode === 'gm' && !permissionsLoading && permissions.canWrite;
  return <>
    <PageHeader title="Каталог" subtitle="Предметы и навыки кампании" />
    <TabBar aria-label="Разделы каталога" basePath={path(`/${campaignId}/${mode}/catalog`)} tabs={[{ id: 'items', label: 'Предметы', path: 'items' }, { id: 'skills', label: 'Навыки', path: 'skills' }]} />
    <CatalogBrowser key={`${campaignId}:${mode}:${kind}`} campaignId={campaignId} kind={kind} audience={mode} canManage={canManage} permissionsPending={permissionsLoading} onForbidden={reloadPermissions} />
  </>;
};

export default Catalog;
