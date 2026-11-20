import React, { useEffect, useId, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ActionRow, Button, Field, Input, ModalPortal, Select, StatePanel } from '@tdn/shared';
import type { DefinitionCreate, PresentationEnvelope, ViewMetadata } from './types';
import { useWorkspace, useDirtyDraft, useDirtyState } from './Workspace';
import { CampaignApiError, runCreation } from './api';
import { useCampaignWorkspace } from './Shell';
import { useResource, useMutation } from './hooks';
import { readPages } from './presentationModel';
import { ApiError } from './Feedback';
import ViewEditor from './ViewEditor';
import CampaignPagesEditor from './CampaignPagesEditor';
import commonStyles from '@tdn/shared/styles/common.module.css';
import sectionStyles from './ViewEditor.module.css';
import styles from './Workspace.module.css';

const uncertain = (error: unknown) => error instanceof CampaignApiError && (error.conflict || error.unknownOutcome);

const CreateView: React.FC<{ campaignId: number; canWrite: boolean; onCancel: () => void; onCreated: (view: DefinitionCreate) => void }> = ({ campaignId, canWrite, onCancel, onCreated }) => {
  const { api, notifyInvalidation } = useWorkspace();
  const [name, setName] = useState('');
  const nameId = useId();
  const [requestId] = useState(() => crypto.randomUUID());
  const [error, setError] = useState<unknown>();
  const [blocked, setBlocked] = useState(false);
  const [forbidden, setForbidden] = useState(false);
  const [checkError, setCheckError] = useState<unknown>();
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const clearDirty = useDirtyDraft(`view-create-${campaignId}-${requestId}`, Boolean(name));
  const lookup = async () => {
    const metadata = await api.getView(campaignId, requestId);
    const content = await api.getViewContent(campaignId, requestId);
    return { ...metadata, contentRevision: content.contentRevision } as DefinitionCreate;
  };
  const mutation = useMutation(() => runCreation(() => api.createView(campaignId, { requestId, name: name.trim(), roots: [] }), lookup));
  const check = async () => { if (!canWrite || forbidden || mutation.busy || !blocked) return; setCheckError(undefined); try { const created = await lookup(); if (mounted.current) { clearDirty(); onCreated(created); } } catch (failure) { if (mounted.current) { setCheckError(failure); if (failure instanceof CampaignApiError && failure.status === 403) { setForbidden(true); notifyInvalidation(); } } } };
  const cancel = () => {
    if (mutation.busy) return;
    if (!name || window.confirm(blocked ? 'Результат создания неизвестен. Отказаться от проверки и оставить созданное отображение в списке?' : 'Отказаться от черновика отображения?')) { clearDirty(); onCancel(); }
  };
  return <ModalPortal isOpen title="Создать отображение" onClose={cancel} dismissDisabled={mutation.busy}><form className={commonStyles.form} onSubmit={event => {
    event.preventDefault(); if (!canWrite || forbidden || !name.trim() || blocked || mutation.busy) return;
    void mutation.run().then(result => { if (result && mounted.current) { clearDirty(); onCreated(result); } }).catch(failure => { if (mounted.current) { setError(failure); setBlocked(uncertain(failure)); if (failure instanceof CampaignApiError && failure.status === 403) { setForbidden(true); notifyInvalidation(); } } });
  }}>
    <Field label="Название" htmlFor={nameId}><Input id={nameId} autoFocus value={name} disabled={!canWrite || forbidden || blocked || mutation.busy} onChange={event => setName(event.target.value)} /></Field>
    {Boolean(error) && <ApiError error={error} />}{Boolean(checkError) && <ApiError error={checkError} />}
    <ActionRow>{blocked ? <Button type="button" disabled={!canWrite || forbidden || mutation.busy} onClick={() => void check()}>Проверить создание</Button> : <Button type="submit" disabled={!canWrite || forbidden || !name.trim() || mutation.busy}>Создать</Button>}
      <Button variant="secondary" type="button" disabled={mutation.busy} onClick={cancel}>{blocked ? 'Отказаться от проверки' : 'Отмена'}</Button></ActionRow>
  </form></ModalPortal>;
};

