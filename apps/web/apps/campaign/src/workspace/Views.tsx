import React, { useEffect, useId, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useWorkspace, useDirtyDraft, useDirtyState } from './Workspace';
import { CampaignApiError, runCreation } from './api';
import { useCampaignWorkspace } from './Shell';
import { useResource, useMutation } from './hooks';
import type { DefinitionCreate, JsonValue, PresentationEnvelope, ViewContentEnvelope, ViewMetadata, ViewNode, ViewSourcesResponse } from './types';
import { parseJson, stringifyJson } from './json';
import { ApiError } from './Feedback';
import ViewTreeEditor from './ViewTreeEditor';
import ViewRenderer from './ViewRenderer';
import commonStyles from '@tdn/shared/styles/common.module.css';
import buttonStyles from '@tdn/shared/styles/components/Button.module.css';
import inputStyles from '@tdn/shared/styles/components/Input.module.css';
import styles from './Workspace.module.css';

const uncertain = (error: unknown) => error instanceof CampaignApiError && (error.conflict || error.unknownOutcome);
const sameRevision = (left: unknown, right: unknown) => String(left) === String(right);

const CreateView: React.FC<{ campaignId: number; canWrite: boolean; onCancel: () => void; onCreated: (view: DefinitionCreate) => void }> = ({ campaignId, canWrite, onCancel, onCreated }) => {
  const { api } = useWorkspace();
  const [name, setName] = useState('');
  const [requestId] = useState(() => crypto.randomUUID());
  const [error, setError] = useState<unknown>();
  const [blocked, setBlocked] = useState(false);
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
  const check = async () => { if (!canWrite || mutation.busy || !blocked) return; setCheckError(undefined); try { const created = await lookup(); if (mounted.current) { clearDirty(); onCreated(created); } } catch (failure) { if (mounted.current) setCheckError(failure); } };
  return <form className={commonStyles.form} onSubmit={event => {
    event.preventDefault(); if (!canWrite || !name.trim() || blocked || mutation.busy) return;
    void mutation.run().then(result => { if (result && mounted.current) { clearDirty(); onCreated(result); } }).catch(failure => { if (mounted.current) { setError(failure); setBlocked(uncertain(failure)); } });
  }}>
    <h2>Создать представление</h2>
    <label className={commonStyles.formGroup}>Название<input className={inputStyles.input} value={name} disabled={!canWrite || blocked || mutation.busy} onChange={event => setName(event.target.value)} /></label>
    {Boolean(error) && <ApiError error={error} />}{Boolean(checkError) && <ApiError error={checkError} />}
    <div className={commonStyles.formActions}>{blocked ? <button type="button" disabled={!canWrite || mutation.busy} className={buttonStyles.button} onClick={() => void check()}>Проверить создание</button> : <button className={buttonStyles.button} disabled={!canWrite || !name.trim() || mutation.busy}>Создать</button>}
      <button type="button" disabled={mutation.busy} className={buttonStyles.button} onClick={() => { if (!name || window.confirm(blocked ? 'Результат создания неизвестен. Отказаться от проверки и оставить созданное представление в списке?' : 'Отказаться от черновика представления?')) { clearDirty(); onCancel(); } }}>Отмена</button></div>
  </form>;
};

