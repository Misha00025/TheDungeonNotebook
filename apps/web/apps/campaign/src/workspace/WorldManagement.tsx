import React, { useEffect, useId, useRef, useState } from 'react';
import { ActionRow, Badge, Button, Checkbox, Field, FieldSet, IconButton, Input, List, MarkdownEditor, MarkdownViewer, Notification, Panel, StatePanel, Textarea, Toolbar } from '@tdn/shared';
import { useDirtyDraft, useWorkspace } from './Workspace';
import { useCampaignWorkspace } from './Shell';
import { useResource } from './hooks';
import { CampaignApiError } from './api';
import type { WorldKind, WorldMaterial, WorldMaterialBody, WorldMaterialCreateResult } from './types';
import styles from './World.module.css';

type WorldMetadataDraft = { title: string; description: string; tags: string[]; isPublished: boolean };
const makeMetadataDraft = (material: WorldMaterial): WorldMetadataDraft => ({
  title: material.title,
  description: material.description,
  tags: [...material.tags],
  isPublished: material.isPublished,
});
const sameTags = (left: string[], right: string[]) => left.length === right.length && left.every((tag, index) => tag === right[index]);
const metadataDraftMatches = (draft: WorldMetadataDraft, material: WorldMaterial) =>
  draft.title === material.title
  && draft.description === material.description
  && sameTags(draft.tags, material.tags)
  && draft.isPublished === material.isPublished;
const recoverableWrite = (error: unknown) => error instanceof CampaignApiError
  && (error.conflict || error.unknownOutcome || error.status === 0);
const isNotFound = (error: unknown) => error instanceof CampaignApiError && error.status === 404;

export const WorldErrorPanel: React.FC<{ error: unknown; onRetry?: () => void; notFoundMessage?: string }> = ({ error, onRetry, notFoundMessage = 'Материал недоступен или не найден' }) => {
  const apiError = error instanceof CampaignApiError ? error : undefined;
  const message = apiError?.unknownOutcome || apiError?.status === 0
    ? 'Результат операции неизвестен. Проверьте данные перед продолжением.'
    : apiError?.status === 400 ? 'Проверьте введённые данные.'
      : apiError?.status === 403 ? 'Доступ к материалу изменился.'
        : apiError?.status === 404 ? notFoundMessage
          : apiError?.status === 409 ? 'Данные изменились. Проверьте актуальную версию перед продолжением.'
            : apiError?.status === 503 ? 'Сервис временно недоступен.'
              : 'Не удалось выполнить операцию.';
  return <StatePanel kind={apiError?.status === 404 ? 'empty' : 'error'} actions={onRetry
    ? <ActionRow><Button type="button" size="small" onClick={onRetry}>Повторить</Button></ActionRow>
    : undefined}>{message}</StatePanel>;
};

const WorldTagsEditor: React.FC<{
  idPrefix: string;
  tags: string[];
  disabled: boolean;
  onChange: (tags: string[]) => void;
}> = ({ idPrefix, tags, disabled, onChange }) => <FieldSet legend="Теги" className={styles.tagEditor}>
  {tags.length > 0 && <List layout="vertical" gap="small" stretch className={styles.tagList}>
    {tags.map((tag, index) => {
      const id = `${idPrefix}-tag-${index}`;
      const errorId = `${id}-error`;
      return <ActionRow key={index} className={styles.tagRow}>
        <Input variant="single-line" id={id} aria-label={`Тег ${index + 1}`} aria-describedby={tag.length === 0 ? errorId : undefined} value={tag} disabled={disabled} aria-invalid={tag.length === 0 ? 'true' : undefined} onChange={event => onChange(tags.map((value, itemIndex) => itemIndex === index ? event.target.value : value))} />
        <IconButton icon="delete" title={`Удалить тег ${index + 1}`} ariaLabel={`Удалить тег ${index + 1}`} size="small" variant="secondary" disabled={disabled} onClick={() => onChange(tags.filter((_, itemIndex) => itemIndex !== index))} />
        {tag.length === 0 && <span id={errorId} className={styles.tagError} role="alert">Тег не может быть пустым. Введите значение или удалите поле.</span>}
      </ActionRow>;
    })}
  </List>}
  <ActionRow><Button type="button" size="small" variant="secondary" disabled={disabled} onClick={() => onChange([...tags, ''])}>Добавить тег</Button></ActionRow>
