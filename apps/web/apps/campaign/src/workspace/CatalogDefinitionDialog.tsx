import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Button, ModalPortal, Notification, StatePanel, useAuth } from '@tdn/shared';
import type { CatalogAttributeSchemaEnvelope, CatalogContentEnvelope, CatalogCreateResult, CatalogKind, CatalogMetadata } from './catalogTypes';
import type { Revision } from './types';
import { CampaignApiError } from './api';
import { useDirtyDraft, useWorkspace } from './Workspace';
import { ApiError } from './Feedback';
import { stringifyJson } from './json';
import { CatalogDefinitionFields, createCatalogDefinitionDraft } from './CatalogDefinitionFields';
import type { CatalogDefinitionDraft } from './CatalogDefinitionFields';

type Domain = 'metadata' | 'content';
type RecoverySnapshot = { metadata: CatalogMetadata; content: CatalogContentEnvelope };

export type CatalogDefinitionDialogProps = {
  campaignId: number;
  entryId?: string;
  initialKind?: CatalogKind;
  canAdmin: boolean;
  permissionsPending?: boolean;
  onClose: () => void;
  onSaved: (metadata: CatalogMetadata, content?: CatalogContentEnvelope) => void;
  onForbidden: () => void;
};

function draftFromServer(metadata: CatalogMetadata, content: CatalogContentEnvelope): CatalogDefinitionDraft {
  return {
    name: metadata.name,
    kind: metadata.kind,
    isHidden: metadata.isHidden,
    quantityUnit: metadata.quantityUnit,
    allowNegative: metadata.allowNegative,
    description: content.data.description,
    attributes: content.data.attributes,
  };
}

function safeFailureMessage(error: unknown): string {
  if (!(error instanceof CampaignApiError)) return 'Не удалось выполнить операцию. Попробуйте ещё раз.';
  if (error.unknownOutcome || error.status === 0) return 'Результат записи пока не подтверждён. Проверьте актуальные данные перед продолжением.';
  if (error.status === 400) return 'Проверьте введённые данные.';
  if (error.status === 403) return 'Право записи больше недоступно.';
  if (error.status === 404) return 'Не удалось подтвердить созданную запись каталога.';
  if (error.status === 409) return 'Данные изменились на сервере. Перечитайте актуальную версию.';
  if (error.status === 503) return 'Сервис временно недоступен.';
  return 'Не удалось выполнить операцию. Попробуйте ещё раз.';
}

function isDuplicatePublication(error: unknown): boolean {
  return error instanceof CampaignApiError
    && ['creation_already_published', 'already_published', 'content_already_prepared'].includes(error.problem.code);
}

function isRecoverableWriteFailure(error: unknown): boolean {
  return error instanceof CampaignApiError && (error.conflict || error.unknownOutcome || error.status === 0);
}

function metadataDraftEqual(draft: CatalogDefinitionDraft, metadata: CatalogMetadata): boolean {
  return draft.name === metadata.name
    && draft.isHidden === metadata.isHidden
    && draft.quantityUnit === metadata.quantityUnit
    && draft.allowNegative === metadata.allowNegative;
}

function contentDraftEqual(draft: CatalogDefinitionDraft, content: CatalogContentEnvelope): boolean {
  return stringifyJson({ description: draft.description, attributes: draft.attributes })
    === stringifyJson(content.data);
}

function getExpectedRevision(value: Revision): number | import('lossless-json').LosslessNumber {
  return value;
}

