import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { ActionRow, Button, Field, Input, Notification, Select, StatePanel } from '@tdn/shared';
import type { NotificationKind } from '@tdn/shared';
import type { ComputedSheet, JsonValue, Revision, TemplateContentEnvelope, ViewContentEnvelope, ViewMetadata, VirtualFieldsEnvelope } from './types';
import { useWorkspace, useDirtyDraft } from './Workspace';
import { CampaignApiError } from './api';
import { normalizeRoots, readLocalDraft, removeLocalDraft, writeLocalDraft } from './presentationModel';
import type { LocalDraft, LocalDraftScope, PresentationNode } from './presentationModel';
import PresentationEditor from './PresentationEditor';
import { stringifyJson } from './json';
import { ApiError } from './Feedback';
import styles from './ViewEditor.module.css';

type ViewSnapshot = { metadata: ViewMetadata; content: ViewContentEnvelope; roots: PresentationNode[]; legacy: boolean };
type ContentAttempt = { roots: PresentationNode[] };
type MetaAttempt = { name: string };
type DraftOffer = { status: 'available'; draft: LocalDraft } | { status: 'error'; message: string };

const sameRevision = (left: unknown, right: unknown) => String(left) === String(right);
const uncertain = (error: unknown) => error instanceof CampaignApiError && (error.conflict || error.unknownOutcome);
const hasWidget = (roots: ViewContentEnvelope['data']['roots']): boolean => roots.some(node => node.kind === 'widget' || hasWidget(node.children));
const sameRoots = (left: PresentationNode[], right: PresentationNode[]) => stringifyJson(left) === stringifyJson(right);

function sampleSheet(template: TemplateContentEnvelope, virtuals: VirtualFieldsEnvelope | undefined): ComputedSheet {
  const content = template.data;
  const metadata = Array.isArray(content.virtualFields) && content.virtualFields.length > 0 ? content.virtualFields : virtuals?.virtualFields ?? [];
  return {
    contentRevision: template.contentRevision,
    templateContentRevision: template.contentRevision,
    description: content.description,
    baseFields: content.baseFields.map(field => ({ id: field.id, key: field.key, title: field.title, description: field.description, valueType: field.valueType, typeRevision: field.typeRevision, options: field.options, effectiveValue: null, isExplicit: false })),
    formulaContentRevisions: [],
    virtualFields: metadata.map(field => ({ id: field.id, key: field.key, title: field.title, description: field.description, resultType: field.resultType, value: null, diagnostic: null })),
  };
}

function SectionLoading({ loading, children }: React.PropsWithChildren<{ loading: boolean }>) {
  return <div className={styles.sectionBody} aria-busy={loading}>
    {children}
    {loading && <div className={styles.loadingOverlay}><StatePanel kind="loading">Загрузка раздела…</StatePanel></div>}
  </div>;
}

