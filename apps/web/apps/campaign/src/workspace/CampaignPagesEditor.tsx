import React, { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ActionRow, Button, Field, Input, Notification, Select, StatePanel } from '@tdn/shared';
import type { PresentationEnvelope, ViewMetadata } from './types';
import { useWorkspace, useDirtyDraft } from './Workspace';
import { CampaignApiError } from './api';
import { addPageKey, isPageKey, readPages, writePages } from './presentationModel';
import type { PresentationPage } from './presentationModel';
import { stringifyJson } from './json';
import { ApiError } from './Feedback';
import styles from './ViewEditor.module.css';

const uncertain = (error: unknown) => error instanceof CampaignApiError && (error.conflict || error.unknownOutcome);
const samePresentation = (left: Pick<PresentationEnvelope, 'defaults' | 'contextParams'>, right: Pick<PresentationEnvelope, 'defaults' | 'contextParams'>) => stringifyJson(left.defaults) === stringifyJson(right.defaults) && stringifyJson(left.contextParams) === stringifyJson(right.contextParams);
const reorder = (pages: PresentationPage[], index: number, offset: number) => {
  const target = index + offset;
  if (target < 0 || target >= pages.length) return pages;
  const next = [...pages]; const [page] = next.splice(index, 1); next.splice(target, 0, page); return next;
};
const pageKeys = (presentation: PresentationEnvelope) => [...Object.keys(presentation.defaults), ...Object.keys(presentation.contextParams)].filter(isPageKey);

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
    <Field label="Название страницы" htmlFor={titleId}><Input id={titleId} value={page.title} disabled={disabled} onChange={event => onPatch(page.key, { title: event.target.value })} /></Field>
    <Field label="Отображение" htmlFor={viewId}><Select id={viewId} value={page.viewKey} disabled={disabled} onChange={event => onPatch(page.key, { viewKey: event.target.value })}><option value="">Выберите отображение</option>{unavailable && <option value={page.viewKey}>Недоступное отображение</option>}{views.map(view => <option key={view.id} value={view.key}>{view.name}</option>)}</Select></Field>
    {unavailable && <p className={styles.warningText}>Назначенное отображение сейчас недоступно. Выберите доступное перед сохранением.</p>}
    <ActionRow><Button variant="secondary" type="button" disabled={disabled || index === 0} onClick={() => onMove(index, -1)}>Выше</Button><Button variant="secondary" type="button" disabled={disabled || index === count - 1} onClick={() => onMove(index, 1)}>Ниже</Button><Button variant="secondary" type="button" disabled={disabled} onClick={() => onRemove(page.key)}>Убрать</Button></ActionRow>
  </article>;
};