const CatalogDefinitionDialog: React.FC<CatalogDefinitionDialogProps> = ({
  campaignId,
  entryId,
  initialKind = 'Item',
  canAdmin,
  permissionsPending = false,
  onClose,
  onSaved,
  onForbidden,
}) => {
  const { api, sessionKey } = useWorkspace();
  const auth = useAuth();
  const requestIdRef = useRef<string | null>(null);
  const requestId = requestIdRef.current ?? (requestIdRef.current = crypto.randomUUID());
  const busyRef = useRef(false);
  const recoveryBusyRef = useRef(false);
  const mountedRef = useRef(false);
  const readGeneration = useRef(0);
  const onCloseRef = useRef(onClose);
  const onSavedRef = useRef(onSaved);
  const onForbiddenRef = useRef(onForbidden);
  onCloseRef.current = onClose;
  onSavedRef.current = onSaved;
  onForbiddenRef.current = onForbidden;

  const [draft, setDraft] = useState<CatalogDefinitionDraft>(() => createCatalogDefinitionDraft(initialKind));
  const [metadataBaseline, setMetadataBaseline] = useState<CatalogMetadata>();
  const [contentBaseline, setContentBaseline] = useState<CatalogContentEnvelope>();
  const [schema, setSchema] = useState<CatalogAttributeSchemaEnvelope>();
  const [loading, setLoading] = useState(true);
  const [loadingError, setLoadingError] = useState<unknown>();
  const [busy, setBusy] = useState(false);
  const [recovering, setRecovering] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const [fieldsGeneration, setFieldsGeneration] = useState(0);
  const [failure, setFailure] = useState<unknown>();
  const [status, setStatus] = useState('');
  const [revoked, setRevoked] = useState(false);
  const [blockedDomains, setBlockedDomains] = useState<Set<Domain>>(() => new Set());
  const [recoverySnapshots, setRecoverySnapshots] = useState<Partial<Record<Domain, RecoverySnapshot>>>({});
  const [creationBlocked, setCreationBlocked] = useState(false);
  const [creationCheckFailed, setCreationCheckFailed] = useState(false);

  const userId = Number(auth.userId);
  const isOwner = Boolean(metadataBaseline && metadataBaseline.creatorUserId !== null && metadataBaseline.creatorUserId === userId);
  const canEdit = !permissionsPending && !revoked && (canAdmin || isOwner);
  const canPublish = !permissionsPending && !revoked && canAdmin;
  const writeAllowedRef = useRef(canEdit);
  const publishAllowedRef = useRef(canPublish);
  writeAllowedRef.current = canEdit;
  publishAllowedRef.current = canPublish;
  const metadataDirty = Boolean(metadataBaseline && !metadataDraftEqual(draft, metadataBaseline));
  const contentDirty = Boolean(contentBaseline && !contentDraftEqual(draft, contentBaseline));
  const creationDirty = !entryId && (draft.name !== '' || draft.isHidden || draft.description !== '' || draft.attributes.length > 0
    || draft.quantityUnit !== (initialKind === 'Item' ? 'Whole' : null) || draft.allowNegative);
  const dirty = entryId
    ? metadataDirty || contentDirty || invalid
    : creationDirty || (invalid && draft.attributes.length > 0) || creationBlocked;
  const ownerKey = `catalog-definition-${sessionKey}-${campaignId}-${entryId ?? `new-${requestId}`}`;
  useDirtyDraft(ownerKey, dirty || blockedDomains.size > 0);

  const reportForbidden = useCallback(() => {
    if (!mountedRef.current) return;
    setRevoked(true);
    onForbiddenRef.current();
  }, []);

  const loadInitial = useCallback(async () => {
    const generation = ++readGeneration.current;
    setLoading(true);
    setLoadingError(undefined);
    try {
      if (entryId) {
        const [metadata, content, attributeSchema] = await Promise.all([
          api.getCatalogEntry(campaignId, entryId),
          api.getCatalogContent(campaignId, entryId),
          api.getCatalogAttributes(campaignId),
        ]);
        if (!mountedRef.current || generation !== readGeneration.current) return;
        setMetadataBaseline(metadata);
        setContentBaseline(content);
        setSchema(attributeSchema);
        setDraft(draftFromServer(metadata, content));
      } else {
        const attributeSchema = await api.getCatalogAttributes(campaignId);
        if (!mountedRef.current || generation !== readGeneration.current) return;
        setSchema(attributeSchema);
      }
    } catch (error) {
      if (!mountedRef.current || generation !== readGeneration.current) return;
      setLoadingError(error);
      if ((error as { status?: number })?.status === 403) reportForbidden();
    } finally {
      if (mountedRef.current && generation === readGeneration.current) setLoading(false);
    }
  }, [api, campaignId, entryId, reportForbidden]);

  useEffect(() => {
    mountedRef.current = true;
    void loadInitial();
    return () => {
      mountedRef.current = false;
      readGeneration.current += 1;
    };
  }, [loadInitial]);

  const close = () => {
    if (busyRef.current || recoveryBusyRef.current || recovering) return;
    if ((dirty || blockedDomains.size > 0 || creationBlocked)
      && !window.confirm('Закрыть и потерять несохранённые изменения и состояние восстановления?')) return;
    onCloseRef.current();
  };

  const acceptCreated = (created: CatalogCreateResult) => {
    if (!mountedRef.current) return;
    setCreationBlocked(false);
    setCreationCheckFailed(false);
    onSavedRef.current(created.entry, created.content);
    onCloseRef.current();
  };

  const lookupCreated = async () => {
    setCreationBlocked(true);
    setCreationCheckFailed(false);
    setFailure(undefined);
    try {
      const [entry, content] = await Promise.all([
        api.getCatalogEntry(campaignId, requestId),
        api.getCatalogContent(campaignId, requestId),
      ]);
      if (!mountedRef.current) return false;
      acceptCreated({ entry, content });
      return true;
    } catch (error) {
      if (mountedRef.current) {
        setCreationCheckFailed(true);
        setFailure(error);
      }
      return false;
    }
  };

  const saveCreation = async () => {
    if (!publishAllowedRef.current || invalid || !draft.name.trim() || busyRef.current || recoveryBusyRef.current || creationBlocked) return;
    const request = {
      requestId,
      name: draft.name,
      kind: initialKind,
      isHidden: draft.isHidden,
      ...(initialKind === 'Item' ? { quantityUnit: draft.quantityUnit ?? 'Whole' } : { quantityUnit: null }),
      allowNegative: initialKind === 'Item' && draft.allowNegative,
      description: draft.description,
      attributes: draft.attributes,
    };
    busyRef.current = true;
    setBusy(true);
    setFailure(undefined);
    setStatus('');
    try {
      const created = await api.createCatalogEntry(campaignId, request);
      acceptCreated(created);
    } catch (error) {
      if (!mountedRef.current) return;
      if ((error as { status?: number })?.status === 403) reportForbidden();
      if (isDuplicatePublication(error) || (error instanceof CampaignApiError && error.unknownOutcome)) {
        setCreationBlocked(true);
        setFailure(error);
        await lookupCreated();
      } else {
        setFailure(error);
      }
    } finally {
      busyRef.current = false;
      if (mountedRef.current) setBusy(false);
    }
  };

  const saveExisting = async () => {
    if (!entryId || !metadataBaseline || !contentBaseline || !canEdit || invalid || busyRef.current || recoveryBusyRef.current || blockedDomains.size > 0) return;
    if (!metadataDirty && !contentDirty) return;
    busyRef.current = true;
    setBusy(true);
    setFailure(undefined);
    setStatus('');
    let metadataSaved = false;
    let savedMetadataBaseline = metadataBaseline;
    let activeDomain: Domain = metadataDirty ? 'metadata' : 'content';
    try {
      if (metadataDirty) {
        const result = await api.putCatalogMetadata(campaignId, entryId, {
          name: draft.name,
          expectedRevision: getExpectedRevision(metadataBaseline.metadataRevision),
          ...(canPublish && draft.isHidden !== metadataBaseline.isHidden ? { isHidden: draft.isHidden } : {}),
          ...(draft.quantityUnit !== metadataBaseline.quantityUnit ? { quantityUnit: draft.quantityUnit } : {}),
          ...(draft.allowNegative !== metadataBaseline.allowNegative ? { allowNegative: draft.allowNegative } : {}),
        });
        if (!mountedRef.current) return;
        metadataSaved = true;
        savedMetadataBaseline = result;
        setMetadataBaseline(result);
        setDraft(current => ({
          ...current,
          name: result.name,
          isHidden: result.isHidden,
          quantityUnit: result.quantityUnit,
          allowNegative: result.allowNegative,
        }));
        onSavedRef.current(result);
        setStatus('Метаданные подтверждённо сохранены.');
      }
      if (contentDirty && mountedRef.current) {
        if (!writeAllowedRef.current) {
          setStatus(metadataSaved
            ? 'Метаданные подтверждённо сохранены. Запись содержимого остановлена, так как право доступа изменилось.'
            : 'Запись содержимого остановлена, так как право доступа изменилось.');
          return;
        }
        activeDomain = 'content';
        const result = await api.putCatalogContent(campaignId, entryId, {
          expectedRevision: getExpectedRevision(contentBaseline.contentRevision),
          description: draft.description,
          attributes: draft.attributes,
        });
        if (!mountedRef.current) return;
        setContentBaseline(result);
        setDraft(current => ({ ...current, description: result.data.description, attributes: result.data.attributes }));
        setFieldsGeneration(value => value + 1);
        onSavedRef.current(savedMetadataBaseline, result);
        setStatus(metadataSaved ? 'Метаданные и содержимое подтверждённо сохранены.' : 'Содержимое подтверждённо сохранено.');
      }
    } catch (error) {
      if (!mountedRef.current) return;
      setFailure(error);
      if ((error as { status?: number })?.status === 403) reportForbidden();
      if (isRecoverableWriteFailure(error)) setBlockedDomains(current => new Set(current).add(activeDomain));
    } finally {
      busyRef.current = false;
      if (mountedRef.current) setBusy(false);
    }
  };

  const save = () => {
    if (entryId) void saveExisting();
    else void saveCreation();
  };

  const readRecovery = async (domain: Domain) => {
    if (!entryId || busyRef.current || recoveryBusyRef.current) return;
    recoveryBusyRef.current = true;
    setRecovering(true);
    setFailure(undefined);
    setRecoverySnapshots(current => {
      const next = { ...current };
      delete next[domain];
      return next;
    });
    try {
      const [metadata, content] = await Promise.all([
        api.getCatalogEntry(campaignId, entryId),
        api.getCatalogContent(campaignId, entryId),
      ]);
      if (!mountedRef.current) return;
      setRecoverySnapshots(current => ({ ...current, [domain]: { metadata, content } }));
      onSavedRef.current(metadata, content);
    } catch (error) {
      if (!mountedRef.current) return;
      setFailure(error);
      if ((error as { status?: number })?.status === 403) reportForbidden();
    } finally {
      recoveryBusyRef.current = false;
      if (mountedRef.current) setRecovering(false);
    }
  };

  const resolveRecovery = (domain: Domain, action: 'accept' | 'keep') => {
    const snapshot = recoverySnapshots[domain];
    if (!snapshot || !blockedDomains.has(domain)) return;
    if (action === 'accept' && !window.confirm('Заменить черновик этого раздела актуальной серверной версией?')) return;
    if (domain === 'metadata') {
      setMetadataBaseline(snapshot.metadata);
      if (action === 'accept') {
        setDraft(current => ({
          ...current,
          name: snapshot.metadata.name,
          isHidden: snapshot.metadata.isHidden,
          quantityUnit: snapshot.metadata.quantityUnit,
          allowNegative: snapshot.metadata.allowNegative,
        }));
      }
    } else {
      setContentBaseline(snapshot.content);
      if (action === 'accept') {
        setDraft(current => ({ ...current, description: snapshot.content.data.description, attributes: snapshot.content.data.attributes }));
        setFieldsGeneration(value => value + 1);
      }
    }
    setBlockedDomains(current => {
      const next = new Set(current);
      next.delete(domain);
      return next;
    });
    setRecoverySnapshots(current => {
      const next = { ...current };
      delete next[domain];
      return next;
    });
    setFailure(undefined);
    setStatus(action === 'accept'
      ? `Принята серверная версия: ${domain === 'metadata' ? 'метаданные' : 'содержимое'}.`
      : `Черновик сохранён локально; актуальная ревизия принята для следующего явного сохранения: ${domain === 'metadata' ? 'метаданные' : 'содержимое'}.`);
  };

  const entryKind = metadataBaseline?.kind ?? initialKind;
  const kindName = entryKind === 'Item' ? 'предмет' : 'навык';
  const kindGenitive = entryKind === 'Item' ? 'предмета' : 'навыка';
  const title = entryId ? metadataBaseline?.name ?? (entryKind === 'Item' ? 'Предмет' : 'Навык') : `Новый ${kindName}`;
  const fieldReadOnly = !canEdit || loading || Boolean(loadingError);
  const fieldDisabled = busy || recovering || permissionsPending || revoked;

  return <ModalPortal isOpen onClose={close} title={title} size="wide" dismissDisabled={busy || recovering}>
    {loading && <StatePanel kind="loading">Загрузка {kindGenitive} и схемы атрибутов…</StatePanel>}
    {!loading && Boolean(loadingError) && <>
      <ApiError error={loadingError} />
      <p role="alert">Не удалось загрузить полные данные {entryKind === 'Item' ? 'предмета' : 'навыка'}. Редактирование недоступно.</p>
      <Button type="button" onClick={() => void loadInitial()}>Повторить чтение</Button>
    </>}
    {!loading && !loadingError && schema && (!entryId || Boolean(metadataBaseline && contentBaseline)) ? <>
      {permissionsPending && <p role="status">Проверка прав. До её завершения доступно только чтение.</p>}
      {revoked && <p role="alert">Запись заблокирована после отказа сервера. Проверьте права кампании.</p>}
      <CatalogDefinitionFields
        key={fieldsGeneration}
        draft={draft}
        onChange={setDraft}
        definitions={schema.data.definitions}
        canPublish={canPublish}
        readOnly={fieldReadOnly}
        disabled={fieldDisabled}
        diagnostics={contentBaseline?.diagnostics}
        onValidityChange={setInvalid}
      />
      {Boolean(failure) && <>
        <ApiError error={failure} />
        <p role="alert">{safeFailureMessage(failure)}</p>
      </>}
      {status && <p role="status">{status}</p>}
      {creationBlocked && <section>
        <h3>Проверка публикации</h3>
        <p>Повторная отправка заблокирована. Проверьте результат запроса тем же идентификатором; выполняются только чтения.</p>
        {creationCheckFailed && <p role="alert">Создание {kindGenitive} пока не подтверждено. Проверку можно повторить.</p>}
        <Button type="button" disabled={busy} onClick={() => {
          if (busyRef.current) return;
          busyRef.current = true;
          setBusy(true);
          void lookupCreated().finally(() => {
            busyRef.current = false;
            if (mountedRef.current) setBusy(false);
          });
        }}>Проверить результат</Button>
      </section>}
      {entryId && blockedDomains.size > 0 && <section>
        <h3>Восстановление сохранения</h3>
        {[...blockedDomains].map(domain => {
          const snapshot = recoverySnapshots[domain];
          const label = domain === 'metadata' ? 'метаданных' : 'содержимого';
          return <div key={domain}>
            <p>Запись {label} остановлена до явного перечитывания актуальной версии.</p>
            {!snapshot
              ? <Button type="button" disabled={recovering || busy} onClick={() => void readRecovery(domain)}>Перечитать серверные данные</Button>
              : <>
                <p>Серверная версия прочитана. Выберите, как продолжить.</p>
                <Button type="button" disabled={recovering || busy} onClick={() => resolveRecovery(domain, 'accept')}>Принять серверную версию</Button>
                <Button type="button" variant="secondary" disabled={recovering || busy} onClick={() => resolveRecovery(domain, 'keep')}>Оставить мой черновик</Button>
              </>}
          </div>;
        })}
      </section>}
      {!fieldReadOnly && <Button type="button" disabled={busy || recovering || invalid || !draft.name.trim() || blockedDomains.size > 0 || creationBlocked || (entryId ? !metadataDirty && !contentDirty : !canPublish)} onClick={save}>
        {busy ? 'Сохранение…' : 'Сохранить'}
      </Button>}
      <Button type="button" variant="secondary" disabled={busy || recovering} onClick={close}>Отмена</Button>
    </> : null}
    {!loading && !loadingError && !schema && <Notification kind="error">Схема атрибутов недоступна. Сохранение невозможно.</Notification>}
  </ModalPortal>;
};

export default CatalogDefinitionDialog;