const ViewEditor: React.FC<{ campaignId: number; viewId: string; canWrite: boolean; permissionsLoading: boolean; sessionKey: string }> = ({ campaignId, viewId, canWrite, permissionsLoading, sessionKey }) => {
  const { api, notifyInvalidation } = useWorkspace();
  const nameInputId = useId();
  const previewSelectId = useId();
  const [attempt, setAttempt] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<unknown>();
  const [snapshot, setSnapshot] = useState<ViewSnapshot>();
  const [name, setName] = useState('');
  const [baselineName, setBaselineName] = useState('');
  const [metadataRevision, setMetadataRevision] = useState<Revision>(0);
  const [roots, setRoots] = useState<PresentationNode[]>([]);
  const [baselineRoots, setBaselineRoots] = useState<PresentationNode[]>([]);
  const [contentRevision, setContentRevision] = useState<Revision>(0);
  const [legacyConversion, setLegacyConversion] = useState(false);
  const [metadataBlocked, setMetadataBlocked] = useState(false);
  const [contentBlocked, setContentBlocked] = useState(false);
  const [metadataAttempt, setMetadataAttempt] = useState<MetaAttempt>();
  const [contentAttempt, setContentAttempt] = useState<ContentAttempt>();
  const [metadataServer, setMetadataServer] = useState<ViewMetadata>();
  const [contentServer, setContentServer] = useState<ViewSnapshot>();
  const [metadataError, setMetadataError] = useState<unknown>();
  const [contentError, setContentError] = useState<unknown>();
  const [verifyError, setVerifyError] = useState<unknown>();
  const [metadataSaved, setMetadataSaved] = useState(false);
  const [contentSaved, setContentSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [checking, setChecking] = useState(false);
  const [forbidden, setForbidden] = useState(false);
  const [characters, setCharacters] = useState<{ id: string; name: string }[]>([]);
  const [charactersError, setCharactersError] = useState<unknown>();
  const [characterId, setCharacterId] = useState('');
  const [characterSheet, setCharacterSheet] = useState<ComputedSheet>();
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<unknown>();
  const [templateSheet, setTemplateSheet] = useState<ComputedSheet>();
  const [draftOffer, setDraftOffer] = useState<DraftOffer>();
  const [draftMessage, setDraftMessage] = useState('');
  const [draftMessageKind, setDraftMessageKind] = useState<NotificationKind>('info');
  const previewGeneration = useRef(0);
  const loadGeneration = useRef(0);
  const writeLock = useRef(false);
  const verifyLock = useRef(false);
  const characterListLock = useRef(false);
  const characterListGeneration = useRef(0);
  const mounted = useRef(true);
  const activeScope = `${sessionKey}:${campaignId}:${viewId}`;
  const scopeRef = useRef(activeScope);
  scopeRef.current = activeScope;
  const permissionRefresh = useRef({ waiting: false, sawLoading: false });
  const scope = useMemo<LocalDraftScope>(() => ({ account: sessionKey, campaign: String(campaignId), view: viewId, schemaVersion: 1 }), [sessionKey, campaignId, viewId]);
  const writable = canWrite && !forbidden;
  const metadataDirty = name !== baselineName;
  const contentDirty = !sameRoots(roots, baselineRoots);
  const contentSaveNeeded = contentDirty || legacyConversion;
  const canSaveMetadata = metadataDirty && !metadataBlocked && Boolean(name.trim());
  const canSaveContent = contentSaveNeeded && !contentBlocked;
  const hasSaveableChanges = canSaveMetadata || canSaveContent;
  const dirty = metadataDirty || contentDirty;
  useDirtyDraft(`view-editor-${activeScope}`, dirty);

  const isCurrent = (scopeAtRequest: string, generation: number) => mounted.current && scopeRef.current === scopeAtRequest && loadGeneration.current === generation;
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; loadGeneration.current += 1; previewGeneration.current += 1; characterListGeneration.current += 1; }; }, []);

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
    setLoading(true); setLoadError(undefined); setSnapshot(undefined); setDraftOffer(undefined);
    const readInitial = async () => {
      const [metadata, content, template, charactersResult] = await Promise.all([
        api.getView(campaignId, viewId),
        api.getViewContent(campaignId, viewId),
        api.getTemplateContent(campaignId),
        api.listCharacters(campaignId).then(value => ({ value }), error => ({ error })),
      ]);
      let virtuals: VirtualFieldsEnvelope | undefined;
      if (!Array.isArray(template.data.virtualFields) || template.data.virtualFields.length === 0) virtuals = await api.getTemplateVirtualFields(campaignId);
      if (!active || !isCurrent(requestScope, generation)) return;
      const normalized = normalizeRoots(content.data.roots);
      const nextSnapshot = { metadata, content, roots: normalized, legacy: hasWidget(content.data.roots) };
      setSnapshot(nextSnapshot); setName(metadata.name); setBaselineName(metadata.name); setMetadataRevision(metadata.metadataRevision);
      setRoots(normalized); setBaselineRoots(normalized); setContentRevision(content.contentRevision); setLegacyConversion(nextSnapshot.legacy);
      setMetadataBlocked(false); setContentBlocked(false); setMetadataAttempt(undefined); setContentAttempt(undefined); setMetadataServer(undefined); setContentServer(undefined);
      setTemplateSheet(sampleSheet(template, virtuals));
      if ('value' in charactersResult) { setCharacters(charactersResult.value.map(item => ({ id: item.id, name: item.name }))); setCharactersError(undefined); }
      else { setCharacters([]); setCharactersError(charactersResult.error); }
      try {
        const stored = readLocalDraft(window.localStorage, scope);
        if (stored?.status === 'ok') setDraftOffer({ status: 'available', draft: stored.draft });
        else if (stored?.status === 'error') setDraftOffer({ status: 'error', message: stored.message });
      } catch { setDraftOffer({ status: 'error', message: 'Локальное хранилище недоступно.' }); }
    };
    readInitial().then(() => { if (active && isCurrent(requestScope, generation)) setLoading(false); }, error => { if (active && isCurrent(requestScope, generation)) { setLoadError(error); setLoading(false); } });
    return () => { active = false; if (loadGeneration.current === generation) loadGeneration.current += 1; previewGeneration.current += 1; };
  }, [api, campaignId, viewId, attempt, sessionKey, scope, activeScope]);

  const recordForbidden = (failure: unknown) => {
    if (failure instanceof CampaignApiError && failure.status === 403) { setForbidden(true); permissionRefresh.current = { waiting: true, sawLoading: false }; notifyInvalidation(); return true; }
    return false;
  };
  const save = async () => {
    if (!writable || saving || checking || writeLock.current || verifyLock.current || !hasSaveableChanges) return;
    writeLock.current = true;
    const requestScope = activeScope;
    const generation = loadGeneration.current;
    setSaving(true); setMetadataError(undefined); setContentError(undefined); setMetadataSaved(false); setContentSaved(false);
    const submittedName = name.trim();
    const submittedRoots = roots;
    let writeRevoked = false;
    try {
      if (canSaveMetadata && writable) {
        try {
          const result = await api.renameView(campaignId, viewId, { name: submittedName, expectedRevision: metadataRevision });
          if (!isCurrent(requestScope, generation)) return;
          setBaselineName(result.name); setName(current => current === submittedName ? result.name : current); setMetadataRevision(result.metadataRevision); setSnapshot(current => current ? { ...current, metadata: result } : current); setMetadataBlocked(false); setMetadataAttempt(undefined); setMetadataServer(undefined); setMetadataSaved(true); notifyInvalidation();
        } catch (failure) {
          if (!isCurrent(requestScope, generation)) return;
          setMetadataError(failure); writeRevoked = recordForbidden(failure);
          if (uncertain(failure)) { setMetadataBlocked(true); setMetadataAttempt({ name: submittedName }); }
        }
      }
      if (!isCurrent(requestScope, generation)) return;
      if (canSaveContent && writable && !writeRevoked) {
        try {
          const result = await api.putViewContent(campaignId, viewId, { roots: submittedRoots, expectedRevision: contentRevision });
          if (!isCurrent(requestScope, generation)) return;
          const normalized = normalizeRoots(result.data.roots);
          const legacy = hasWidget(result.data.roots);
          setBaselineRoots(normalized); setRoots(current => sameRoots(current, submittedRoots) ? normalized : current); setContentRevision(result.contentRevision); setLegacyConversion(legacy); setSnapshot(current => current ? { ...current, content: result, roots: normalized, legacy } : current); setContentBlocked(false); setContentAttempt(undefined); setContentServer(undefined); setContentSaved(true); notifyInvalidation();
        } catch (failure) {
          if (!isCurrent(requestScope, generation)) return;
          setContentError(failure); writeRevoked = recordForbidden(failure);
          if (uncertain(failure)) { setContentBlocked(true); setContentAttempt({ roots: submittedRoots }); }
        }
      }
    } finally { writeLock.current = false; if (isCurrent(requestScope, generation)) setSaving(false); }
  };

  const readLatestMetadata = async (requestScope: string, generation: number) => {
    try {
      const latest = await api.getView(campaignId, viewId);
      if (!isCurrent(requestScope, generation)) return;
      const submitted = metadataAttempt;
      setSnapshot(current => current ? { ...current, metadata: latest } : current);
      if (submitted && latest.name === submitted.name) {
        setBaselineName(latest.name); setName(current => current === submitted.name ? latest.name : current); setMetadataRevision(latest.metadataRevision); setSnapshot(current => current ? { ...current, metadata: latest } : current); setMetadataBlocked(false); setMetadataAttempt(undefined); setMetadataServer(undefined); setMetadataError(undefined); setMetadataSaved(true); notifyInvalidation();
      } else setMetadataServer(latest);
    } catch (failure) { if (isCurrent(requestScope, generation)) { setVerifyError(failure); recordForbidden(failure); } }
  };
  const readLatestContent = async (requestScope: string, generation: number) => {
    try {
      const latest = await api.getViewContent(campaignId, viewId);
      if (!isCurrent(requestScope, generation)) return;
      const normalized = normalizeRoots(latest.data.roots);
      const latestSnapshot: ViewSnapshot = { metadata: snapshot!.metadata, content: latest, roots: normalized, legacy: hasWidget(latest.data.roots) };
      setSnapshot(current => current ? { ...current, content: latest, roots: normalized, legacy: latestSnapshot.legacy } : current);
      if (contentAttempt && !hasWidget(latest.data.roots) && sameRoots(normalized, contentAttempt.roots)) {
        setBaselineRoots(normalized); setRoots(current => sameRoots(current, contentAttempt.roots) ? normalized : current); setContentRevision(latest.contentRevision); setLegacyConversion(false); setContentBlocked(false); setContentAttempt(undefined); setContentServer(undefined); setContentError(undefined); setContentSaved(true); notifyInvalidation();
      } else setContentServer(latestSnapshot);
    } catch (failure) { if (isCurrent(requestScope, generation)) { setVerifyError(failure); recordForbidden(failure); } }
  };
  const verifySave = async () => {
    if (verifyLock.current || writeLock.current || saving || checking) return;
    verifyLock.current = true;
    const requestScope = activeScope;
    const generation = loadGeneration.current;
    setChecking(true);
    setVerifyError(undefined);
    try { await Promise.all([metadataBlocked ? readLatestMetadata(requestScope, generation) : Promise.resolve(), contentBlocked ? readLatestContent(requestScope, generation) : Promise.resolve()]); }
    finally { verifyLock.current = false; if (isCurrent(requestScope, generation)) setChecking(false); }
  };
  const loadServerMetadata = () => {
    if (!metadataServer || (metadataDirty && !window.confirm('Заменить несохранённое название серверной версией?'))) return;
    setName(metadataServer.name); setBaselineName(metadataServer.name); setMetadataRevision(metadataServer.metadataRevision); setSnapshot(current => current ? { ...current, metadata: metadataServer } : current); setMetadataBlocked(false); setMetadataAttempt(undefined); setMetadataServer(undefined); setMetadataError(undefined); setMetadataSaved(false);
  };
  const useMetadataAsBase = () => {
    if (!metadataServer || !window.confirm('Сохранить название и использовать актуальную серверную ревизию как основу? Следующее сохранение сможет заменить серверное название.')) return;
    setBaselineName(metadataServer.name); setMetadataRevision(metadataServer.metadataRevision); setSnapshot(current => current ? { ...current, metadata: metadataServer } : current); setMetadataBlocked(false); setMetadataAttempt(undefined); setMetadataServer(undefined); setMetadataError(undefined); setMetadataSaved(false);
  };
  const loadServerContent = () => {
    if (!contentServer || (contentDirty && !window.confirm('Заменить несохранённое дерево серверной версией?'))) return;
    setRoots(contentServer.roots); setBaselineRoots(contentServer.roots); setContentRevision(contentServer.content.contentRevision); setLegacyConversion(contentServer.legacy); setSnapshot(current => current ? { ...current, content: contentServer.content, roots: contentServer.roots, legacy: contentServer.legacy } : contentServer); setContentBlocked(false); setContentAttempt(undefined); setContentServer(undefined); setContentError(undefined); setContentSaved(false);
  };
  const useContentAsBase = () => {
    if (!contentServer || !window.confirm('Сохранить дерево и использовать актуальную серверную ревизию как основу? Следующее сохранение сможет заменить серверное дерево.')) return;
    setBaselineRoots(contentServer.roots); setContentRevision(contentServer.content.contentRevision); setLegacyConversion(contentServer.legacy); setSnapshot(current => current ? { ...current, content: contentServer.content, roots: contentServer.roots, legacy: contentServer.legacy } : contentServer); setContentBlocked(false); setContentAttempt(undefined); setContentServer(undefined); setContentError(undefined); setContentSaved(false);
  };

  const saveLocal = () => {
    try {
      const draft: LocalDraft = { ...scope, roots, name, baseContentRevision: contentRevision, baseMetadataRevision: metadataRevision };
      writeLocalDraft(window.localStorage, draft); setDraftOffer({ status: 'available', draft }); setDraftMessage('Локальный черновик сохранён.'); setDraftMessageKind('success');
    } catch { setDraftMessage('Не удалось сохранить локальный черновик.'); setDraftMessageKind('warning'); }
  };
  const restoreLocal = () => {
    if (!draftOffer || draftOffer.status !== 'available' || !snapshot || (dirty && !window.confirm('Заменить текущие несохранённые изменения локальным черновиком?'))) return;
    const restored = draftOffer.draft;
    const contentMismatch = !sameRevision(restored.baseContentRevision, snapshot.content.contentRevision);
    const metadataMismatch = !sameRevision(restored.baseMetadataRevision, snapshot.metadata.metadataRevision);
    setMetadataRevision(restored.baseMetadataRevision); setContentRevision(restored.baseContentRevision);
    setMetadataAttempt(undefined); setContentAttempt(undefined);
    setMetadataServer(metadataMismatch ? snapshot.metadata : undefined); setContentServer(contentMismatch ? snapshot : undefined);
    setMetadataBlocked(metadataMismatch); setContentBlocked(contentMismatch); setMetadataError(undefined); setContentError(undefined); setVerifyError(undefined);
    setRoots(draftOffer.draft.roots); setName(draftOffer.draft.name); setContentSaved(false); setMetadataSaved(false); setDraftMessage('Локальный черновик восстановлен; на сервер ничего не отправлено.');
    setDraftMessageKind('info');
  };
  const deleteLocal = () => {
    try { removeLocalDraft(window.localStorage, scope); setDraftOffer(undefined); setDraftMessage('Локальный черновик удалён.'); setDraftMessageKind('info'); }
    catch { setDraftMessage('Не удалось удалить локальный черновик.'); setDraftMessageKind('warning'); }
  };
  const selectCharacter = (id: string) => {
    setCharacterId(id); setPreviewError(undefined); setCharacterSheet(undefined); const generation = ++previewGeneration.current;
    if (!id) { setPreviewLoading(false); return; }
    const requestScope = activeScope;
    setPreviewLoading(true);
    api.getComputedSheet(campaignId, id).then(sheet => {
      if (mounted.current && previewGeneration.current === generation && scopeRef.current === requestScope) setCharacterSheet(sheet);
    }, failure => { if (mounted.current && previewGeneration.current === generation && scopeRef.current === requestScope) setPreviewError(failure); }).finally(() => { if (mounted.current && previewGeneration.current === generation && scopeRef.current === requestScope) setPreviewLoading(false); });
  };
  const retryCharacters = () => {
    if (characterListLock.current) return;
    characterListLock.current = true; setCharactersError(undefined);
    const generation = ++characterListGeneration.current; const requestScope = activeScope;
    api.listCharacters(campaignId).then(items => { if (mounted.current && characterListGeneration.current === generation && scopeRef.current === requestScope) setCharacters(items.map(item => ({ id: item.id, name: item.name }))); }, failure => { if (mounted.current && characterListGeneration.current === generation && scopeRef.current === requestScope) setCharactersError(failure); }).finally(() => { if (characterListGeneration.current === generation && scopeRef.current === requestScope) characterListLock.current = false; });
  };
  const effectiveSheet = characterId ? characterSheet : templateSheet;
  const loadErrorAction = <Button variant="secondary" type="button" onClick={() => setAttempt(value => value + 1)}>Повторить загрузку</Button>;

  return <section className={styles.section} aria-label="Редактор отображения">
    <SectionLoading loading={loading}>
      {Boolean(loadError) && <><ApiError error={loadError} /><div className={styles.recovery}>{loadErrorAction}</div></>}
      {snapshot ? <>
        {snapshot.legacy && <Notification kind="info" eventKey={`legacy:${viewId}`}>Старый формат виджета будет переведён в текущий при явном сохранении. Исходные настройки сохранены в модели отображения.</Notification>}
        {draftOffer?.status === 'available' && <div className={styles.draftOffer}><p>Найден локальный черновик.</p><ActionRow><Button type="button" disabled={saving} onClick={restoreLocal}>Восстановить локальный черновик</Button><Button variant="secondary" type="button" disabled={saving} onClick={deleteLocal}>Удалить локальный черновик</Button></ActionRow></div>}
        {draftOffer?.status === 'error' && <Notification kind="warning" eventKey={draftOffer.message}>{draftOffer.message}</Notification>}
        {draftMessage && <Notification kind={draftMessageKind} eventKey={draftMessage}>{draftMessage}</Notification>}
        <div className={styles.editorControls}>
          <Field label="Название" htmlFor={nameInputId}><Input id={nameInputId} value={name} disabled={!writable || saving} onChange={event => { setName(event.target.value); setMetadataSaved(false); }} /></Field>
          <Field label="Предпросмотр" htmlFor={previewSelectId}><Select id={previewSelectId} value={characterId} disabled={!templateSheet} onChange={event => selectCharacter(event.target.value)}><option value="">Образец на основе шаблона</option>{characters.map(character => <option key={character.id} value={character.id}>{character.name}</option>)}</Select></Field>
        </div>
        {(Boolean(characterId && previewError) || Boolean(charactersError)) && <div className={styles.previewDiagnostics}>
           {Boolean(characterId && previewError) && <><ApiError error={previewError} /><Button variant="secondary" type="button" disabled={previewLoading} onClick={() => selectCharacter(characterId)}>Повторить предпросмотр</Button></>}
           {Boolean(charactersError) && <><ApiError error={charactersError} onRetry={retryCharacters} /><Button variant="secondary" type="button" onClick={retryCharacters}>Повторить загрузку персонажей</Button></>}
        </div>}
        {templateSheet ? <div className={styles.previewCanvasSection} aria-busy={previewLoading}>
          <PresentationEditor roots={roots} onChange={next => { setRoots(next); setContentSaved(false); }} sheet={effectiveSheet} choicesSheet={templateSheet} sample={!characterId} disabled={!writable || saving} />
          {previewLoading && <div className={styles.previewOverlay}><StatePanel kind="loading">Загрузка данных выбранного персонажа…</StatePanel></div>}
        </div> : null}
        {Boolean(metadataError) && <ApiError error={metadataError} onRetry={!metadataBlocked ? () => void save() : undefined} />}{Boolean(contentError) && <ApiError error={contentError} onRetry={!contentBlocked ? () => void save() : undefined} />}{Boolean(verifyError) && <ApiError error={verifyError} onRetry={() => void verifySave()} />}
        {(metadataBlocked || contentBlocked) && <div className={styles.conflictPanel}>
          <Notification kind="warning" eventKey={`${metadataBlocked}:${contentBlocked}:${String(metadataServer?.metadataRevision ?? contentServer?.content.contentRevision ?? '')}`}>Запись заблокирована до проверки версии. Черновая работа сохранена.</Notification>
          <Button variant="secondary" type="button" disabled={saving || checking} onClick={() => void verifySave()}>Проверить сохранение</Button>
          {metadataServer ? <div className={styles.serverChoice}><p>Серверное название: {metadataServer.name}</p><ActionRow><Button type="button" disabled={saving || checking} onClick={loadServerMetadata}>Загрузить серверную версию</Button><Button variant="secondary" type="button" disabled={saving || checking} onClick={useMetadataAsBase}>Использовать актуальную версию как основу</Button></ActionRow></div> : null}
          {contentServer ? <div className={styles.serverChoice}><p>Серверное дерево содержит {contentServer.roots.length} корневых компонентов.</p><ActionRow><Button type="button" disabled={saving || checking} onClick={loadServerContent}>Загрузить серверную версию</Button><Button variant="secondary" type="button" disabled={saving || checking} onClick={useContentAsBase}>Использовать актуальную версию как основу</Button></ActionRow></div> : null}
        </div>}
        <ActionRow>
          <Button type="button" busy={saving} disabled={!writable || saving || checking || !hasSaveableChanges} onClick={() => void save()}>Сохранить</Button>
          <Button variant="secondary" type="button" disabled={saving || checking || !dirty} onClick={() => { if (window.confirm('Отменить только ещё не сохранённые изменения?')) { setName(baselineName); setRoots(baselineRoots); setMetadataSaved(false); setContentSaved(false); } }}>Отменить изменения</Button>
          <Button variant="secondary" type="button" disabled={saving} onClick={saveLocal}>Сохранить локальный черновик</Button>
        </ActionRow>
        {metadataSaved && <Notification kind="success" eventKey={`meta:${String(metadataRevision)}`}>Название сохранено отдельно.</Notification>}
        {contentSaved && <Notification kind="success" eventKey={`content:${String(contentRevision)}`}>Содержимое сохранено отдельно.</Notification>}
      </> : null}
    </SectionLoading>
  </section>;
};

export default ViewEditor;
