import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Button, Field, Input, List, ListItem, Notification, PageHeader, StatePanel, TabBar } from '@tdn/shared';
import { useCampaignWorkspace } from './Shell';
import { useWorkspace } from './Workspace';
import { useResource } from './hooks';
import { ApiError } from './Feedback';
import { CampaignApiError } from './api';
import { CreateWorldMaterialModal, WorldMaterialDetail } from './WorldManagement';
import type { WorldKind, WorldMaterial, WorldMaterialBody } from './types';
import styles from './World.module.css';

const tabs = [
  { id: 'locations', label: 'Локации', path: 'locations' },
  { id: 'organizations', label: 'Организации', path: 'organizations' },
  { id: 'lore', label: 'Лор', path: 'lore' },
];

const World: React.FC<{ kind: WorldKind; materialId?: string; initialMaterial?: WorldMaterial; initialBody?: WorldMaterialBody }> = ({ kind, materialId, initialMaterial, initialBody }) => {
  const { groupId = '' } = useParams();
  const campaignId = Number(groupId);
  const { api, path, sessionKey, navigate } = useWorkspace();
  const { mode, permissions, permissionsLoading = false } = useCampaignWorkspace();
  const basePath = path(`/${campaignId}/${mode}/world`);
  const scope = `${sessionKey}:${campaignId}:${mode}:${kind}`;
  const canWrite = mode === 'gm' && permissions.canWrite && !permissionsLoading;
  const listPath = path(`/${campaignId}/${mode}/world/${kind}`);
  const [creating, setCreating] = useState(false);
  const onCreated = (material: WorldMaterial, body?: WorldMaterialBody) => {
    setCreating(false);
    navigate(path(`/${campaignId}/${mode}/world/${kind}/${encodeURIComponent(material.id)}`), {
      state: { worldMaterial: material, ...(body ? { worldBody: body } : {}) },
    });
  };

  return <>
    <PageHeader title="Мир" actions={materialId === undefined && canWrite
      ? <Button type="button" size="small" onClick={() => setCreating(true)}>Создать</Button>
      : undefined} />
    <TabBar aria-label="Разделы мира" basePath={basePath} tabs={tabs} />
    {materialId === undefined && !creating && mode === 'gm' && permissionsLoading && <Notification kind="warning" eventKey={`${scope}:permissions-loading`}>Проверяются права записи. Команды управления временно заблокированы.</Notification>}
    {materialId === undefined && !creating && mode === 'gm' && !permissionsLoading && !permissions.canWrite && <Notification kind="warning" eventKey={`${scope}:read-only`}>Право записи недоступно. Команды управления заблокированы.</Notification>}
    {materialId === undefined
      ? <WorldList key={`${scope}:list`} campaignId={campaignId} kind={kind} mode={mode} scope={scope} />
      : <WorldMaterialDetail campaignId={campaignId} kind={kind} mode={mode} materialId={materialId} scope={scope} canWrite={canWrite} permissionsLoading={permissionsLoading} onBack={() => navigate(listPath)} initialMaterial={initialMaterial} initialBody={initialBody} />}
    {materialId === undefined && creating && <CreateWorldMaterialModal key={`${scope}:create`} campaignId={campaignId} kind={kind} scope={scope} canWrite={canWrite} permissionsLoading={permissionsLoading} onClose={() => setCreating(false)} onCreated={onCreated} />}
  </>;
};

const WorldList: React.FC<{ campaignId: number; kind: WorldKind; mode: 'gm' | 'player'; scope: string }> = ({ campaignId, kind, mode, scope }) => {
  const { api, path } = useWorkspace();
  const { reloadPermissions } = useCampaignWorkspace();
  const [tagDraft, setTagDraft] = useState('');
  const [tag, setTag] = useState('');
  const resource = useResource(`${scope}:list:${tag}`, () => api.listWorldMaterials(campaignId, kind, tag === '' ? undefined : tag));
  const entries = (resource.data ?? []).filter(item => mode !== 'player' || item.isPublished);
  useEffect(() => {
    if (resource.error instanceof CampaignApiError && resource.error.status === 403) reloadPermissions();
  }, [resource.error, reloadPermissions]);

  return <section className={styles.section}>
    <>
      <form className={styles.filters} onSubmit={event => { event.preventDefault(); setTag(tagDraft); }}>
        <Field label="Точный тег" htmlFor="world-tag-filter">
          <Input variant="single-line" id="world-tag-filter" value={tagDraft} onChange={event => setTagDraft(event.target.value)} />
        </Field>
        <div className={styles.actions}>
          <Button type="submit" size="small">Применить</Button>
          <Button type="button" size="small" variant="secondary" onClick={() => { setTagDraft(''); setTag(''); }}>Сбросить</Button>
        </div>
      </form>
      {resource.loading && !resource.data && <StatePanel kind="loading">Загрузка материалов мира…</StatePanel>}
      {resource.error && <ApiError error={resource.error} onRetry={resource.reload} />}
      {resource.data && entries.length === 0 && <StatePanel kind="empty">Материалы не найдены.</StatePanel>}
      {resource.data && entries.length > 0 && <List aria-label="Материалы мира">
        {entries.map(item => <WorldListItem key={item.id} item={item} mode={mode} to={path(`/${campaignId}/${mode}/world/${kind}/${encodeURIComponent(item.id)}`)} />)}
      </List>}
    </>
  </section>;
};

const WorldListItem: React.FC<{ item: WorldMaterial; mode: 'gm' | 'player'; to: string }> = ({ item, mode, to }) => <ListItem>
  <article className={styles.materialCard}>
    <h2>{item.title}</h2>
    {item.description && <p className={styles.longText}>{item.description}</p>}
    {item.tags.length > 0 && <ul className={styles.tags}>{item.tags.map((tag, index) => <li key={`${index}:${tag}`}>{tag}</li>)}</ul>}
    {mode === 'gm' && <p>{item.isPublished ? 'Открыт игрокам' : 'Закрыт'}</p>}
    <Link to={to}>Читать</Link>
  </article>
</ListItem>;

export default World;
