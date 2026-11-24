import React, { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ActionRow, Button, Field, Input, Notification, Select, StatePanel } from '@tdn/shared';
import type { PresentationEnvelope, ViewMetadata } from './types';
import { useWorkspace, useDirtyDraft } from './Workspace';
import { CampaignApiError } from './api';
import { addPageKey, isPageKey, readPages, readSurfaceAssignment, writePages, writeSurfaceAssignments } from './presentationModel';
import type { PresentationPage, PresentationSurface } from './presentationModel';
import { stringifyJson } from './json';
import { ApiError } from './Feedback';
import styles from './ViewEditor.module.css';

const uncertain = (error: unknown) => error instanceof CampaignApiError && (error.conflict || error.unknownOutcome);
const reorder = (pages: PresentationPage[], index: number, offset: number) => {
  const target = index + offset;
  if (target < 0 || target >= pages.length) return pages;
  const next = [...pages]; const [page] = next.splice(index, 1); next.splice(target, 0, page); return next;
};
const pageKeys = (presentation: PresentationEnvelope) => [...Object.keys(presentation.defaults), ...Object.keys(presentation.contextParams)].filter(isPageKey);
type SurfaceAssignments = { header: string; card: string };
const readSurfaceAssignments = (presentation: PresentationEnvelope): SurfaceAssignments => ({ header: readSurfaceAssignment(presentation, 'header'), card: readSurfaceAssignment(presentation, 'card') });
const sameManagedAssignments = (presentation: PresentationEnvelope, pages: PresentationPage[], assignments: SurfaceAssignments) => stringifyJson(readPages(presentation)) === stringifyJson(pages) && stringifyJson(readSurfaceAssignments(presentation)) === stringifyJson(assignments);
type AttemptedAssignments = { pages: PresentationPage[]; assignments: SurfaceAssignments };

const SurfaceAssignment: React.FC<{ surface: Exclude<PresentationSurface, 'page'>; value: string; views: ViewMetadata[]; disabled: boolean; onChange: (value: string) => void; onEditView?: (viewId: string, surface: Exclude<PresentationSurface, 'page'>) => void }> = ({ surface, value, views, disabled, onChange, onEditView }) => {
  const id = useId();
  const unavailable = Boolean(value && !views.some(view => view.key === value));
  const title = surface === 'header' ? 'Шапка персонажа' : 'Карточка персонажа';
  return <div className={styles.surfaceAssignment}>
    <Field label={title} htmlFor={id}><Select variant="single-line" id={id} value={value} disabled={disabled} onChange={event => onChange(event.target.value)}><option value="">Не показывать</option>{unavailable && <option value={value}>Недоступное отображение</option>}{views.map(view => <option key={view.id} value={view.key}>{view.name}</option>)}</Select></Field>
    {value && !unavailable && <Button variant="secondary" type="button" disabled={disabled} onClick={() => onEditView?.(value, surface)}>Редактировать</Button>}
    {unavailable && <p className={styles.warningText}>Назначенное отображение недоступно. Выберите доступное перед сохранением.</p>}
  </div>;
};

const CampaignPageRow: React.FC<{
  page: PresentationPage;
  index: number;
  count: number;
  views: ViewMetadata[];
  disabled: boolean;
  onPatch: (key: string, patch: Partial<PresentationPage>) => void;
  onMove: (index: number, offset: number) => void;
  onRemove: (key: string) => void;
}> = ({ page, index, count, views, disabled, onPatch, onMove, onRemove }) => {
  const titleId = useId();
  const viewId = useId();
  const unavailable = Boolean(page.viewKey && !views.some(view => view.key === page.viewKey));
  return <article className={styles.pageRow}>
    <Field label="Название страницы" htmlFor={titleId}><Input variant="single-line" id={titleId} value={page.title} disabled={disabled} onChange={event => onPatch(page.key, { title: event.target.value })} /></Field>
    <Field label="Отображение" htmlFor={viewId}><Select variant="single-line" id={viewId} value={page.viewKey} disabled={disabled} onChange={event => onPatch(page.key, { viewKey: event.target.value })}><option value="">Выберите отображение</option>{unavailable && <option value={page.viewKey}>Недоступное отображение</option>}{views.map(view => <option key={view.id} value={view.key}>{view.name}</option>)}</Select></Field>
    {unavailable && <p className={styles.warningText}>Назначенное отображение сейчас недоступно. Выберите доступное перед сохранением.</p>}
    <ActionRow><Button variant="secondary" type="button" disabled={disabled || index === 0} onClick={() => onMove(index, -1)}>Выше</Button><Button variant="secondary" type="button" disabled={disabled || index === count - 1} onClick={() => onMove(index, 1)}>Ниже</Button><Button variant="secondary" type="button" disabled={disabled} onClick={() => onRemove(page.key)}>Убрать</Button></ActionRow>
  </article>;
};