const Views: React.FC = () => {
  const { groupId = '' } = useParams();
  const viewSelectId = useId();
  const campaignId = Number(groupId);
  const { api, sessionKey, invalidation } = useWorkspace();
  const { permissions, permissionsLoading } = useCampaignWorkspace();
  const canWrite = Boolean(permissions.canWrite && !permissionsLoading);
  const viewsResource = useResource<ViewMetadata[]>(`${sessionKey}:${campaignId}:views:${invalidation}`, () => api.listViews(campaignId));
  const presentationResource = useResource<PresentationEnvelope>(`${sessionKey}:${campaignId}:presentation:${invalidation}`, () => api.getPresentation(campaignId));
  const [selectedId, setSelectedId] = useState('');
  const [creating, setCreating] = useState(false);
  const [showPages, setShowPages] = useState(false);
  const dirty = useDirtyState();
  const pages = presentationResource.data ? readPages(presentationResource.data) : [];
  const changeSelection = (id: string) => {
    if (id === selectedId) return;
    if (dirty && !window.confirm('Есть несохранённые изменения. Переключить раздел?')) return;
    setSelectedId(id); setCreating(false); setShowPages(false);
  };
  const openPages = () => {
    if (dirty && !window.confirm('Есть несохранённые изменения. Открыть настройки страниц кампании?')) return;
    setSelectedId(''); setCreating(false); setShowPages(true);
  };
  const openCreate = () => {
    if (creating) return;
    if (dirty && !window.confirm('Есть несохранённые изменения. Открыть создание отображения?')) return;
    setCreating(true); setSelectedId(''); setShowPages(false);
  };
  const presentationForView = (viewKey: string) => pages.filter(page => page.viewKey === viewKey).map(page => page.title);
  const initialLoading = permissionsLoading || (!viewsResource.data && viewsResource.loading) || (!presentationResource.data && presentationResource.loading);

  return <main className={styles.page}>
    <h1>Отображения</h1>
    <div className={sectionStyles.sectionBody} aria-busy={initialLoading}>
    {Boolean(viewsResource.error) && <ApiError error={viewsResource.error} onRetry={viewsResource.reload} />}
    {Boolean(presentationResource.error) && <ApiError error={presentationResource.error} onRetry={presentationResource.reload} />}
    {initialLoading && <div className={sectionStyles.loadingOverlay}><StatePanel kind="loading">{permissionsLoading ? 'Проверка прав и загрузка раздела…' : 'Загрузка отображений кампании…'}</StatePanel></div>}
    <div className={styles.actions}>
      <Button type="button" disabled={!canWrite || creating || initialLoading} onClick={openCreate}>Создать отображение</Button>
      <Button variant="secondary" type="button" disabled={!canWrite || permissionsLoading || initialLoading} onClick={openPages}>Страницы кампании</Button>
      <Button variant="secondary" type="button" disabled={initialLoading} onClick={() => { viewsResource.reload(); presentationResource.reload(); }}>Обновить список</Button>
    </div>
    <Field label="Сохранённое отображение" htmlFor={viewSelectId}><Select id={viewSelectId} value={selectedId} disabled={!viewsResource.data} onChange={event => changeSelection(event.target.value)}><option value="">Выберите отображение</option>{viewsResource.data?.map(view => <option key={view.id} value={view.id}>{view.name}</option>)}</Select></Field>
    {viewsResource.data && viewsResource.data.length > 0 && <div className={styles.grid}>
      {viewsResource.data.map(view => {
        const assignments = presentationForView(view.key);
        return <article className={styles.card} key={`${sessionKey}:${campaignId}:${view.id}`}>
          <h2>{view.name}</h2><p>Область назначения: кампания.</p>
          {assignments.length > 0 ? <div><span>Страницы:</span><ul>{assignments.map((title, index) => <li key={`${title}:${index}`}>{title}</li>)}</ul></div> : <p>Не назначено страницам кампании.</p>}
          <Button variant="secondary" type="button" onClick={() => changeSelection(view.id)}>Открыть отображение</Button>
        </article>;
      })}
    </div>}
    {viewsResource.data && viewsResource.data.length === 0 && <StatePanel kind="empty">Сохранённых отображений пока нет.</StatePanel>}
    {creating && <CreateView key={`${sessionKey}:${campaignId}:create`} campaignId={campaignId} canWrite={canWrite} onCancel={() => setCreating(false)} onCreated={created => { setSelectedId(created.id); setCreating(false); viewsResource.reload(); presentationResource.reload(); }} />}
    {showPages && <CampaignPagesEditor key={`${sessionKey}:${campaignId}:pages`} campaignId={campaignId} sessionKey={sessionKey} canWrite={canWrite} permissionsLoading={Boolean(permissionsLoading)} views={viewsResource.data ?? []} />}
    {selectedId && !creating && <ViewEditor key={`${sessionKey}:${campaignId}:${selectedId}`} sessionKey={sessionKey} campaignId={campaignId} viewId={selectedId} canWrite={canWrite} permissionsLoading={Boolean(permissionsLoading)} />}
    </div>
  </main>;
};

export const ViewsPage = Views;
export { Views };
export default Views;
