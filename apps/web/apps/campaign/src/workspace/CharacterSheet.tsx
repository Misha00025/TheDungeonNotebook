import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useWorkspace, useDirtyDraft } from './Workspace';
import { useMutation, useResource } from './hooks';
import { CampaignApiError } from './api';
import type { BasicSheet, CharacterMetadata, JsonValue, Permissions, Revision } from './types';
import { ValueInput } from './ValueInput';
import { stringifyJson } from './json';
import { ApiError } from './Feedback';
import buttonStyles from '@tdn/shared/styles/components/Button.module.css';
import inputStyles from '@tdn/shared/styles/components/Input.module.css';
import styles from './Workspace.module.css';
import commonStyles from '@tdn/shared/styles/common.module.css';

const importanceLabel: Record<string, string> = { Background: 'Фоновый', Secondary: 'Второстепенный', Key: 'Ключевой' };
type MetadataDraft = { name: string; importance: CharacterMetadata['importance'] };

const CharacterSheet: React.FC<{ campaignId: number; characterId: string; stats: boolean }> = ({ campaignId, characterId, stats }) => {
  const { api, path, sessionKey } = useWorkspace();
  const navigate = useNavigate();
  const mode = useLocation().pathname.includes('/gm/') ? 'gm' : 'player';
  const scope = `${sessionKey}:${campaignId}:${characterId}`;
  const metadataResource = useResource<CharacterMetadata>(`${scope}:metadata`, () => api.getCharacter(campaignId, characterId));
  const permissionResource = useResource<Permissions>(`${scope}:character-permissions`, () => api.characterPermissions(campaignId, characterId));
  const sheetResource = useResource<BasicSheet>(`${scope}:sheet`, () => api.getSheet(campaignId, characterId));
  const charactersResource = useResource<CharacterMetadata[]>(`${sessionKey}:${campaignId}:character-selector`, () => api.listCharacters(campaignId));
  const [metadata, setMetadata] = useState<CharacterMetadata>();
  const [metadataDraft, setMetadataDraft] = useState<MetadataDraft>();
  const [sheet, setSheet] = useState<BasicSheet>();
  const [descriptionDraft, setDescriptionDraft] = useState<string>();
  const [fieldDrafts, setFieldDrafts] = useState<Record<string, JsonValue>>({});
  const [validity, setValidity] = useState<Record<string, string | undefined>>({});
  const [resetCounters, setResetCounters] = useState<Record<string, number>>({});
  const [writeError, setWriteError] = useState<unknown>();
  const [metadataError, setMetadataError] = useState<unknown>();
  const [sheetBlocked, setSheetBlocked] = useState(false);
  const [metadataBlocked, setMetadataBlocked] = useState(false);
  const [sheetSnapshot, setSheetSnapshot] = useState<BasicSheet>();
  const [metadataSnapshot, setMetadataSnapshot] = useState<CharacterMetadata>();
  const [snapshotError, setSnapshotError] = useState<unknown>();
  const [snapshotBusy, setSnapshotBusy] = useState(false);
  const [writeStatus, setWriteStatus] = useState('');
  const [contentBusy, setContentBusy] = useState(false);
  const contentBusyRef = useRef(false);
  const contentRevisionRef = useRef<Revision | undefined>(undefined);
  const metadataBusyRef = useRef(false);
  const snapshotGenerationRef = useRef(0);
  const snapshotBusyRef = useRef(false);
  const lastPermissionRef = useRef<Permissions | undefined>(undefined);
  const initializedRef = useRef(false);
  const activeRef = useRef(true);
  useEffect(() => {
    activeRef.current = true;
    return () => { activeRef.current = false; };
  }, []);
  useEffect(() => {
    if (initializedRef.current || !metadataResource.data || !sheetResource.data) return;
    initializedRef.current = true;
    setMetadata(metadataResource.data);
    setSheet(sheetResource.data);
    contentRevisionRef.current = sheetResource.data.contentRevision;
  }, [metadataResource.data, sheetResource.data]);
  if (permissionResource.data && !permissionResource.loading && !permissionResource.error) lastPermissionRef.current = permissionResource.data;

  const fieldDirty = Object.keys(fieldDrafts).length > 0;
  const contentDirty = Boolean(
    (descriptionDraft !== undefined && descriptionDraft !== sheet?.description) || fieldDirty ||
    Object.values(validity).some(Boolean)
  );
  const metadataDirty = Boolean(metadata && metadataDraft && (
    metadata.name !== metadataDraft.name || metadata.importance !== metadataDraft.importance
  ));
  const canWrite = Boolean(permissionResource.data?.canWrite && !permissionResource.loading && !permissionResource.error);
  useDirtyDraft(`character-sheet-${scope}`, contentDirty || metadataDirty);

  const metadataMutation = useMutation(async (draft: MetadataDraft) => {
    if (metadataBusyRef.current || snapshotBusyRef.current || metadataBlocked || !canWrite) return undefined;
    metadataBusyRef.current = true;
    setMetadataError(undefined);
    try {
      const result = await api.putCharacter(campaignId, characterId, {
        ...draft,
        expectedRevision: metadata!.metadataRevision
      });
      if (activeRef.current) {
        setMetadata(result);
        setMetadataDraft(undefined);
        setWriteStatus('Метаданные сохранены.');
      }
      return result;
    } catch (error) {
      if (activeRef.current) {
        setMetadataError(error);
        setWriteStatus('');
        if (error instanceof CampaignApiError && (error.conflict || error.unknownOutcome)) setMetadataBlocked(true);
        if (error instanceof CampaignApiError && error.status === 403) permissionResource.reload();
      }
      return undefined;
    } finally { metadataBusyRef.current = false; }
  });

  const runContent = async <T extends { contentRevision: Revision }>(
    operation: (revision: Revision) => Promise<T>,
    confirmed: (result: T) => void
  ) => {
    if (!canWrite || sheetBlocked || contentBusyRef.current || snapshotBusyRef.current || contentRevisionRef.current === undefined) return;
    contentBusyRef.current = true;
    setContentBusy(true);
    setWriteError(undefined);
    const expectedRevision = contentRevisionRef.current;
    try {
      const result = await operation(expectedRevision);
      if (!activeRef.current) return;
      contentRevisionRef.current = result.contentRevision;
      confirmed(result);
    } catch (error) {
      if (!activeRef.current) return;
      setWriteError(error);
      setWriteStatus('');
      if (error instanceof CampaignApiError && error.status === 403) permissionResource.reload();
      if (error instanceof CampaignApiError && (error.conflict || error.unknownOutcome)) setSheetBlocked(true);
    } finally {
      contentBusyRef.current = false;
      if (activeRef.current) setContentBusy(false);
    }
  };

  const saveDescription = () => {
    const submitted = descriptionDraft;
    if (submitted === undefined || submitted === sheet?.description) return;
    void runContent(
      revision => api.putDescription(campaignId, characterId, { description: submitted, expectedRevision: revision }),
      result => {
        setSheet(current => current ? { ...current, description: submitted, contentRevision: result.contentRevision } : current);
        setDescriptionDraft(undefined);
        setWriteStatus('Описание сохранено.');
      }
    );
  };

  const saveField = (fieldId: string) => {
    if (!Object.prototype.hasOwnProperty.call(fieldDrafts, fieldId) || validity[fieldId]) return;
    const value = fieldDrafts[fieldId];
    void runContent(
      revision => api.putBaseValue(campaignId, characterId, fieldId, { value, expectedRevision: revision }),
      result => {
        setSheet(result);
        setFieldDrafts(current => { const next = { ...current }; delete next[fieldId]; return next; });
        setValidity(current => { const next = { ...current }; delete next[fieldId]; return next; });
        setWriteStatus('Поле сохранено.');
      }
    );
  };

  const resetField = (fieldId: string) => {
    if (!sheet?.baseFields.some(field => field.id === fieldId && field.isExplicit)) return;
    void runContent(
      revision => api.resetBaseValue(campaignId, characterId, fieldId, revision),
      result => {
        setSheet(result);
        setFieldDrafts(current => { const next = { ...current }; delete next[fieldId]; return next; });
        setValidity(current => { const next = { ...current }; delete next[fieldId]; return next; });
        setResetCounters(current => ({ ...current, [fieldId]: (current[fieldId] ?? 0) + 1 }));
        setWriteStatus('Значение сброшено.');
      }
    );
  };

  const rereadSheet = async () => {
    if (contentBusyRef.current || metadataBusyRef.current || snapshotBusyRef.current) return;
    snapshotBusyRef.current = true;
    const generation = ++snapshotGenerationRef.current;
    setSnapshotError(undefined);
    setSnapshotBusy(true);
    try {
      const freshSheet = await api.getSheet(campaignId, characterId);
      if (!activeRef.current || generation !== snapshotGenerationRef.current) return;
      setSheet(freshSheet);
      setSheetSnapshot(freshSheet);
      contentRevisionRef.current = freshSheet.contentRevision;
      setSheetBlocked(false);
      setWriteError(undefined);
      permissionResource.reload();
    } catch (error) { if (activeRef.current && generation === snapshotGenerationRef.current) setSnapshotError(error); }
    finally { if (activeRef.current && generation === snapshotGenerationRef.current) { snapshotBusyRef.current = false; setSnapshotBusy(false); } }
  };

  const rereadMetadata = async () => {
    if (contentBusyRef.current || metadataBusyRef.current || snapshotBusyRef.current) return;
    snapshotBusyRef.current = true;
    const generation = ++snapshotGenerationRef.current;
    setSnapshotError(undefined);
    setSnapshotBusy(true);
    try {
      const freshMetadata = await api.getCharacter(campaignId, characterId);
      if (!activeRef.current || generation !== snapshotGenerationRef.current) return;
      setMetadata(freshMetadata);
      setMetadataSnapshot(freshMetadata);
      setMetadataBlocked(false);
      setMetadataError(undefined);
      permissionResource.reload();
    } catch (error) { if (activeRef.current && generation === snapshotGenerationRef.current) setSnapshotError(error); }
    finally { if (activeRef.current && generation === snapshotGenerationRef.current) { snapshotBusyRef.current = false; setSnapshotBusy(false); } }
  };

  const cancelDescription = () => {
    if (descriptionDraft !== undefined && descriptionDraft !== sheet?.description && !window.confirm('Отменить черновик описания?')) return;
    setDescriptionDraft(undefined);
  };
  const cancelField = (fieldId: string) => {
    if ((Object.prototype.hasOwnProperty.call(fieldDrafts, fieldId) || Boolean(validity[fieldId])) && !window.confirm('Отменить черновик поля?')) return;
    setFieldDrafts(current => { const next = { ...current }; delete next[fieldId]; return next; });
    setValidity(current => { const next = { ...current }; delete next[fieldId]; return next; });
    setResetCounters(current => ({ ...current, [fieldId]: (current[fieldId] ?? 0) + 1 }));
  };
  const cancelMetadata = () => {
    if (metadataDirty && !window.confirm('Отменить черновик метаданных?')) return;
    setMetadataDraft(undefined);
  };

  if (!metadata || !sheet) {
    if (metadataResource.error) return <ApiError error={metadataResource.error} onRetry={metadataResource.reload} />;
    if (sheetResource.error) return <ApiError error={sheetResource.error} onRetry={sheetResource.reload} />;
    return <p>Загрузка листа персонажа…</p>;
  }
  const ensureMetadataDraft = () => setMetadataDraft(current => current ?? { name: metadata.name, importance: metadata.importance });
  const permissionPending = permissionResource.loading || Boolean(permissionResource.error) || !permissionResource.data;
  const editorAllowed = Boolean(lastPermissionRef.current?.canWrite);
  const saveMetadata = async () => { if (metadataDraft) await metadataMutation.run(metadataDraft); };
  return <section className={`${styles.page} ${commonStyles.card}`}>
    <Link to={path(`/${campaignId}/${mode}/characters`)}>К персонажам</Link>
    <h2>{metadata.name}</h2>
    <p>{importanceLabel[metadata.importance] ?? metadata.importance}</p>
    <p>Шаблон: {metadata.templateId}</p>
    {permissionResource.loading && <p>Обновление прав персонажа…</p>}
    {Boolean(permissionResource.error) && <ApiError error={permissionResource.error} onRetry={permissionResource.reload} />}
    {permissionResource.data && !permissionResource.loading && !permissionResource.error && !permissionResource.data.canWrite && <p>Только чтение</p>}
    <label className={commonStyles.formGroup}>Персонаж<select className={inputStyles.input} value={characterId} onChange={event => {
      const selected = charactersResource.data?.find(character => character.id === event.target.value);
      if (selected) navigate(path(`/${campaignId}/${mode}/characters/${encodeURIComponent(selected.id)}/${stats ? 'stats' : 'overview'}`));
    }}><option value={characterId}>{metadata.name}</option>{charactersResource.data?.filter(character => character.id !== characterId).map(character => <option key={character.id} value={character.id}>{character.name}</option>)}</select></label>
    {charactersResource.loading && <p>Загрузка списка персонажей…</p>}
    {Boolean(charactersResource.error) && <ApiError error={charactersResource.error} onRetry={charactersResource.reload} />}
    <nav aria-label="Лист персонажа">
      <Link to={path(`/${campaignId}/${mode}/characters/${encodeURIComponent(characterId)}/overview`)} aria-current={!stats ? 'page' : undefined}>Обзор</Link>{' '}
      <Link to={path(`/${campaignId}/${mode}/characters/${encodeURIComponent(characterId)}/stats`)} aria-current={stats ? 'page' : undefined}>Характеристики</Link>
    </nav>
    {sheetBlocked && <p role="alert">Запись заблокирована до перечитывания снимка.</p>}
    {metadataBlocked && <p role="alert">Метаданные заблокированы до перечитывания снимка.</p>}
    {sheetSnapshot && <section aria-label="Снимок листа"><p>Серверное описание: {sheetSnapshot.description}</p>{sheetSnapshot.baseFields.map(field => <p key={field.id}>{field.title}: {stringifyJson(field.effectiveValue)}</p>)}</section>}
    {metadataSnapshot && <p>Серверные метаданные: {metadataSnapshot.name}</p>}
    {Boolean(snapshotError) && <ApiError error={snapshotError} />}
    {Boolean(writeError) && <ApiError error={writeError} />}
    {Boolean(metadataError) && <ApiError error={metadataError} />}
    {writeStatus && <p role="status">{writeStatus}</p>}
    <button className={buttonStyles.button} type="button" disabled={snapshotBusy || contentBusy} onClick={() => void rereadSheet()}>Перечитать лист</button>
    <button className={buttonStyles.button} type="button" disabled={snapshotBusy || metadataMutation.busy} onClick={() => void rereadMetadata()}>Перечитать метаданные</button>
    {stats ? <div>{sheet.baseFields.map(field => {
      const value = Object.prototype.hasOwnProperty.call(fieldDrafts, field.id) ? fieldDrafts[field.id] : field.effectiveValue;
      return <div key={field.id}>
        <fieldset disabled={permissionPending || !editorAllowed || contentBusy} className={commonStyles.card}>
          <label>{field.title}<ValueInput key={`${field.id}:${resetCounters[field.id] ?? 0}`} label={field.title} field={{ valueType: field.valueType, options: field.options }} value={value} disabled={!editorAllowed} onChange={next => { setWriteStatus(''); setFieldDrafts(current => ({ ...current, [field.id]: next })); }} onValidityChange={error => setValidity(current => current[field.id] === error ? current : { ...current, [field.id]: error })} /></label>
          <p>{field.description}</p><p>Тип: {field.valueType}</p><p>{field.isExplicit ? 'Задано явно' : 'Унаследовано'}</p>
          {editorAllowed && <>
          <button className={buttonStyles.button} type="button" disabled={!field.isExplicit || contentBusy || !canWrite} onClick={() => resetField(field.id)}>Сбросить {field.title}</button>
          <button className={buttonStyles.button} type="button" aria-label={`Сохранить ${field.title}`} disabled={!Object.prototype.hasOwnProperty.call(fieldDrafts, field.id) || Boolean(validity[field.id]) || contentBusy || sheetBlocked || !canWrite} onClick={() => saveField(field.id)}>Сохранить</button>
          <button className={buttonStyles.button} type="button" aria-label={`Отмена ${field.title}`} disabled={contentBusy || (!Object.prototype.hasOwnProperty.call(fieldDrafts, field.id) && !validity[field.id])} onClick={() => cancelField(field.id)}>Отмена</button>
        </>}
        </fieldset>
      </div>;
    })}</div> : <div>
      <label>Описание<textarea className={inputStyles.input} value={descriptionDraft ?? sheet.description} disabled={!canWrite} onChange={event => { setWriteStatus(''); setDescriptionDraft(event.target.value); }} /></label>
      {editorAllowed && <>
        <button className={buttonStyles.button} type="button" disabled={descriptionDraft === undefined || descriptionDraft === sheet.description || contentBusy || sheetBlocked || !canWrite} onClick={saveDescription}>Сохранить описание</button>
        <button className={buttonStyles.button} type="button" disabled={descriptionDraft === undefined || contentBusy || !canWrite} onClick={cancelDescription}>Отмена</button>
      </>}
    </div>}
    {editorAllowed && <fieldset className={commonStyles.card} disabled={permissionPending || !canWrite || metadataMutation.busy || metadataBlocked}>
      <label>Имя<input className={inputStyles.input} value={metadataDraft?.name ?? metadata.name} onFocus={ensureMetadataDraft} onChange={event => { ensureMetadataDraft(); setMetadataDraft(current => ({ ...(current ?? { name: metadata.name, importance: metadata.importance }), name: event.target.value })); }} /></label>
      <label>Важность<select className={inputStyles.input} value={metadataDraft?.importance ?? metadata.importance} onFocus={ensureMetadataDraft} onChange={event => { ensureMetadataDraft(); setMetadataDraft(current => ({ ...(current ?? { name: metadata.name, importance: metadata.importance }), importance: event.target.value as CharacterMetadata['importance'] })); }}><option value="Background">Фоновый</option><option value="Secondary">Второстепенный</option><option value="Key">Ключевой</option></select></label>
      <button className={buttonStyles.button} type="button" disabled={!metadataDirty || metadataMutation.busy || metadataBlocked || !canWrite} onClick={() => void saveMetadata()}>Сохранить метаданные</button>
      <button className={buttonStyles.button} type="button" disabled={!metadataDraft || metadataMutation.busy || !canWrite} onClick={cancelMetadata}>Отмена</button>
    </fieldset>}
  </section>;
};

export default CharacterSheet;