const ViewEditor: React.FC<{ campaignId: number; viewId: string; canWrite: boolean }> = ({ campaignId, viewId, canWrite }) => {
  const { api, notifyInvalidation } = useWorkspace();
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<unknown>();
  const [attempt, setAttempt] = useState(0);
  const [name, setName] = useState(''); const [baselineName, setBaselineName] = useState(''); const [metadataRevision, setMetadataRevision] = useState<ViewMetadata['metadataRevision']>(0);
  const [roots, setRoots] = useState<ViewNode[]>([]); const [baselineRoots, setBaselineRoots] = useState<ViewNode[]>([]); const [contentRevision, setContentRevision] = useState<ViewContentEnvelope['contentRevision']>(0); const [treeReset, setTreeReset] = useState(0); const [treeValid, setTreeValid] = useState(true);
  const [metadataError, setMetadataError] = useState<unknown>(); const [contentError, setContentError] = useState<unknown>(); const [metadataBlocked, setMetadataBlocked] = useState(false); const [contentBlocked, setContentBlocked] = useState(false); const [metadataSnapshot, setMetadataSnapshot] = useState<ViewMetadata>(); const [contentSnapshot, setContentSnapshot] = useState<ViewContentEnvelope>();
  const [metadataSaved, setMetadataSaved] = useState(false); const [contentSaved, setContentSaved] = useState(false);
  const [characters, setCharacters] = useState<{ id: string; name: string }[]>(); const [characterError, setCharacterError] = useState<unknown>(); const [characterId, setCharacterId] = useState('');
  const [sources, setSources] = useState<ViewSourcesResponse>(); const [previewContent, setPreviewContent] = useState<ViewContentEnvelope>(); const [previewError, setPreviewError] = useState<unknown>(); const [previewBusy, setPreviewBusy] = useState(false);
  const metadataDirty = loaded && name !== baselineName; const contentDirty = loaded && stringifyJson(roots) !== stringifyJson(baselineRoots);
  useDirtyDraft(`view-meta-${campaignId}-${viewId}`, metadataDirty);
  useDirtyDraft(`view-content-${campaignId}-${viewId}`, contentDirty);
  const metadataMutation = useMutation(() => api.renameView(campaignId, viewId, { name: name.trim(), expectedRevision: metadataRevision }));
  const contentMutation = useMutation(() => api.putViewContent(campaignId, viewId, { roots, expectedRevision: contentRevision }));
  const activePreview = useRef(0);
  useEffect(() => {
    let active = true; setLoaded(false); setLoadError(undefined); setMetadataError(undefined); setContentError(undefined);
    Promise.all([api.getView(campaignId, viewId), api.getViewContent(campaignId, viewId)]).then(([metadata, content]) => {
      if (!active) return;
      setName(metadata.name); setBaselineName(metadata.name); setMetadataRevision(metadata.metadataRevision);
      setRoots(content.data.roots); setBaselineRoots(content.data.roots); setContentRevision(content.contentRevision); setTreeReset(value => value + 1); setLoaded(true);
    }, error => { if (active) setLoadError(error); });
    return () => { active = false; activePreview.current += 1; };
  }, [api, campaignId, viewId, attempt]);
  useEffect(() => {
    let active = true; setCharacters(undefined); setCharacterError(undefined);
    api.listCharacters(campaignId).then(items => { if (active) setCharacters(items.map(item => ({ id: item.id, name: item.name }))); }, error => { if (active) setCharacterError(error); });
    return () => { active = false; };
  }, [api, campaignId]);
  const clearPreview = () => { activePreview.current += 1; setPreviewBusy(false); setSources(undefined); setPreviewContent(undefined); setPreviewError(undefined); };
  useEffect(() => { clearPreview(); }, [viewId, characterId]);
  const saveMetadata = async (event: React.FormEvent) => {
    event.preventDefault(); if (!canWrite || metadataBlocked || metadataMutation.busy || !metadataDirty || !name.trim()) return;
    try { const result = await metadataMutation.run(); if (result) { setName(result.name); setBaselineName(result.name); setMetadataRevision(result.metadataRevision); setMetadataBlocked(false); setMetadataSnapshot(undefined); setMetadataError(undefined); setMetadataSaved(true); } }
    catch (failure) { setMetadataError(failure); if (failure instanceof CampaignApiError && failure.status === 403) notifyInvalidation(); if (uncertain(failure)) setMetadataBlocked(true); }
  };
  const saveContent = async (event: React.FormEvent) => {
    event.preventDefault(); if (!canWrite || contentBlocked || contentMutation.busy || !contentDirty || !treeValid) return;
    try { const result = await contentMutation.run(); if (result) { setRoots(result.data.roots); setBaselineRoots(result.data.roots); setContentRevision(result.contentRevision); setTreeReset(value => value + 1); setContentBlocked(false); setContentSnapshot(undefined); setContentError(undefined); setContentSaved(true); } }
    catch (failure) { setContentError(failure); if (failure instanceof CampaignApiError && failure.status === 403) notifyInvalidation(); if (uncertain(failure)) setContentBlocked(true); }
  };
  const readMetadata = async () => { if (metadataMutation.busy || !canWrite) return; try { const latest = await api.getView(campaignId, viewId); setMetadataRevision(latest.metadataRevision); setMetadataSnapshot(latest); setMetadataBlocked(false); setMetadataError(undefined); } catch (failure) { setMetadataError(failure); } };
  const readContent = async () => { if (contentMutation.busy || !canWrite) return; try { const latest = await api.getViewContent(campaignId, viewId); setContentRevision(latest.contentRevision); setContentSnapshot(latest); setContentBlocked(false); setContentError(undefined); } catch (failure) { setContentError(failure); } };
  const preview = async () => {
    if (!characterId) return;
    const sequence = ++activePreview.current; setPreviewBusy(true); setSources(undefined); setPreviewContent(undefined); setPreviewError(undefined);
    try {
      const [sourceData, contentData] = await Promise.all([api.getViewSources(campaignId, viewId, characterId), api.getViewContent(campaignId, viewId)]);
      if (activePreview.current !== sequence) return;
      if (!sameRevision(sourceData.viewContentRevision, contentData.contentRevision)) { setPreviewError(new Error('Ревизии содержимого предпросмотра не совпадают. Запросите предпросмотр повторно.')); return; }
      setSources(sourceData); setPreviewContent(contentData);
    } catch (failure) { if (activePreview.current === sequence) setPreviewError(failure); }
    finally { if (activePreview.current === sequence) setPreviewBusy(false); }
  };
  if (loadError) return <ApiError error={loadError} onRetry={() => { setLoadError(undefined); setAttempt(value => value + 1); }} />;
  if (!loaded) return <p>Загрузка представления…</p>;
  return <div className={styles.page}>
    <form className={commonStyles.form} onSubmit={saveMetadata}><h2>Метаданные</h2><label className={commonStyles.formGroup}>Название<input className={inputStyles.input} value={name} disabled={!canWrite || metadataBlocked || metadataMutation.busy} onChange={event => { setName(event.target.value); setMetadataSaved(false); }} /></label>
      {Boolean(metadataError) && <ApiError error={metadataError} />}{metadataSaved && <p role="status">Название сохранено.</p>}{metadataBlocked && <button type="button" disabled={!canWrite || metadataMutation.busy} className={buttonStyles.button} onClick={() => void readMetadata()}>Перечитать метаданные</button>}{metadataSnapshot && <aside className={commonStyles.card}>Актуальные метаданные: {metadataSnapshot.name} · ревизия {String(metadataSnapshot.metadataRevision)}</aside>}
      <div className={commonStyles.formActions}><button className={buttonStyles.button} disabled={!canWrite || !metadataDirty || metadataMutation.busy || metadataBlocked || !name.trim()}>Сохранить название</button><button type="button" className={buttonStyles.button} disabled={metadataMutation.busy || !metadataDirty} onClick={() => { if (window.confirm('Отказаться от изменений названия?')) setName(baselineName); }}>Отменить</button></div></form>
    <form className={commonStyles.form} onSubmit={saveContent}><h2>Содержимое</h2><ViewTreeEditor roots={roots} onChange={next => { setRoots(next); setContentSaved(false); }} resetKey={treeReset} disabled={!canWrite || contentBlocked || contentMutation.busy} onValidityChange={setTreeValid} />
      {Boolean(contentError) && <ApiError error={contentError} />}{contentBlocked && <button type="button" disabled={!canWrite || contentMutation.busy} className={buttonStyles.button} onClick={() => void readContent()}>Перечитать содержимое</button>}{contentSnapshot && <aside className={commonStyles.card}>Актуальное содержимое (черновик сохранён)<pre>{stringifyJson(contentSnapshot.data.roots, 2)}</pre></aside>}
      {contentSaved && <p role="status">Содержимое сохранено.</p>}<div className={commonStyles.formActions}><button className={buttonStyles.button} disabled={!canWrite || !contentDirty || !treeValid || contentMutation.busy || contentBlocked}>Сохранить содержимое</button><button type="button" className={buttonStyles.button} disabled={contentMutation.busy} onClick={() => { if (window.confirm('Отказаться от изменений содержимого?')) { setRoots(baselineRoots); setTreeReset(value => value + 1); setContentSaved(false); } }}>Отменить</button></div></form>
    <section className={commonStyles.form}><h2>Предпросмотр сохранённой версии</h2><p>Черновик дерева не отображается.</p>
      {Boolean(characterError) && <ApiError error={characterError} />}<label className={commonStyles.formGroup}>Персонаж<select className={inputStyles.input} value={characterId} disabled={!characters} onChange={event => { clearPreview(); setCharacterId(event.target.value); }}><option value="">Выберите персонажа</option>{characters?.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <button type="button" className={buttonStyles.button} disabled={!characterId || previewBusy} onClick={() => void preview()}>Предпросмотр сохранённой версии</button>
      {Boolean(previewError) && <><ApiError error={previewError} /><button type="button" className={buttonStyles.button} onClick={() => void preview()}>Обновить предпросмотр</button></>}
      {sources && previewContent && <><p>Сохранённое представление</p><ViewRenderer roots={previewContent.data.roots} widgets={sources.widgets} /></>}
    </section>
  </div>;
};

const PresentationEditor: React.FC<{ campaignId: number; canWrite: boolean }> = ({ campaignId, canWrite }) => {
  const { api, notifyInvalidation } = useWorkspace();
  const [loaded, setLoaded] = useState(false); const [error, setError] = useState<unknown>(); const [loadError, setLoadError] = useState<unknown>(); const [blocked, setBlocked] = useState(false); const [snapshot, setSnapshot] = useState<PresentationEnvelope>(); const [attempt, setAttempt] = useState(0);
  const [views, setViews] = useState<ViewMetadata[]>([]); const [defaults, setDefaults] = useState<Record<string, string>>({}); const [baselineDefaults, setBaselineDefaults] = useState<Record<string, string>>({}); const [paramsText, setParamsText] = useState<Record<string, string>>({}); const [baselineParams, setBaselineParams] = useState<Record<string, string>>({}); const [invalid, setInvalid] = useState<Record<string, string>>({}); const [revision, setRevision] = useState<PresentationEnvelope['contentRevision']>(0); const busy = useRef(false); const [saving, setSaving] = useState(false);
  const [keyDrafts, setKeyDrafts] = useState<Record<string, string>>({}); const [keyReset, setKeyReset] = useState(0); const [saved, setSaved] = useState(false);
  const keys = [...new Set([...Object.keys(defaults), ...Object.keys(paramsText)])];
  const keyDirty = Object.entries(keyDrafts).some(([key, draft]) => keys.includes(key) && draft !== key);
  const keyInvalid = Object.entries(keyDrafts).some(([key, draft]) => keys.includes(key) && (!draft.trim() || (draft !== key && keys.includes(draft))));
  const dirty = loaded && (stringifyJson(defaults) !== stringifyJson(baselineDefaults) || stringifyJson(paramsText) !== stringifyJson(baselineParams) || keyDirty);
  useDirtyDraft(`presentation-${campaignId}`, dirty);
  const applySnapshot = (result: PresentationEnvelope) => { const text = Object.fromEntries(Object.entries(result.contextParams).map(([key, value]) => [key, stringifyJson(value, 2)])); setDefaults(result.defaults); setBaselineDefaults(result.defaults); setParamsText(text); setBaselineParams(text); setRevision(result.contentRevision); setInvalid({}); setKeyDrafts({}); setKeyReset(value => value + 1); setSaved(false); setLoaded(true); };
  useEffect(() => { let active = true; setLoaded(false); setLoadError(undefined); Promise.all([api.getPresentation(campaignId), api.listViews(campaignId)]).then(([presentation, listed]) => { if (active) { applySnapshot(presentation); setViews(listed); } }, failure => { if (active) setLoadError(failure); }); return () => { active = false; }; }, [api, campaignId, attempt]);
  const mutation = useMutation((body: { expectedRevision: PresentationEnvelope['contentRevision']; defaults: Record<string, string>; contextParams: Record<string, JsonValue> }) => api.putPresentation(campaignId, body));
  const add = () => { const key = window.prompt('Ключ контекста')?.trim(); if (key && !keys.includes(key)) { setSaved(false); setParamsText(current => ({ ...current, [key]: 'null' })); } };
  const remove = (key: string) => { if (!window.confirm(`Удалить контекст «${key}» вместе с его параметрами?`)) return; setDefaults(current => { const next = { ...current }; delete next[key]; return next; }); setParamsText(current => { const next = { ...current }; delete next[key]; return next; }); setInvalid(current => { const next = { ...current }; delete next[key]; return next; }); setSaved(false); };
  const clearDefault = (key: string) => setDefaults(current => { const next = { ...current }; delete next[key]; return next; });
  const renameKey = (key: string, nextKey: string) => {
    if (!nextKey.trim()) return false;
    if (nextKey !== key && keys.includes(nextKey)) return false;
    setDefaults(current => { const next = { ...current }; if (key in next) { next[nextKey] = next[key]; delete next[key]; } return next; });
    setParamsText(current => { const next = { ...current }; if (key in next) { next[nextKey] = next[key]; delete next[key]; } return next; });
    setInvalid(current => { const next = { ...current }; if (key in next) { next[nextKey] = next[key]; delete next[key]; } return next; });
    setKeyDrafts(current => { const next = { ...current }; delete next[key]; return next; }); setSaved(false); return true;
  };
  const save = async (event: React.FormEvent) => {
    event.preventDefault(); if (!canWrite || blocked || busy.current || Object.keys(invalid).length || keyInvalid || keyDirty) return;
    const contextParams: Record<string, JsonValue> = {};
    try { for (const [key, text] of Object.entries(paramsText)) contextParams[key] = parseJson(text); } catch (failure) { setError(failure); return; }
    busy.current = true; setSaving(true);
    try { const result = await mutation.run({ expectedRevision: revision, defaults, contextParams }); if (result) { applySnapshot(result); setKeyDrafts({}); setKeyReset(value => value + 1); setError(undefined); setBlocked(false); setSnapshot(undefined); setSaved(true); } }
    catch (failure) { setError(failure); if (failure instanceof CampaignApiError && failure.status === 403) notifyInvalidation(); if (uncertain(failure)) setBlocked(true); }
    finally { busy.current = false; setSaving(false); }
  };
  const refresh = async () => { if (busy.current || saving) return; try { const latest = await api.getPresentation(campaignId); setRevision(latest.contentRevision); setSnapshot(latest); setBlocked(false); setError(undefined); } catch (failure) { setError(failure); } };
  if (loadError) return <ApiError error={loadError} onRetry={() => setAttempt(value => value + 1)} />;
  if (!loaded) return <p>Загрузка конфигурации представления…</p>;
  return <form className={commonStyles.form} onSubmit={save}><h2>Настройки представления кампании</h2><p>Независимая конфигурация кампании.</p>
    {keys.map(key => <ContextRow key={key} contextKey={key} draftKey={keyDrafts[key]} resetKey={keyReset} defaultValue={defaults[key]} paramsText={paramsText[key]} views={views} disabled={!canWrite || blocked || saving} invalid={invalid[key]} onKeyDraft={value => { setSaved(false); setKeyDrafts(current => ({ ...current, [key]: value })); }} onDefault={value => { setSaved(false); value ? setDefaults(current => ({ ...current, [key]: value })) : clearDefault(key); }} onParams={text => { setSaved(false); setParamsText(current => ({ ...current, [key]: text })); try { parseJson(text); setInvalid(current => { const next = { ...current }; delete next[key]; return next; }); } catch (failure) { setInvalid(current => ({ ...current, [key]: failure instanceof Error ? failure.message : String(failure) })); } }} onRename={newKey => renameKey(key, newKey)} onRemove={() => remove(key)} />)}
    {Boolean(error) && <ApiError error={error} />}{saved && <p role="status">Настройки представления сохранены.</p>}{blocked && <button type="button" disabled={!canWrite || saving} className={buttonStyles.button} onClick={() => void refresh()}>Перечитать конфигурацию</button>}{snapshot && <aside className={commonStyles.card}>Актуальная конфигурация (черновик сохранён), ревизия {String(snapshot.contentRevision)}<pre>{stringifyJson(snapshot, 2)}</pre></aside>}
    {keyDirty && <p role="status">Завершите ввод ключа контекста перед сохранением.</p>}<div className={commonStyles.formActions}><button className={buttonStyles.button} disabled={!canWrite || !dirty || saving || blocked || Object.keys(invalid).length > 0 || keyInvalid || keyDirty}>Сохранить конфигурацию</button><button type="button" className={buttonStyles.button} disabled={saving || !dirty} onClick={() => { if (window.confirm('Отказаться от изменений конфигурации?')) { setDefaults(baselineDefaults); setParamsText(baselineParams); setInvalid({}); setKeyDrafts({}); setKeyReset(value => value + 1); setSaved(false); } }}>Отменить</button><button type="button" disabled={!canWrite || blocked || saving} className={buttonStyles.button} onClick={add}>Добавить контекст</button></div>
  </form>;
};

const ContextRow: React.FC<{ contextKey: string; draftKey?: string; resetKey: number; defaultValue?: string; paramsText?: string; views: ViewMetadata[]; disabled: boolean; invalid?: string; onKeyDraft: (value: string) => void; onDefault: (value: string) => void; onParams: (value: string) => void; onRename: (value: string) => boolean; onRemove: () => void }> = ({ contextKey, draftKey, resetKey, defaultValue = '', paramsText = '', views, disabled, invalid, onKeyDraft, onDefault, onParams, onRename, onRemove }) => {
  const owner = useId();
  const [keyDraft, setKeyDraft] = useState(draftKey ?? contextKey);
  const [keyError, setKeyError] = useState('');
  useEffect(() => { setKeyDraft(contextKey); setKeyError(''); }, [contextKey, resetKey]);
  useDirtyDraft(`presentation-key-${owner}`, keyDraft !== contextKey);
  const commitKey = () => {
    if (keyDraft === contextKey) { onKeyDraft(contextKey); setKeyError(''); return; }
    if (!keyDraft.trim()) { setKeyError('Ключ контекста не может быть пустым.'); return; }
    if (!onRename(keyDraft)) { setKeyError('Ключ контекста уже существует.'); return; }
    setKeyError('');
  };
  return <section className={commonStyles.card}>
    <label className={commonStyles.formGroup}>Ключ контекста<input className={inputStyles.input} disabled={disabled} value={keyDraft} onChange={event => { const value = event.target.value; setKeyDraft(value); onKeyDraft(value); setKeyError(''); }} onBlur={commitKey} /></label>{keyError && <p role="alert">{keyError}</p>}
    <label className={commonStyles.formGroup}>Представление<select className={inputStyles.input} disabled={disabled} value={defaultValue} onChange={event => onDefault(event.target.value)}><option value="">Не задано</option>{defaultValue && !views.some(view => view.key === defaultValue) && <option value={defaultValue}>{defaultValue} (неизвестный ключ)</option>}{views.map(view => <option key={view.id} value={view.key}>{view.name} ({view.key})</option>)}</select></label>
    <label className={commonStyles.formGroup}>Параметры контекста (JSON)<textarea className={inputStyles.input} disabled={disabled} value={paramsText} onChange={event => onParams(event.target.value)} /></label>{invalid && <p role="alert">Некорректный JSON: {invalid}</p>}
    <button type="button" disabled={disabled} className={buttonStyles.button} onClick={onRemove}>Удалить контекст</button>
  </section>;
};

export const Views: React.FC = () => {
  const { groupId = '' } = useParams(); const campaignId = Number(groupId);
  const { api, sessionKey, invalidation } = useWorkspace(); const { permissions, permissionsLoading } = useCampaignWorkspace(); const canWrite = permissions.canWrite;
  const resource = useResource<ViewMetadata[]>(`${sessionKey}:${campaignId}:views`, () => api.listViews(campaignId));
  const observedInvalidation = useRef(invalidation);
  useEffect(() => { if (observedInvalidation.current === invalidation) return; observedInvalidation.current = invalidation; resource.reload(); }, [invalidation, resource.reload]);
  const [selectedId, setSelectedId] = useState(''); const [creating, setCreating] = useState(false); const [showPresentation, setShowPresentation] = useState(false); const dirty = useDirtyState();
  const changeSelection = (id: string) => { if (id === selectedId) return; if (dirty && !window.confirm('Есть несохранённые изменения. Переключить раздел?')) return; setSelectedId(id); setCreating(false); setShowPresentation(false); };
  if (!resource.data && resource.loading) return <p>Загрузка представлений…</p>;
  return <main className={styles.page}><h1>Представления</h1>{Boolean(resource.error) && <ApiError error={resource.error} onRetry={resource.reload} />}
    <label className={commonStyles.formGroup}>Выбранное представление<select className={inputStyles.input} value={selectedId} onChange={event => changeSelection(event.target.value)}><option value="">Выберите представление</option>{resource.data?.map(view => <option key={view.id} value={view.id}>{view.name} ({view.id})</option>)}</select></label>
    <ul>{resource.data?.map(view => <li key={view.id}><button type="button" className={buttonStyles.button} onClick={() => changeSelection(view.id)}>{view.name} ({view.id})</button></li>)}</ul>
    {permissionsLoading && <p>Обновление прав кампании…</p>}
    <div className={styles.actions}><button type="button" disabled={!canWrite || permissionsLoading} className={buttonStyles.button} onClick={() => { if (!dirty || window.confirm('Есть несохранённые изменения. Открыть создание представления?')) { setCreating(true); setSelectedId(''); setShowPresentation(false); } }}>Создать представление</button><button type="button" disabled={!canWrite || permissionsLoading} className={buttonStyles.button} onClick={() => { if (!dirty || window.confirm('Есть несохранённые изменения. Открыть настройки кампании?')) { setSelectedId(''); setCreating(false); setShowPresentation(true); } }}>Настройки представления кампании</button><button type="button" className={buttonStyles.button} onClick={resource.reload}>Обновить список</button></div>
    {creating && <CreateView campaignId={campaignId} canWrite={canWrite && !permissionsLoading} onCancel={() => setCreating(false)} onCreated={created => { setSelectedId(created.id); setCreating(false); resource.reload(); }} />}
    {selectedId && !creating && <ViewEditor key={`${campaignId}:${selectedId}`} campaignId={campaignId} viewId={selectedId} canWrite={canWrite && !permissionsLoading} />}
    {showPresentation && !creating && !selectedId && <PresentationEditor key={campaignId} campaignId={campaignId} canWrite={canWrite && !permissionsLoading} />}
  </main>;
};
export default Views;
