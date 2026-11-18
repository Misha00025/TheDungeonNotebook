import React, { useState } from 'react';
import { useWorkspace } from './Workspace';
import { CampaignApiError } from './api';
import { useResource } from './hooks';
import { ApiError } from './Feedback';
import ViewRenderer from './ViewRenderer';
import inputStyles from '@tdn/shared/styles/components/Input.module.css';

type Props = { campaignId: number; characterId: string; refreshKey?: number };

const CharacterPresentation: React.FC<Props> = ({ campaignId, characterId, refreshKey = 0 }) => {
  const { api, sessionKey } = useWorkspace();
  const [selectedContext, setSelectedContext] = useState('');
  const [refreshSequence, setRefreshSequence] = useState(0);
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
  if (config.loading) return <section aria-label="Представление персонажа"><p>Загрузка представления…</p></section>;
  if (config.error) return <section aria-label="Представление персонажа"><ApiError error={config.error} onRetry={refresh} /></section>;
  if (!hasAssignment) return <section aria-label="Представление персонажа"><p>Представление не назначено.</p></section>;
  return <section aria-label="Представление персонажа">
    {keys.length > 1 && <label>Представление<select className={inputStyles.input} value={contextKey} onChange={event => setSelectedContext(event.target.value)}>{keys.map(key => <option key={key} value={key}>{key}</option>)}</select></label>}
    {view.loading && <p>Загрузка представления…</p>}
     {Boolean(view.error) && (view.error instanceof CampaignApiError && view.error.status === 404 && view.error.problem.code === 'view_not_configured' ? <p>Представление не назначено.</p> : <ApiError error={view.error} onRetry={refresh} />)}
    {view.data && sources.loading && <p>Загрузка данных представления…</p>}
      {Boolean(sources.error) && Boolean(view.data) && <ApiError error={sources.error} onRetry={refresh} />}
    {changedSnapshot && <><p role="alert">Представление изменилось; обновите данные</p><button type="button" onClick={refresh}>Обновить данные представления</button></>}
    {view.data && sources.data && !changedSnapshot && <ViewRenderer roots={view.data.viewContent.data.roots} widgets={sources.data.widgets} />}
  </section>;
};

export default CharacterPresentation;
