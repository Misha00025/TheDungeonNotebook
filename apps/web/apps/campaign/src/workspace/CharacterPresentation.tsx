import React, { useId, useState } from 'react';
import { Button, Field, List, Select, StatePanel } from '@tdn/shared';
import { useWorkspace } from './Workspace';
import { CampaignApiError } from './api';
import { useResource } from './hooks';
import { ApiError } from './Feedback';
import ViewRenderer from './ViewRenderer';

type Props = { campaignId: number; characterId: string; refreshKey?: number };

const CharacterPresentation: React.FC<Props> = ({ campaignId, characterId, refreshKey = 0 }) => {
  const { api, sessionKey } = useWorkspace();
  const [selectedContext, setSelectedContext] = useState('');
  const [refreshSequence, setRefreshSequence] = useState(0);
  const contextId = useId();
  const logicalKey = `${sessionKey}:${campaignId}:${characterId}:${refreshKey}:${refreshSequence}`;
  const config = useResource(`${sessionKey}:${campaignId}:presentation:${refreshKey}:${refreshSequence}`, () => api.getPresentation(campaignId));
  const defaults = config.data?.defaults ?? {};
  const keys = Object.keys(defaults);
  const preferred = keys.includes('character.overview') ? 'character.overview' : keys[0] ?? '';
  const contextKey = keys.includes(selectedContext) ? selectedContext : preferred;
  const hasAssignment = Boolean(contextKey && defaults[contextKey]);
  const view = useResource(`${logicalKey}:${contextKey}:view`, () => api.resolvePresentation(campaignId, contextKey), !config.loading && !config.error && hasAssignment);
  const sources = useResource(`${logicalKey}:${contextKey}:sources:${view.data?.viewMetadata.id ?? ''}`, () => api.getViewSources(campaignId, view.data!.viewMetadata.id, characterId), Boolean(view.data) && !view.loading && !view.error && !config.loading && !config.error);
  const changedSnapshot = Boolean(view.data && sources.data && String(view.data.viewContent.contentRevision) !== String(sources.data.viewContentRevision));
  const refresh = () => setRefreshSequence(value => value + 1);
  if (config.loading) return <section aria-label="Представление персонажа"><StatePanel kind="loading">Загрузка представления…</StatePanel></section>;
  if (config.error) return <section aria-label="Представление персонажа"><ApiError error={config.error} onRetry={refresh} /></section>;
  if (!hasAssignment) return <section aria-label="Представление персонажа"><StatePanel kind="empty">Представление не назначено.</StatePanel></section>;
  return <section aria-label="Представление персонажа"><List layout="vertical" stretch>
    {keys.length > 1 && <Field label="Представление" htmlFor={contextId}><Select id={contextId} value={contextKey} onChange={event => setSelectedContext(event.target.value)}>{keys.map(key => <option key={key} value={key}>{key}</option>)}</Select></Field>}
    {view.loading && <StatePanel kind="loading">Загрузка представления…</StatePanel>}
    {Boolean(view.error) && (view.error instanceof CampaignApiError && view.error.status === 404 && view.error.problem.code === 'view_not_configured' ? <StatePanel kind="empty">Представление не назначено.</StatePanel> : <ApiError error={view.error} onRetry={refresh} />)}
    {view.data && sources.loading && <StatePanel kind="loading">Загрузка данных представления…</StatePanel>}
    {Boolean(sources.error) && Boolean(view.data) && <ApiError error={sources.error} onRetry={refresh} />}
    {changedSnapshot && <><StatePanel kind="error">Представление изменилось; обновите данные</StatePanel><Button type="button" onClick={refresh}>Обновить данные представления</Button></>}
    {view.data && sources.data && !changedSnapshot && <ViewRenderer roots={view.data.viewContent.data.roots} widgets={sources.data.widgets} />}
  </List></section>;
};

export default CharacterPresentation;