const CampaignPagesEditor: React.FC<{ campaignId: number; sessionKey: string; canWrite: boolean; permissionsLoading: boolean; views: ViewMetadata[]; onStateChange?: (state: { dirty: boolean; busy: boolean }) => void; embedded?: boolean }> = ({ campaignId, sessionKey, canWrite, permissionsLoading, views, onStateChange, embedded = false }) => {
  const { api, notifyInvalidation } = useWorkspace();
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<unknown>();
  const [presentation, setPresentation] = useState<PresentationEnvelope>();
  const [pages, setPages] = useState<PresentationPage[]>([]);
  const [baselinePages, setBaselinePages] = useState<PresentationPage[]>([]);
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
  const attempted = useRef<Pick<PresentationEnvelope, 'defaults' | 'contextParams'> | undefined>(undefined);
  const permissionRefresh = useRef({ waiting: false, sawLoading: false });
  const saveLock = useRef(false);
  const verifyLock = useRef(false);
  const mounted = useRef(true);
  const loadGeneration = useRef(0);
  const activeScope = `${sessionKey}:${campaignId}`;
  const scopeRef = useRef(activeScope);
  scopeRef.current = activeScope;
  const writable = canWrite && !forbidden;
  const dirty = Boolean(presentation) && stringifyJson(pages) !== stringifyJson(baselinePages);
  const busy = saving || checking || saveLock.current || verifyLock.current;
  const availableViews = useMemo(() => new Map(views.map(view => [view.key, view])), [views]);
  const valid = pages.every(page => Boolean(page.title.trim()) && Boolean(page.viewKey) && availableViews.has(page.viewKey));
  useDirtyDraft(`campaign-pages-${sessionKey}:${campaignId}`, dirty);
  const stateRef = useRef({ dirty: false, busy: true });
  stateRef.current = { dirty, busy };
  useLayoutEffect(() => { onStateChange?.(stateRef.current); }, [onStateChange, dirty, busy]);

  const isCurrent = (requestScope: string, generation: number) => mounted.current && scopeRef.current === requestScope && loadGeneration.current === generation;
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; loadGeneration.current += 1; }; }, []);

  useEffect(() => {
    if (permissionRefresh.current.waiting && permissionsLoading) permissionRefresh.current.sawLoading = true;
    if (permissionRefresh.current.waiting && permissionRefresh.current.sawLoading && !permissionsLoading) {
      permissionRefresh.current.waiting = false; permissionRefresh.current.sawLoading = false;
      if (canWrite) setForbidden(false);
    }
  }, [canWrite, permissionsLoading]);
  useEffect(() => {
    let active = true;
    const generation = ++loadGeneration.current;
    const requestScope = activeScope;
    setLoading(true); setLoadError(undefined);
    api.getPresentation(campaignId).then(result => {
      if (!active || !isCurrent(requestScope, generation)) return;
      const nextPages = readPages(result);
      setPresentation(result); setPages(nextPages); setBaselinePages(nextPages); setReservedKeys(new Set(pageKeys(result))); setBlocked(false); setServerPresentation(undefined); setWriteError(undefined); setLoading(false);
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
    const body = writePages(presentation, submittedPages);
    try {
      const result = await api.putPresentation(campaignId, { expectedRevision: presentation.contentRevision, defaults: body.defaults, contextParams: body.contextParams });
      if (!isCurrent(requestScope, generation)) return;
      const nextPages = readPages(result);
      setPresentation(result); setPages(nextPages); setBaselinePages(nextPages); setReservedKeys(current => new Set([...current, ...pageKeys(result)])); setBlocked(false); setServerPresentation(undefined); attempted.current = undefined; setSaved(true); notifyInvalidation();
    } catch (failure) {
      if (!isCurrent(requestScope, generation)) return;
      setWriteError(failure);
      if (failure instanceof CampaignApiError && failure.status === 403) { setForbidden(true); permissionRefresh.current = { waiting: true, sawLoading: false }; notifyInvalidation(); }
      if (uncertain(failure)) { setBlocked(true); attempted.current = body; }
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
      if (attempted.current && samePresentation(latest, attempted.current)) {
        const nextPages = readPages(latest);
        setPages(current => stringifyJson(current) === stringifyJson(attemptedPages) ? nextPages : current); setBaselinePages(nextPages); setBlocked(false); setServerPresentation(undefined); attempted.current = undefined; setSaved(true); notifyInvalidation();
      } else setServerPresentation(latest);
    } catch (failure) { if (isCurrent(requestScope, generation)) { setReadError(failure); if (failure instanceof CampaignApiError && failure.status === 403) { setForbidden(true); permissionRefresh.current = { waiting: true, sawLoading: false }; notifyInvalidation(); } } }
    finally { verifyLock.current = false; if (isCurrent(requestScope, generation)) setChecking(false); }
  };
  const loadServer = () => {
    if (!serverPresentation || (dirty && !window.confirm('Заменить несохранённые назначения серверной версией?'))) return;
    const nextPages = readPages(serverPresentation);
    setPresentation(serverPresentation); setPages(nextPages); setBaselinePages(nextPages); setReservedKeys(current => new Set([...current, ...pageKeys(serverPresentation)])); setBlocked(false); setServerPresentation(undefined); attempted.current = undefined; setWriteError(undefined); setSaved(false);
  };
  const useServerAsBase = () => {
    if (!serverPresentation || !window.confirm('Оставить текущие назначения и использовать серверную ревизию как основу? Следующее сохранение сможет заменить назначения на сервере.')) return;
    setPresentation(serverPresentation); setBaselinePages(readPages(serverPresentation)); setReservedKeys(current => new Set([...current, ...pageKeys(serverPresentation)])); setBlocked(false); setServerPresentation(undefined); attempted.current = undefined; setWriteError(undefined); setSaved(false);
  };
  const cancelChanges = () => {
    if (!dirty || !window.confirm('Отменить несохранённые назначения страниц?')) return;
    setPages(baselinePages); setSaved(false); setPreviewKey('');
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
  return <section className={styles.section} aria-label="Страницы кампании" aria-busy={loading}>
    <header className={styles.header}>{!embedded && <h2>Страницы кампании</h2>}<p>Страницы задают общие разделы кампании и назначают сохранённые отображения.</p></header>
    {Boolean(loadError) && <><ApiError error={loadError} /><Button variant="secondary" type="button" onClick={() => setLoadAttempt(value => value + 1)}>Повторить загрузку</Button></>}
    {!presentation && loading && <StatePanel kind="loading">Загрузка настроек страниц…</StatePanel>}
    {presentation ? <>
      <div className={styles.pageRows}>
        {pages.map((page, index) => <CampaignPageRow key={page.key} page={page} index={index} count={pages.length} views={views} disabled={!writable || saving || checking || blocked} onPatch={(key, patch) => { patchPage(key, patch); setSaved(false); }} onMove={(from, offset) => { setPages(current => reorder(current, from, offset)); setSaved(false); }} onRemove={removePage} />)}
        {pages.length === 0 && <StatePanel kind="empty">Пока нет назначенных страниц.</StatePanel>}
      </div>
      <ActionRow><Button variant="secondary" type="button" disabled={!writable || saving || checking || blocked} onClick={addPage}>Добавить страницу</Button><Button type="button" busy={saving} disabled={!writable || saving || checking || blocked || !dirty || !valid} onClick={() => void save()}>Сохранить назначения</Button>{dirty && <Button variant="secondary" type="button" disabled={saving || checking} onClick={cancelChanges}>Отменить изменения назначений</Button>}</ActionRow>
      {pages.length > 0 && <div className={styles.pagePreview}><h3>Навигация страниц</h3><nav aria-label="Предпросмотр навигации страниц">{pages.map(page => <Button key={page.key} type="button" variant={previewKey === page.key ? 'primary' : 'secondary'} disabled={!page.title.trim() || saving || checking} onClick={() => setPreviewKey(page.key)}>{page.title || 'Без названия'}</Button>)}</nav>{previewKey && <p>Выбрана страница: {pages.find(page => page.key === previewKey)?.title}</p>}</div>}
      {Boolean(writeError) && <ApiError error={writeError} onRetry={!blocked ? () => void save() : undefined} />}{Boolean(readError) && <ApiError error={readError} onRetry={() => void verify()} />}
      {blocked && <div className={styles.conflictPanel}><Notification kind="warning" eventKey={String(serverPresentation?.contentRevision ?? presentation.contentRevision)}>Сохранение назначений заблокировано до проверки версии. Локальные изменения сохранены.</Notification><Button variant="secondary" type="button" disabled={saving || checking} onClick={() => void verify()}>Проверить сохранение</Button>
        {serverPresentation ? <><p>Серверная версия содержит {readPages(serverPresentation).length} назначенных страниц.</p><ActionRow><Button type="button" disabled={saving || checking} onClick={loadServer}>Загрузить серверную версию</Button><Button variant="secondary" type="button" disabled={saving || checking} onClick={useServerAsBase}>Использовать актуальную версию как основу</Button></ActionRow></> : null}
      </div>}
      {saved && <Notification kind="success" eventKey={String(presentation.contentRevision)}>Назначения страниц сохранены.</Notification>}
    </> : null}
  </section>;
};

export default CampaignPagesEditor;
