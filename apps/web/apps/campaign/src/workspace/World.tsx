import React, { useEffect, useId, useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { ActionRow, Button, Field, IconButton, Input, List, NavigationListItem, PageHeader, StatePanel, TabBar, Toolbar } from '@tdn/shared';
import { useCampaignWorkspace } from './Shell';
import { useWorkspace } from './Workspace';
import Characters from './Characters';
import { useResource } from './hooks';
import { CampaignApiError } from './api';
import type { WorldKind, WorldMaterial, WorldMaterialBody } from './types';
import { CreateWorldMaterialPage, WorldErrorPanel, WorldMaterialDetail } from './WorldManagement';
import styles from './World.module.css';

const tabs = [
  { id: 'lore', label: 'Лор', path: 'lore' },
  { id: 'locations', label: 'Локации', path: 'locations' },
  { id: 'organizations', label: 'Организации', path: 'organizations' },
];
const getWorldTabs = (_mode: 'gm' | 'player') =>
  [...tabs, { id: 'characters', label: 'Персонажи', path: 'characters' }];

type WorldRouteState = {
  worldMaterial?: WorldMaterial;
  worldBody?: WorldMaterialBody;
  worldEditRequested?: boolean;
  worldMaterialId?: string;
  worldKind?: WorldKind;
  worldReturnTag?: string;
};

const World: React.FC<{ kind: WorldKind; materialId?: string; initialMaterial?: WorldMaterial; initialBody?: WorldMaterialBody }> = ({ kind, materialId, initialMaterial, initialBody }) => {
  const { groupId = '' } = useParams();
  const location = useLocation();
  const campaignId = Number(groupId);
  const { api, path, sessionKey, navigate } = useWorkspace();
  const { mode, permissions, permissionsLoading = false } = useCampaignWorkspace();
  const basePath = path(`/${campaignId}/${mode}/world`);
  const scope = `${sessionKey}:${campaignId}:${mode}:${kind}`;
  const canWrite = mode === 'gm' && permissions.canWrite && !permissionsLoading;
  const routeState = location.state as WorldRouteState | null;
  const hasEditIntent = Boolean(
    materialId
    && mode === 'gm'
    && routeState?.worldEditRequested
    && routeState.worldMaterialId === materialId
    && routeState.worldKind === kind,
  );
  const initialEditRequested = hasEditIntent && canWrite;

  useEffect(() => {
    if (!hasEditIntent || !materialId) return;
    const remainingState = { ...routeState };
    delete remainingState.worldEditRequested;
    delete remainingState.worldMaterialId;
    delete remainingState.worldKind;
    navigate(path(`/${campaignId}/${mode}/world/${kind}/${encodeURIComponent(materialId)}`), {
      replace: true,
      state: Object.keys(remainingState).length > 0 ? remainingState : null,
    });
  }, [campaignId, hasEditIntent, kind, materialId, mode, navigate, path, routeState]);

  return <>
    <PageHeader title="Мир" />
    <TabBar aria-label="Разделы мира" basePath={basePath} tabs={getWorldTabs(mode)} />
    {materialId === undefined
      ? <WorldList key={`${scope}:list`} campaignId={campaignId} kind={kind} mode={mode} scope={scope} canWrite={canWrite} permissionsLoading={permissionsLoading} initialTag={routeState?.worldReturnTag ?? ''} createdMaterial={routeState?.worldMaterial} />
      : <WorldMaterialDetail
          campaignId={campaignId}
          kind={kind}
          mode={mode}
          materialId={materialId}
          scope={scope}
          canWrite={canWrite}
          permissionsLoading={permissionsLoading}
          onBack={() => navigate(path(`/${campaignId}/${mode}/world/${kind}`))}
          initialMaterial={initialMaterial}
          initialBody={initialBody}
          initialEditRequested={initialEditRequested}
        />}
  </>;
};

export const WorldCharactersPage: React.FC = () => {
  const { groupId = '' } = useParams();
  const { path } = useWorkspace();
  const { mode } = useCampaignWorkspace();
  return <>
    <PageHeader title="Мир" />
    <TabBar aria-label="Разделы мира" basePath={path(`/${groupId}/${mode}/world`)} tabs={getWorldTabs(mode)} />
    <Characters worldTab />
  </>;
};

export const WorldCreatePage: React.FC<{
  campaignId: number;
  kind: WorldKind;
  sessionKey: string;
  canWrite: boolean;
  permissionsLoading: boolean;
  onCancel: () => void;
  onCreated: (material: WorldMaterial, body?: WorldMaterialBody) => void;
}> = ({ campaignId, kind, sessionKey, canWrite, permissionsLoading, onCancel, onCreated }) => {
  const { path } = useWorkspace();
  const { mode } = useCampaignWorkspace();
  const scope = `${sessionKey}:${campaignId}:${mode}:${kind}`;
  return <>
    <PageHeader title="Мир" subtitle="Создание материала" />
    <TabBar aria-label="Разделы мира" basePath={path(`/${campaignId}/${mode}/world`)} tabs={getWorldTabs(mode)} />
    <CreateWorldMaterialPage
      key={`${scope}:create`}
      campaignId={campaignId}
      kind={kind}
      scope={scope}
      canWrite={canWrite}
      permissionsLoading={permissionsLoading}
      onCancel={onCancel}
      onCreated={onCreated}
    />
  </>;
};

const WorldList: React.FC<{
  campaignId: number;
  kind: WorldKind;
  mode: 'gm' | 'player';
  scope: string;
  canWrite: boolean;
  permissionsLoading: boolean;
  initialTag: string;
  createdMaterial?: WorldMaterial;
}> = ({ campaignId, kind, mode, scope, canWrite, permissionsLoading, initialTag, createdMaterial }) => {
  const { api, path, navigate } = useWorkspace();
  const { reloadPermissions } = useCampaignWorkspace();
  const tagInputId = useId();
  const [tagDraft, setTagDraft] = useState(initialTag);
  const [tag, setTag] = useState(initialTag);
  const [createdFilterMismatch, setCreatedFilterMismatch] = useState(() =>
    createdMaterial && initialTag && !createdMaterial.tags.includes(initialTag) ? initialTag : '');
  const resource = useResource(`${scope}:list:${tag}`, () => api.listWorldMaterials(campaignId, kind, tag === '' ? undefined : tag));
  const entries = (resource.data ?? []).filter(item => mode !== 'player' || item.isPublished);

  useEffect(() => {
    if (resource.error instanceof CampaignApiError && resource.error.status === 403) reloadPermissions();
  }, [resource.error, reloadPermissions]);

  const clearTagFilter = () => {
    setTagDraft('');
    setTag('');
    setCreatedFilterMismatch('');
  };

  return <>
    {mode === 'gm' && permissionsLoading && <StatePanel kind="info">Проверяются права записи. Команды управления временно заблокированы.</StatePanel>}
    {mode === 'gm' && !permissionsLoading && !canWrite && <StatePanel kind="info">Право записи недоступно. Команды управления заблокированы.</StatePanel>}
    <Toolbar>
      <Field label="Точный тег" htmlFor={tagInputId}>
        <Input variant="single-line" id={tagInputId} value={tagDraft} onChange={event => setTagDraft(event.target.value)} />
      </Field>
      <ActionRow>
          <Button type="button" size="small" onClick={() => { setTag(tagDraft); setCreatedFilterMismatch(''); }}>Применить</Button>
          <Button type="button" size="small" variant="secondary" onClick={clearTagFilter}>Сбросить</Button>
          {mode === 'gm' && <Button type="button" size="small" disabled={!canWrite} onClick={() => navigate(path(`/${campaignId}/gm/world/${kind}/new`), { state: { worldReturnTag: tag } })}>Создать</Button>}
      </ActionRow>
    </Toolbar>
    {createdFilterMismatch && <StatePanel kind="info" actions={<ActionRow><Button type="button" size="small" onClick={clearTagFilter}>Сбросить фильтр</Button></ActionRow>}>
      Материал создан, но не соответствует активному точному тегу «{createdFilterMismatch}» и поэтому не показан.
    </StatePanel>}
    {resource.loading && !resource.data && <StatePanel kind="loading">Загрузка материалов мира…</StatePanel>}
    {resource.loading && resource.data && <StatePanel kind="loading">Обновление списка материалов мира…</StatePanel>}
    {resource.error && <WorldErrorPanel error={resource.error} onRetry={resource.reload} />}
    {resource.data && entries.length === 0 && <StatePanel kind="empty">Материалы не найдены.</StatePanel>}
    {resource.data && entries.length > 0 && <List aria-label="Материалы мира" layout="vertical" gap="small" stretch>
      {entries.map(item => <WorldListItem key={item.id} item={item} campaignId={campaignId} kind={kind} mode={mode} canWrite={canWrite} />)}
    </List>}
  </>;
};

const WorldListItem: React.FC<{
  item: WorldMaterial;
  campaignId: number;
  kind: WorldKind;
  mode: 'gm' | 'player';
  canWrite: boolean;
}> = ({ item, campaignId, kind, mode, canWrite }) => {
  const { path, navigate } = useWorkspace();

  const openEditor = () => navigate(path(`/${campaignId}/gm/world/${kind}/${encodeURIComponent(item.id)}`), {
    state: { worldEditRequested: true, worldMaterialId: item.id, worldKind: kind },
  });
  const actions = mode === 'gm' && canWrite
    ? <IconButton icon="edit" title="Редактировать" ariaLabel={`Редактировать: ${item.title}`} size="small" variant="ghost" onClick={openEditor} />
    : undefined;
  const detailPath = path(`/${campaignId}/${mode}/world/${kind}/${encodeURIComponent(item.id)}`);
  const tags = item.tags.map((label, index) => ({ key: `${index}:${label}`, label }));

  return <NavigationListItem
    accented={mode === 'gm' && item.isPublished}
    title={item.title}
    description={item.description}
    tags={tags}
    to={detailPath}
    actions={actions}
  />;
};

export default World;