const CampaignPagesEditor: React.FC<{ campaignId: number; sessionKey: string; canWrite: boolean; permissionsLoading: boolean; views: ViewMetadata[]; onStateChange?: (state: { dirty: boolean; busy: boolean }) => void; onEditView?: (viewId: string, surface: Exclude<PresentationSurface, 'page'>) => void; embedded?: boolean }> = ({ campaignId, sessionKey, canWrite, views, onStateChange, onEditView, embedded = false }) => {
  const { api } = useWorkspace();
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<unknown>();
  const [presentation, setPresentation] = useState<PresentationEnvelope>();
  const [pages, setPages] = useState<PresentationPage[]>([]);
  const [baselinePages, setBaselinePages] = useState<PresentationPage[]>([]);
  const [assignments, setAssignments] = useState<SurfaceAssignments>({ header: '', card: '' });
  const [baselineAssignments, setBaselineAssignments] = useState<SurfaceAssignments>({ header: '', card: '' });
  const [serverPresentation, setServerPresentation] = useState<PresentationEnvelope>();
  const [blocked, setBlocked] = useState(false);
  const [writeError, setWriteError] = useState<unknown>();
  const [readError, setReadError] = useState<unknown>();
  const [saving, setSaving] = useState(false);
  const [checking, setChecking] = useState(false);
  const [forbidden, setForbidden] = useState(false);
  const [saved, setSaved] = useState(false);
  const [previewKey, setPreviewKey] = useState('');
  const [reservedKeys, setReservedKeys] = useState<Set<string>>(new Set());
  const attempted = useRef<AttemptedAssignments | undefined>(undefined);
  const saveLock = useRef(false);
  const verifyLock = useRef(false);
  const mounted = useRef(true);
  const loadGeneration = useRef(0);
  const activeScope = `${sessionKey}:${campaignId}`;
  const scopeRef = useRef(activeScope);
  scopeRef.current = activeScope;
  const writable = canWrite && !forbidden;
  const dirty = Boolean(presentation) && (stringifyJson(pages) !== stringifyJson(baselinePages) || stringifyJson(assignments) !== stringifyJson(baselineAssignments));
  const busy = saving || checking || saveLock.current || verifyLock.current;
  const availableViews = useMemo(() => new Map(views.map(view => [view.key, view])), [views]);
  const valid = pages.every(page => Boolean(page.title.trim()) && Boolean(page.viewKey) && availableViews.has(page.viewKey)) && [assignments.header, assignments.card].every(value => !value || availableViews.has(value));
  useDirtyDraft(`campaign-pages-${sessionKey}:${campaignId}`, dirty);
  const stateRef = useRef({ dirty: false, busy: true });
  stateRef.current = { dirty, busy };
  useLayoutEffect(() => { onStateChange?.(stateRef.current); }, [onStateChange, dirty, busy]);

  const isCurrent = (requestScope: string, generation: number) => mounted.current && scopeRef.current === requestScope && loadGeneration.current === generation;
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; loadGeneration.current += 1; }; }, []);

  useEffect(() => {
    let active = true;
    const generation = ++loadGeneration.current;
    const requestScope = activeScope;
    setLoading(true); setLoadError(undefined);
    api.getPresentation(campaignId).then(result => {
      if (!active || !isCurrent(requestScope, generation)) return;
      const nextPages = readPages(result);
      const nextAssignments = readSurfaceAssignments(result);
      setPresentation(result); setPages(nextPages); setBaselinePages(nextPages); setAssignments(nextAssignments); setBaselineAssignments(nextAssignments); setReservedKeys(new Set(pageKeys(result))); setBlocked(false); setServerPresentation(undefined); setWriteError(undefined); setLoading(false);
    }, failure => { if (active && isCurrent(requestScope, generation)) { setLoadError(failure); setLoading(false); } });
    return () => { active = false; if (loadGeneration.current === generation) loadGeneration.current += 1; };
  }, [api, campaignId, loadAttempt, sessionKey, activeScope]);

  const save = async () => {
    if (!presentation || !writable || saving || checking || saveLock.current || verifyLock.current || blocked || !dirty || !valid) return;
    saveLock.current = true;
    const requestScope = activeScope;
    const generation = loadGeneration.current;
    setSaving(true); setWriteError(undefined); setReadError(undefined); setSaved(false);
    const submittedPages = pages;
    const submittedAssignments = assignments;
    const body = writeSurfaceAssignments(writePages(presentation, submittedPages), submittedAssignments);
    try {
      const result = await api.putPresentation(campaignId, { expectedRevision: presentation.contentRevision, defaults: body.defaults, contextParams: body.contextParams });
      if (!isCurrent(requestScope, generation)) return;
      const nextPages = readPages(result);
      const nextAssignments = readSurfaceAssignments(result);
      setPresentation(result); setPages(nextPages); setBaselinePages(nextPages); setAssignments(nextAssignments); setBaselineAssignments(nextAssignments); setReservedKeys(current => new Set([...current, ...pageKeys(result)])); setBlocked(false); setServerPresentation(undefined); attempted.current = undefined; setSaved(true);
    } catch (failure) {
      if (!isCurrent(requestScope, generation)) return;
      setWriteError(failure);
       if (failure instanceof CampaignApiError && failure.status === 403) setForbidden(true);
       if (uncertain(failure)) { setBlocked(true); attempted.current = { pages: submittedPages, assignments: submittedAssignments }; }
    } finally { saveLock.current = false; if (isCurrent(requestScope, generation)) setSaving(false); }
  };
  const verify = async () => {
    if (verifyLock.current || saveLock.current || saving || checking) return;
    verifyLock.current = true;
    const requestScope = activeScope;
    const generation = loadGeneration.current;
    const attemptedPages = pages;
    setChecking(true);
    setReadError(undefined);
    try {
      const latest = await api.getPresentation(campaignId);
      if (!isCurrent(requestScope, generation)) return;
      setPresentation(latest);
       const verifiedAttempt = attempted.current;
       if (verifiedAttempt && sameManagedAssignments(latest, verifiedAttempt.pages, verifiedAttempt.assignments)) {
         const nextPages = readPages(latest);
         const nextAssignments = readSurfaceAssignments(latest);
         setPages(current => stringifyJson(current) === stringifyJson(attemptedPages) ? nextPages : current); setBaselinePages(nextPages); setAssignments(current => stringifyJson(current) === stringifyJson(verifiedAttempt.assignments) ? nextAssignments : current); setBaselineAssignments(nextAssignments); setBlocked(false); setServerPresentation(undefined); attempted.current = undefined; setSaved(true);
      } else setServerPresentation(latest);
     } catch (failure) { if (isCurrent(requestScope, generation)) { setReadError(failure); if (failure instanceof CampaignApiError && failure.status === 403) setForbidden(true); } }
    finally { verifyLock.current = false; if (isCurrent(requestScope, generation)) setChecking(false); }
  };
  const loadServer = () => {
    if (!serverPresentation || (dirty && !window.confirm('Заменить несохранённые назначения серверной версией?'))) return;
    const nextPages = readPages(serverPresentation);
    const nextAssignments = readSurfaceAssignments(serverPresentation);
    setPresentation(serverPresentation); setPages(nextPages); setBaselinePages(nextPages); setAssignments(nextAssignments); setBaselineAssignments(nextAssignments); setReservedKeys(current => new Set([...current, ...pageKeys(serverPresentation)])); setBlocked(false); setServerPresentation(undefined); attempted.current = undefined; setWriteError(undefined); setSaved(false);
  };
  const useServerAsBase = () => {
    if (!serverPresentation || !window.confirm('Оставить текущие назначения и использовать серверную ревизию как основу? Следующее сохранение сможет заменить назначения на сервере.')) return;
    setPresentation(serverPresentation); setBaselinePages(readPages(serverPresentation)); setBaselineAssignments(readSurfaceAssignments(serverPresentation)); setReservedKeys(current => new Set([...current, ...pageKeys(serverPresentation)])); setBlocked(false); setServerPresentation(undefined); attempted.current = undefined; setWriteError(undefined); setSaved(false);
  };
  const cancelChanges = () => {
    if (!dirty || !window.confirm('Отменить несохранённые назначения страниц?')) return;
    setPages(baselinePages); setAssignments(baselineAssignments); setSaved(false); setPreviewKey('');
  };
  const addPage = () => {
    if (!presentation) return;
    let source = presentation;
    const keysToReserve = new Set(reservedKeys);
    for (const page of pages) keysToReserve.add(page.key);
    let key = addPageKey(source);
    while (keysToReserve.has(key)) {
      source = { ...source, defaults: { ...source.defaults, [key]: '' } };
      key = addPageKey(source);
    }
    setReservedKeys(current => new Set([...current, ...keysToReserve, key]));
    setPages(current => [...current, { key, title: '', viewKey: '' }]); setSaved(false);
  };
  const patchPage = (key: string, patch: Partial<PresentationPage>) => setPages(current => current.map(page => page.key === key ? { ...page, ...patch } : page));
  const removePage = (key: string) => { setPages(current => current.filter(page => page.key !== key)); if (previewKey === key) setPreviewKey(''); setSaved(false); };
  return <section className={styles.section} aria-label="Назначение" aria-busy={loading}>
    <header className={styles.header}>{!embedded && <h2>Назначение</h2>}<p>Настройте шапку, карточку и страницы персонажа для сохранённых отображений.</p></header>
    {Boolean(loadError) && <><ApiError error={loadError} /><Button variant="secondary" type="button" onClick={() => setLoadAttempt(value => value + 1)}>Повторить загрузку назначений</Button></>}
    {!presentation && loading && <StatePanel kind="loading">Загрузка назначений…</StatePanel>}
    {presentation ? <>
      <div className={styles.surfaceAssignments}>
        <SurfaceAssignment surface="header" value={assignments.header} views={views} disabled={!writable || saving || checking || blocked} onChange={value => { setAssignments(current => ({ ...current, header: value })); setSaved(false); }} onEditView={onEditView} />
        <SurfaceAssignment surface="card" value={assignments.card} views={views} disabled={!writable || saving || checking || blocked} onChange={value => { setAssignments(current => ({ ...current, card: value })); setSaved(false); }} onEditView={onEditView} />
      </div>
      <div className={styles.pageRows}>
        <h3>Страницы персонажа</h3>
        {pages.map((page, index) => <CampaignPageRow key={page.key} page={page} index={index} count={pages.length} views={views} disabled={!writable || saving || checking || blocked} onPatch={(key, patch) => { patchPage(key, patch); setSaved(false); }} onMove={(from, offset) => { setPages(current => reorder(current, from, offset)); setSaved(false); }} onRemove={removePage} />)}
        {pages.length === 0 && <StatePanel kind="empty">Пока нет назначенных страниц.</StatePanel>}
      </div>
      <ActionRow><Button variant="secondary" type="button" disabled={!writable || saving || checking || blocked} onClick={addPage}>Добавить страницу</Button><Button type="button" busy={saving} disabled={!writable || saving || checking || blocked || !dirty || !valid} onClick={() => void save()}>Сохранить назначения</Button>{dirty && <Button variant="secondary" type="button" disabled={saving || checking} onClick={cancelChanges}>Отменить изменения назначений</Button>}</ActionRow>
      {pages.length > 0 && <div className={styles.pagePreview}><h3>Навигация страниц</h3><nav aria-label="Предпросмотр навигации страниц">{pages.map(page => <Button key={page.key} type="button" variant={previewKey === page.key ? 'primary' : 'secondary'} disabled={!page.title.trim() || saving || checking} onClick={() => setPreviewKey(page.key)}>{page.title || 'Без названия'}</Button>)}</nav>{previewKey && <p>Выбрана страница: {pages.find(page => page.key === previewKey)?.title}</p>}</div>}
      {Boolean(writeError) && <ApiError error={writeError} onRetry={!blocked ? () => void save() : undefined} />}{Boolean(readError) && <ApiError error={readError} onRetry={() => void verify()} />}
       {blocked && <div className={styles.conflictPanel}><Notification kind="warning" eventKey={String(serverPresentation?.contentRevision ?? presentation.contentRevision)}>Сохранение назначений заблокировано до проверки версии. Локальные изменения сохранены.</Notification><Button variant="secondary" type="button" disabled={saving || checking} onClick={() => void verify()}>Проверить сохранение</Button>
         {serverPresentation ? <><p>Серверная версия содержит {readPages(serverPresentation).length} назначенных страниц.</p><ActionRow><Button type="button" disabled={saving || checking} onClick={loadServer}>Загрузить серверную версию</Button><Button variant="secondary" type="button" disabled={saving || checking} onClick={useServerAsBase}>Использовать актуальную версию как основу</Button></ActionRow></> : null}
      </div>}
       {saved && <Notification kind="success" eventKey={String(presentation.contentRevision)}>Назначения сохранены.</Notification>}
    </> : null}
  </section>;
};

export default CampaignPagesEditor;