</FieldSet>;

const WorldTagsDisplay: React.FC<{ tags: string[] }> = ({ tags }) => tags.length > 0
  ? <FieldSet legend="Теги"><List layout="horizontal" gap="small">{tags.map((tag, index) => <Badge key={`${index}:${tag}`}>{tag}</Badge>)}</List></FieldSet>
  : null;
export const CreateWorldMaterialPage: React.FC<{
  campaignId: number;
  kind: WorldKind;
  scope: string;
  canWrite: boolean;
  permissionsLoading: boolean;
  onCancel: () => void;
  onCreated: (material: WorldMaterial, body?: WorldMaterialBody) => void;
}> = ({ campaignId, kind, scope, canWrite, permissionsLoading, onCancel, onCreated }) => {
  const { api } = useWorkspace();
  const { reloadPermissions } = useCampaignWorkspace();
  const [requestId] = useState(() => crypto.randomUUID());
  const busyRef = useRef(false);
  const mountedRef = useRef(true);
  const titleId = useId();
  const descriptionId = useId();
  const tagsId = useId();
  const bodyId = useId();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [body, setBody] = useState('');
  const [isPublished, setIsPublished] = useState(false);
  const [createdMaterial, setCreatedMaterial] = useState<WorldMaterial>();
  const [createdBodyVersion, setCreatedBodyVersion] = useState('');
  const [publicationRecovery, setPublicationRecovery] = useState<'check' | 'ready'>();
  const [publicationFailure, setPublicationFailure] = useState<unknown>();
  const [busy, setBusy] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [failure, setFailure] = useState<unknown>();
  const [checkFailure, setCheckFailure] = useState<unknown>();
  const [titleError, setTitleError] = useState('');
  const [forbidden, setForbidden] = useState(false);
  const dirty = Boolean(title || description || tags.length > 0 || body || blocked || createdMaterial);
  const hasEmptyTag = tags.some(tag => tag.length === 0);
  const clearDirty = useDirtyDraft(`world-create-${scope}-${requestId}`, dirty || busy);
  const writeAllowed = canWrite && !permissionsLoading && !forbidden;

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);
  useEffect(() => {
    if (!permissionsLoading && canWrite) setForbidden(false);
  }, [canWrite, permissionsLoading]);

  const cancel = () => {
    if (busyRef.current) return;
    onCancel();
  };

  const checkCreation = async () => {
    if (!blocked || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setCheckFailure(undefined);
    try {
      const material = await api.getWorldMaterial(campaignId, kind, requestId);
      if (mountedRef.current) {
        if (isPublished && !material.isPublished) {
          setCreatedMaterial(material);
          setCreatedBodyVersion('');
          setBlocked(false);
          setFailure(undefined);
          setPublicationFailure(undefined);
          try {
            const published = await api.updateWorldMaterial(campaignId, kind, material.id, {
              title: material.title,
              description: material.description,
              tags: material.tags,
              isPublished: true,
              expectedRevision: material.metadataRevision,
            });
            if (mountedRef.current) {
              clearDirty();
              onCreated(published);
            }
          } catch (error) {
            if (mountedRef.current) {
              setPublicationFailure(error);
              setPublicationRecovery('check');
              if (error instanceof CampaignApiError && error.status === 403) {
                setForbidden(true);
                reloadPermissions();
              }
            }
          }
        } else {
          clearDirty();
          onCreated(material);
        }
      }
    } catch (error) {
      if (mountedRef.current) {
        setCheckFailure(error);
        if (error instanceof CampaignApiError && error.status === 403) {
          setForbidden(true);
          reloadPermissions();
        }
      }
    } finally {
      busyRef.current = false;
      if (mountedRef.current) setBusy(false);
    }
  };

  const checkPublication = async () => {
    if (!createdMaterial || publicationRecovery !== 'check' || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setCheckFailure(undefined);
    try {
      const latest = await api.getWorldMaterial(campaignId, kind, createdMaterial.id);
      if (!mountedRef.current) return;
      if (latest.isPublished) {
        clearDirty();
        onCreated(latest, createdBodyVersion ? { body, bodyVersion: createdBodyVersion } : undefined);
      } else {
        setCreatedMaterial(latest);
        setPublicationRecovery('ready');
      }
    } catch (error) {
      if (mountedRef.current) {
        setCheckFailure(error);
        if (error instanceof CampaignApiError && error.status === 403) {
          setForbidden(true);
          reloadPermissions();
        }
      }
    } finally {
      busyRef.current = false;
      if (mountedRef.current) setBusy(false);
    }
  };

  const publishCreated = async () => {
    if (!createdMaterial || publicationRecovery !== 'ready' || !writeAllowed || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setPublicationFailure(undefined);
    try {
      const published = await api.updateWorldMaterial(campaignId, kind, createdMaterial.id, {
        title: createdMaterial.title,
        description: createdMaterial.description,
        tags: createdMaterial.tags,
        isPublished: true,
        expectedRevision: createdMaterial.metadataRevision,
      });
      if (mountedRef.current) {
        clearDirty();
        onCreated(published, createdBodyVersion ? { body, bodyVersion: createdBodyVersion } : undefined);
      }
    } catch (error) {
      if (mountedRef.current) {
        setPublicationFailure(error);
        setPublicationRecovery('check');
        if (error instanceof CampaignApiError && error.status === 403) {
          setForbidden(true);
          reloadPermissions();
        }
      }
    } finally {
      busyRef.current = false;
      if (mountedRef.current) setBusy(false);
    }
  };

  const submit = async () => {
    if (!writeAllowed || blocked || busyRef.current) return;
    if (!title.trim()) {
      setTitleError('Введите название материала.');
      return;
    }
    if (hasEmptyTag) return;
    setTitleError('');
    busyRef.current = true;
    setBusy(true);
    setFailure(undefined);
    try {
      const result: WorldMaterialCreateResult = await api.createWorldMaterial(campaignId, kind, {
        requestId,
        title,
        description,
        tags,
        body,
      });
      if (mountedRef.current) {
        if (isPublished) {
          setCreatedMaterial(result.material);
          setCreatedBodyVersion(result.bodyVersion);
          setBusy(true);
          try {
            const published = await api.updateWorldMaterial(campaignId, kind, result.material.id, {
              title: result.material.title,
              description: result.material.description,
              tags: result.material.tags,
              isPublished: true,
              expectedRevision: result.material.metadataRevision,
            });
            if (mountedRef.current) {
              clearDirty();
              onCreated(published, { body, bodyVersion: result.bodyVersion });
            }
          } catch (error) {
            if (mountedRef.current) {
              setPublicationFailure(error);
              setPublicationRecovery('check');
              if (error instanceof CampaignApiError && error.status === 403) {
                setForbidden(true);
                reloadPermissions();
              }
            }
          }
          return;
        }
        clearDirty();
        onCreated(result.material, { body, bodyVersion: result.bodyVersion });
      }
    } catch (error) {
      if (mountedRef.current) {
        setFailure(error);
        if (recoverableWrite(error)) setBlocked(true);
        if (error instanceof CampaignApiError && error.status === 403) {
          setForbidden(true);
          reloadPermissions();
        }
      }
    } finally {
      busyRef.current = false;
      if (mountedRef.current) setBusy(false);
    }
  };

  return <Panel className={styles.createPage}>
      <>
          <div className={styles.createFields}>
            <Field label="Название" htmlFor={titleId} error={titleError || undefined}>
              <Input variant="single-line" id={titleId} value={title} disabled={busy || Boolean(createdMaterial)} aria-invalid={titleError ? 'true' : undefined} onChange={event => { setTitle(event.target.value); setTitleError(''); }} />
            </Field>
            <Field label="Описание" htmlFor={descriptionId}>
              <Textarea variant="multiline" rows={6} id={descriptionId} value={description} disabled={busy || Boolean(createdMaterial)} onChange={event => setDescription(event.target.value)} />
            </Field>
          <WorldTagsEditor idPrefix={tagsId} tags={tags} disabled={busy || Boolean(createdMaterial)} onChange={setTags} />
          </div>
          <Field label="Открыть игрокам" htmlFor={`${bodyId}-published`}>
            <Checkbox id={`${bodyId}-published`} checked={isPublished} disabled={busy || Boolean(createdMaterial)} onChange={event => setIsPublished(event.target.checked)} />
          </Field>
          <MarkdownEditor id={bodyId} value={body} onChange={setBody} disabled={busy || Boolean(createdMaterial)} height={400} preview="edit" textareaProps={{ 'aria-label': 'Текст материала' }} />
        {!writeAllowed && <StatePanel kind="info">{permissionsLoading ? 'Проверяются права записи. Команды временно заблокированы.' : 'Право записи недоступно. Черновик сохранён.'}</StatePanel>}
        {blocked && <StatePanel kind="info" actions={<ActionRow><Button type="button" size="small" disabled={busy} onClick={() => void checkCreation()}>Проверить создание</Button></ActionRow>}>
          Результат создания не подтверждён. Черновик и идентификатор операции сохранены; повторное создание не выполняется.
        </StatePanel>}
        {failure && <WorldErrorPanel error={failure} />}
        {checkFailure && <WorldErrorPanel error={checkFailure} notFoundMessage="Создание пока не подтверждено. Повторная отправка не выполнялась." />}
        {createdMaterial && publicationRecovery && <StatePanel kind="info" actions={<ActionRow>
          {publicationRecovery === 'check'
            ? <Button type="button" size="small" disabled={busy} onClick={() => void checkPublication()}>Проверить публикацию</Button>
            : <Button type="button" size="small" disabled={!writeAllowed || busy} onClick={() => void publishCreated()}>Открыть игрокам</Button>}
        </ActionRow>}>
          Создание материала подтверждено, но публикация ещё не подтверждена. Материал и текст сохранены; повторное создание не выполняется.
        </StatePanel>}
        {publicationFailure && <WorldErrorPanel error={publicationFailure} />}
        <ActionRow justify="end">
          {!blocked && !createdMaterial && <Button type="button" size="small" disabled={!writeAllowed || busy || hasEmptyTag} onClick={() => void submit()}>Создать</Button>}
          <Button variant="secondary" size="small" type="button" disabled={busy} onClick={cancel}>{blocked ? 'Отказаться от проверки' : 'Отмена'}</Button>
        </ActionRow>
      </>
  </Panel>;
};

export const WorldMaterialDetail: React.FC<{
  campaignId: number;
  kind: WorldKind;
  mode: 'gm' | 'player';
  materialId: string;
  scope: string;
  canWrite: boolean;
  permissionsLoading: boolean;
  onBack: () => void;
  initialMaterial?: WorldMaterial;
  initialBody?: WorldMaterialBody;
  initialEditRequested?: boolean;
}> = ({ campaignId, kind, mode, materialId, scope, canWrite, permissionsLoading, onBack, initialMaterial, initialBody, initialEditRequested = false }) => {
  const { api } = useWorkspace();
  const { reloadPermissions } = useCampaignWorkspace();
  const metadata = useResource(`${scope}:material:${materialId}`, () => api.getWorldMaterial(campaignId, kind, materialId));
  const bodyCard = metadata.data ?? initialMaterial;
  const bodyEnabled = Boolean(bodyCard && (mode === 'gm' || bodyCard.isPublished));
  const body = useResource(`${scope}:body:${materialId}`, () => api.getWorldBody(campaignId, kind, materialId), bodyEnabled);
  const [editing, setEditing] = useState(false);
  const [editRequested, setEditRequested] = useState(initialEditRequested);
  const [metadataDraft, setMetadataDraft] = useState<WorldMetadataDraft>();
  const [bodyDraft, setBodyDraft] = useState<string>();
  const [metadataFailure, setMetadataFailure] = useState<unknown>();
  const [bodyFailure, setBodyFailure] = useState<unknown>();
  const [metadataBlocked, setMetadataBlocked] = useState(false);
  const [bodyBlocked, setBodyBlocked] = useState(false);
  const [metadataCheckFailure, setMetadataCheckFailure] = useState<unknown>();
  const [bodyCheckFailure, setBodyCheckFailure] = useState<unknown>();
  const [metadataVerified, setMetadataVerified] = useState(false);
  const [bodyVerified, setBodyVerified] = useState(false);
  const [metadataChecking, setMetadataChecking] = useState(false);
  const [bodyChecking, setBodyChecking] = useState(false);
  const [metadataSaving, setMetadataSaving] = useState(false);
  const [bodySaving, setBodySaving] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteBlocked, setDeleteBlocked] = useState(false);
  const [deleteFailure, setDeleteFailure] = useState<unknown>();
  const [deleteCheckFailure, setDeleteCheckFailure] = useState<unknown>();
  const [deleteVerified, setDeleteVerified] = useState(false);
  const [deleteChecking, setDeleteChecking] = useState(false);
  const [deleteMissing, setDeleteMissing] = useState(false);
  const [forbidden, setForbidden] = useState(false);
  const [metadataTitleError, setMetadataTitleError] = useState('');
  const metadataBusyRef = useRef(false);
  const bodyBusyRef = useRef(false);
  const metadataCheckBusyRef = useRef(false);
  const bodyCheckBusyRef = useRef(false);
  const deleteBusyRef = useRef(false);
  const deleteCheckBusyRef = useRef(false);
  const titleId = useId();
  const descriptionId = useId();
  const tagsId = useId();
  const publishedId = useId();
  const bodyId = useId();
  const item = metadata.data;
  const bodyData = body.data;
  const metadataDirty = Boolean(item && metadataDraft && !metadataDraftMatches(metadataDraft, item));
  const bodyDirty = Boolean(bodyData && bodyDraft !== undefined && bodyDraft !== bodyData.body);
  const hasEmptyMetadataTag = Boolean(metadataDraft?.tags.some(tag => tag.length === 0));
  const clearDirty = useDirtyDraft(`world-material-${scope}-${materialId}`, editing && (metadataDirty || bodyDirty || metadataBlocked || bodyBlocked || metadataSaving || bodySaving) || deleteBlocked || deleteBusy);
  const writeAllowed = mode === 'gm' && canWrite && !permissionsLoading && !forbidden;
  const unavailableToPlayer = mode === 'player' && item && !item.isPublished;

  useEffect(() => {
    if (initialMaterial && !metadata.data) metadata.setData(initialMaterial);
  }, [initialMaterial, metadata.data, metadata.setData]);
  useEffect(() => {
    if (initialBody && !body.data) body.setData(initialBody);
  }, [initialBody, body.data, body.setData]);
  useEffect(() => {
    if (!permissionsLoading && canWrite) setForbidden(false);
  }, [canWrite, permissionsLoading]);
  useEffect(() => {
    if (metadata.error instanceof CampaignApiError && metadata.error.status === 403) {
      setForbidden(true);
      reloadPermissions();
    }
  }, [metadata.error, reloadPermissions]);
  useEffect(() => {
    if (body.error instanceof CampaignApiError && body.error.status === 403) {
      setForbidden(true);
      reloadPermissions();
    }
  }, [body.error, reloadPermissions]);

  const handleForbidden = (error: unknown) => {
    if (error instanceof CampaignApiError && error.status === 403) {
      setForbidden(true);
      reloadPermissions();
    }
  };

  const startEditing = () => {
    if (!writeAllowed || !item || !bodyData) return;
    setMetadataDraft(makeMetadataDraft(item));
    setBodyDraft(bodyData.body);
    setMetadataFailure(undefined);
    setBodyFailure(undefined);
    setMetadataTitleError('');
    setEditRequested(false);
    setEditing(true);
  };
  useEffect(() => {
    if (!editRequested || !writeAllowed || !item || !bodyData || editing) return;
    startEditing();
  }, [editRequested, writeAllowed, item, bodyData, editing, startEditing]);

  const cancelEditing = () => {
    if (metadataBusyRef.current || bodyBusyRef.current) return;
    if ((metadataDirty || bodyDirty || metadataBlocked || bodyBlocked)
      && !window.confirm('Отменить несохранённые изменения и состояние восстановления материала?')) return;
    setMetadataDraft(undefined);
    setBodyDraft(undefined);
    setMetadataFailure(undefined);
    setBodyFailure(undefined);
    setMetadataCheckFailure(undefined);
    setBodyCheckFailure(undefined);
    setMetadataBlocked(false);
    setBodyBlocked(false);
    setMetadataVerified(false);
    setBodyVerified(false);
    setEditRequested(false);
    setEditing(false);
  };

  const saveMetadata = async () => {
    if (!writeAllowed || !item || !metadataDraft || !metadataDirty || metadataBlocked || hasEmptyMetadataTag || metadataBusyRef.current) return;
    if (!metadataDraft.title.trim()) {
      setMetadataTitleError('Введите название материала.');
      return;
    }
    setMetadataTitleError('');
    metadataBusyRef.current = true;
    setMetadataSaving(true);
    setMetadataFailure(undefined);
    try {
      const saved = await api.updateWorldMaterial(campaignId, kind, materialId, {
        title: metadataDraft.title,
        description: metadataDraft.description,
        tags: metadataDraft.tags,
        isPublished: metadataDraft.isPublished,
        expectedRevision: item.metadataRevision,
      });
      metadata.setData(saved);
      setMetadataDraft(makeMetadataDraft(saved));
      setMetadataBlocked(false);
      setMetadataVerified(false);
      setMetadataCheckFailure(undefined);
    } catch (error) {
      setMetadataFailure(error);
      if (recoverableWrite(error)) {
        setMetadataBlocked(true);
        setMetadataVerified(false);
      }
      handleForbidden(error);
    } finally {
      metadataBusyRef.current = false;
      setMetadataSaving(false);
    }
  };

  const saveBody = async () => {
    if (!writeAllowed || !bodyData || bodyDraft === undefined || !bodyDirty || bodyBlocked || bodyBusyRef.current) return;
    bodyBusyRef.current = true;
    setBodySaving(true);
    setBodyFailure(undefined);
    try {
      const saved = await api.updateWorldBody(campaignId, kind, materialId, { body: bodyDraft, expectedVersion: bodyData.bodyVersion });
      body.setData(saved);
      setBodyDraft(saved.body);
      setBodyBlocked(false);
      setBodyVerified(false);
      setBodyCheckFailure(undefined);
    } catch (error) {
      setBodyFailure(error);
      if (recoverableWrite(error)) {
        setBodyBlocked(true);
        setBodyVerified(false);
      }
      handleForbidden(error);
    } finally {
      bodyBusyRef.current = false;
      setBodySaving(false);
    }
  };

  const checkMetadata = async () => {
    if (!metadataBlocked || metadataCheckBusyRef.current) return;
    metadataCheckBusyRef.current = true;
    setMetadataChecking(true);
    setMetadataCheckFailure(undefined);
    setMetadataVerified(false);
    try {
      const latest = await api.getWorldMaterial(campaignId, kind, materialId);
      metadata.setData(latest);
      setMetadataVerified(true);
    } catch (error) {
      setMetadataCheckFailure(error);
      handleForbidden(error);
    } finally {
      metadataCheckBusyRef.current = false;
      setMetadataChecking(false);
    }
  };

  const checkBody = async () => {
    if (!bodyBlocked || bodyCheckBusyRef.current) return;
    bodyCheckBusyRef.current = true;
    setBodyChecking(true);
    setBodyCheckFailure(undefined);
    setBodyVerified(false);
    try {
      const latest = await api.getWorldBody(campaignId, kind, materialId);
      body.setData(latest);
      setBodyVerified(true);
    } catch (error) {
      setBodyCheckFailure(error);
      handleForbidden(error);
    } finally {
      bodyCheckBusyRef.current = false;
      setBodyChecking(false);
    }
  };

  const continueMetadata = () => {
    if (!metadataVerified) return;
    setMetadataBlocked(false);
    setMetadataVerified(false);
    setMetadataFailure(undefined);
    setMetadataCheckFailure(undefined);
  };

  const continueBody = () => {
    if (!bodyVerified) return;
    setBodyBlocked(false);
    setBodyVerified(false);
    setBodyFailure(undefined);
    setBodyCheckFailure(undefined);
  };

  const deleteMaterial = async () => {
    if (!writeAllowed || !item || deleteBlocked || deleteBusyRef.current || metadataBusyRef.current || bodyBusyRef.current) return;
    if (!window.confirm(`Удалить материал «${item.title}»?`)) return;
    deleteBusyRef.current = true;
    setDeleteBusy(true);
    setDeleteFailure(undefined);
    setDeleteMissing(false);
    setDeleteVerified(false);
    try {
      await api.deleteWorldMaterial(campaignId, kind, materialId, item.metadataRevision);
      clearDirty();
      onBack();
    } catch (error) {
      setDeleteFailure(error);
      if (recoverableWrite(error) || isNotFound(error)) setDeleteBlocked(true);
      if (isNotFound(error)) setDeleteMissing(true);
      handleForbidden(error);
    } finally {
      deleteBusyRef.current = false;
      setDeleteBusy(false);
    }
  };

  const checkDelete = async () => {
    if (!deleteBlocked || deleteCheckBusyRef.current) return;
    deleteCheckBusyRef.current = true;
    setDeleteChecking(true);
    setDeleteCheckFailure(undefined);
    setDeleteMissing(false);
    setDeleteVerified(false);
    try {
      const latest = await api.getWorldMaterial(campaignId, kind, materialId);
      metadata.setData(latest);
      setDeleteBlocked(false);
      setDeleteFailure(undefined);
      setDeleteVerified(true);
    } catch (error) {
      setDeleteCheckFailure(error);
      if (isNotFound(error)) {
        setDeleteMissing(true);
        setDeleteFailure(undefined);
      }
      handleForbidden(error);
    } finally {
      deleteCheckBusyRef.current = false;
      setDeleteChecking(false);
    }
  };

  const backAction = <Button type="button" size="small" variant="secondary" onClick={onBack}>К списку</Button>;
  if (metadata.loading && !item) return <StatePanel kind="loading" actions={<ActionRow>{backAction}</ActionRow>}>Загрузка материала…</StatePanel>;
  if (metadata.error && !item) return <WorldErrorPanel error={metadata.error} onRetry={metadata.reload} />;
  if (!item || unavailableToPlayer) return <StatePanel kind="empty" actions={<ActionRow>{backAction}</ActionRow>}>Материал недоступен или не найден</StatePanel>;

  const detailActions = <Toolbar><ActionRow justify="end">
    {!editing && mode === 'gm' && <Button type="button" size="small" disabled={!writeAllowed || body.loading || !bodyData} onClick={startEditing}>Изменить</Button>}
    {!editing && mode === 'gm' && <Button type="button" size="small" variant="secondary" disabled={!writeAllowed || deleteBusy || deleteBlocked} onClick={() => void deleteMaterial()}>Удалить</Button>}
    {editing && <Button type="button" size="small" variant="secondary" disabled={metadataSaving || bodySaving} onClick={cancelEditing}>Отменить изменения</Button>}
    {backAction}
  </ActionRow></Toolbar>;
  return <Panel as="article" className={styles.detail} title={editing ? undefined : item.title} headingLevel={2} description={editing ? undefined : item.description} status={!editing ? <Badge>{item.isPublished ? 'Открыт игрокам' : 'Закрыт'}</Badge> : undefined} actions={detailActions}>
    <>
      {!editing && <WorldTagsDisplay tags={item.tags} />}
      {mode === 'gm' && permissionsLoading && <StatePanel kind="info">Проверяются права записи. Команды управления временно заблокированы.</StatePanel>}
      {mode === 'gm' && !permissionsLoading && !writeAllowed && <StatePanel kind="info">Право записи недоступно. Черновик сохранён; команды управления заблокированы.</StatePanel>}
      {metadata.error && <WorldErrorPanel error={metadata.error} onRetry={metadata.reload} />}
      {body.loading && !bodyData && <StatePanel kind="loading">Загрузка текста материала…</StatePanel>}
      {body.error && <WorldErrorPanel error={body.error} onRetry={body.reload} />}
      {bodyData && !editing && <MarkdownViewer value={bodyData.body} className={styles.markdown} />}
      {editing && metadataDraft && bodyDraft !== undefined && <>
        <Panel>
          <>
            <div className={styles.metadataFields}>
              <Field label="Название" htmlFor={titleId} error={metadataTitleError || undefined}>
                <Input variant="single-line" id={titleId} value={metadataDraft.title} disabled={metadataSaving} aria-invalid={metadataTitleError ? 'true' : undefined} onChange={event => { setMetadataDraft(current => current ? { ...current, title: event.target.value } : current); setMetadataTitleError(''); }} />
              </Field>
              <Field label="Описание" htmlFor={descriptionId}>
                <Textarea variant="multiline" rows={6} id={descriptionId} value={metadataDraft.description} disabled={metadataSaving} onChange={event => setMetadataDraft(current => current ? { ...current, description: event.target.value } : current)} />
              </Field>
              <WorldTagsEditor idPrefix={tagsId} tags={metadataDraft.tags} disabled={metadataSaving} onChange={tags => setMetadataDraft(current => current ? { ...current, tags } : current)} />
              <Field label="Открыть игрокам" htmlFor={publishedId}>
                <Checkbox id={publishedId} checked={metadataDraft.isPublished} disabled={metadataSaving} onChange={event => setMetadataDraft(current => current ? { ...current, isPublished: event.target.checked } : current)} />
              </Field>
            </div>
        {metadataBlocked && <StatePanel kind="info" actions={<ActionRow>
          <Button type="button" size="small" disabled={metadataChecking} onClick={() => void checkMetadata()}>Проверить данные</Button>
          {metadataVerified && <Button type="button" size="small" variant="secondary" onClick={continueMetadata}>Продолжить с моим черновиком</Button>}
        </ActionRow>}>
          <>
            Сохранение не подтверждено. Черновик сохранён; повторная запись заблокирована до проверки данных.
            {metadataCheckFailure && <WorldErrorPanel error={metadataCheckFailure} />}
          </>
        </StatePanel>}
            {metadataFailure && <WorldErrorPanel error={metadataFailure} />}
            <ActionRow justify="end">
              <Button type="button" size="small" disabled={!writeAllowed || !metadataDirty || metadataBlocked || metadataSaving || hasEmptyMetadataTag} onClick={() => void saveMetadata()}>Сохранить</Button>
            </ActionRow>
          </>
        </Panel>
        <Panel>
          <>
            <MarkdownEditor id={bodyId} value={bodyDraft} onChange={setBodyDraft} disabled={bodySaving} height={500} preview="edit" textareaProps={{ 'aria-label': 'Текст материала' }} />
        {bodyBlocked && <StatePanel kind="info" actions={<ActionRow>
          <Button type="button" size="small" disabled={bodyChecking} onClick={() => void checkBody()}>Проверить данные</Button>
          {bodyVerified && <Button type="button" size="small" variant="secondary" onClick={continueBody}>Продолжить с моим черновиком</Button>}
        </ActionRow>}>
          <>
            Сохранение текста не подтверждено. Черновик сохранён; повторная запись заблокирована до проверки данных.
            {bodyCheckFailure && <WorldErrorPanel error={bodyCheckFailure} />}
          </>
        </StatePanel>}
            {bodyFailure && <WorldErrorPanel error={bodyFailure} />}
            <ActionRow justify="end">
              <Button type="button" size="small" disabled={!writeAllowed || !bodyDirty || bodyBlocked || bodySaving} onClick={() => void saveBody()}>Сохранить</Button>
            </ActionRow>
          </>
        </Panel>
      </>}
      {deleteBlocked && <StatePanel kind="info" actions={<ActionRow><Button type="button" size="small" disabled={deleteChecking} onClick={() => void checkDelete()}>Проверить данные</Button></ActionRow>}>
        <>
          Результат удаления не подтверждён. Материал не считается удалённым; повторное удаление заблокировано до проверки.
          {deleteMissing && <StatePanel kind="empty">Материал недоступен или не найден</StatePanel>}
          {deleteCheckFailure && !isNotFound(deleteCheckFailure) && <WorldErrorPanel error={deleteCheckFailure} />}
        </>
      </StatePanel>}
      {deleteVerified && <Notification kind="info" eventKey={`${scope}:${String(item.metadataRevision)}:delete-checked`}>Карточка перечитана. Проверьте её перед отдельным запросом на удаление.</Notification>}
      {deleteFailure && !isNotFound(deleteFailure) && <WorldErrorPanel error={deleteFailure} />}
    </>
  </Panel>;
};
