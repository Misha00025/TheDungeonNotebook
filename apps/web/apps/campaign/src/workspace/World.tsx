import React, { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import { Button, Field, Input, List, ListItem, PageHeader, StatePanel, TabBar } from '@tdn/shared';
import { useCampaignWorkspace } from './Shell';
import { useWorkspace } from './Workspace';
import { useResource } from './hooks';
import { ApiError } from './Feedback';
import { CampaignApiError } from './api';
import type { WorldKind, WorldMaterial } from './types';
import styles from './World.module.css';

const tabs = [
  { id: 'locations', label: 'Локации', path: 'locations' },
  { id: 'organizations', label: 'Организации', path: 'organizations' },
  { id: 'lore', label: 'Лор', path: 'lore' },
];

const isNotFound = (error: unknown) => error instanceof CampaignApiError && error.status === 404;

const World: React.FC<{ kind: WorldKind; materialId?: string }> = ({ kind, materialId }) => {
  const { groupId = '' } = useParams();
  const campaignId = Number(groupId);
  const { api, path, sessionKey } = useWorkspace();
  const { mode } = useCampaignWorkspace();
  const basePath = path(`/${campaignId}/${mode}/world`);
  const scope = `${sessionKey}:${campaignId}:${mode}:${kind}`;

  return <>
    <PageHeader title="Мир" />
    <TabBar aria-label="Разделы мира" basePath={basePath} tabs={tabs} />
    {materialId === undefined
      ? <WorldList key={`${scope}:list`} campaignId={campaignId} kind={kind} mode={mode} scope={scope} />
      : <WorldDetail campaignId={campaignId} kind={kind} mode={mode} materialId={materialId} scope={scope} />}
  </>;
};

const WorldList: React.FC<{ campaignId: number; kind: WorldKind; mode: 'gm' | 'player'; scope: string }> = ({ campaignId, kind, mode, scope }) => {
  const { api, path } = useWorkspace();
  const [tagDraft, setTagDraft] = useState('');
  const [tag, setTag] = useState('');
  const resource = useResource(`${scope}:list:${tag}`, () => api.listWorldMaterials(campaignId, kind, tag === '' ? undefined : tag));
  const entries = (resource.data ?? []).filter(item => mode !== 'player' || item.isPublished);

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
    {item.tags.length > 0 && <ul className={styles.tags}>{item.tags.map(tag => <li key={tag}>{tag}</li>)}</ul>}
    {mode === 'gm' && <p>{item.isPublished ? 'Открыт игрокам' : 'Закрыт'}</p>}
    <Link to={to}>Читать</Link>
  </article>
</ListItem>;

const WorldDetail: React.FC<{ campaignId: number; kind: WorldKind; mode: 'gm' | 'player'; materialId: string; scope: string }> = ({ campaignId, kind, mode, materialId, scope }) => {
  const { api } = useWorkspace();
  const metadata = useResource(`${scope}:material:${materialId}`, () => api.getWorldMaterial(campaignId, kind, materialId));
  const bodyAllowed = Boolean(metadata.data && (mode === 'gm' || metadata.data.isPublished));
  const body = useResource(`${scope}:body:${materialId}`, () => api.getWorldBody(campaignId, kind, materialId), bodyAllowed);
  const unavailable = mode === 'player' && metadata.data && !metadata.data.isPublished;

  if (metadata.loading && !metadata.data) return <StatePanel kind="loading">Загрузка материала…</StatePanel>;
  if (metadata.error && !metadata.data) {
    return isNotFound(metadata.error)
      ? <StatePanel kind="empty" actions={<Button type="button" size="small" onClick={metadata.reload}>Повторить загрузку</Button>}>Материал недоступен или не найден</StatePanel>
      : <ApiError error={metadata.error} onRetry={metadata.reload} />;
  }
  if (!metadata.data) return <StatePanel kind="empty">Материал недоступен или не найден</StatePanel>;
  if (unavailable) return <StatePanel kind="empty">Материал недоступен или не найден</StatePanel>;

  const item = metadata.data;
  return <article className={styles.detail}>
    <>
      <h2 className={styles.longText}>{item.title}</h2>
      {item.description && <p className={styles.longText}>{item.description}</p>}
      {item.tags.length > 0 && <ul className={styles.tags}>{item.tags.map(tag => <li key={tag}>{tag}</li>)}</ul>}
      {mode === 'gm' && <p>{item.isPublished ? 'Открыт игрокам' : 'Закрыт'}</p>}
      {body.loading && !body.data && <StatePanel kind="loading">Загрузка текста материала…</StatePanel>}
      {body.error && (isNotFound(body.error)
        ? <StatePanel kind="empty" actions={<Button type="button" size="small" onClick={body.reload}>Повторить загрузку</Button>}>Материал недоступен или не найден</StatePanel>
        : <ApiError error={body.error} onRetry={body.reload} />)}
      {body.data && <div className={`${styles.markdown} ${styles.longText}`}><ReactMarkdown>{body.data.body}</ReactMarkdown></div>}
    </>
  </article>;
};

export default World;
