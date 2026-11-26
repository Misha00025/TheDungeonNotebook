import React, { useEffect, useId, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Button, Checkbox, Field, Input, ModalPortal, Notification, StatePanel, Textarea } from '@tdn/shared';
import { useDirtyDraft, useWorkspace } from './Workspace';
import { useCampaignWorkspace } from './Shell';
import { useResource } from './hooks';
import { ApiError } from './Feedback';
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

const WorldTagsEditor: React.FC<{
  idPrefix: string;
  tags: string[];
  disabled: boolean;
  onChange: (tags: string[]) => void;
}> = ({ idPrefix, tags, disabled, onChange }) => <div className={styles.tagEditor}>
  {tags.map((tag, index) => {
    const id = `${idPrefix}-tag-${index}`;
    return <Field key={index} label={`Тег ${index + 1}`} htmlFor={id} error={tag.length === 0 ? 'Тег не может быть пустым. Введите значение или удалите поле.' : undefined}>
      <div className={styles.tagEditRow}>
        <Input variant="single-line" id={id} value={tag} disabled={disabled} aria-invalid={tag.length === 0 ? 'true' : undefined} onChange={event => onChange(tags.map((value, itemIndex) => itemIndex === index ? event.target.value : value))} />
        <Button type="button" variant="secondary" size="small" disabled={disabled} aria-label={`Удалить тег ${index + 1}`} onClick={() => onChange(tags.filter((_, itemIndex) => itemIndex !== index))}>Удалить</Button>
      </div>
    </Field>;
  })}
  <Button type="button" variant="secondary" size="small" disabled={disabled} onClick={() => onChange([...tags, ''])}>Добавить тег</Button>
</div>;
export const CreateWorldMaterialModal: React.FC<{
  campaignId: number;
  kind: WorldKind;
  scope: string;
  canWrite: boolean;
  permissionsLoading: boolean;
  onClose: () => void;
  onCreated: (material: WorldMaterial, body?: WorldMaterialBody) => void;
}> = ({ campaignId, kind, scope, canWrite, permissionsLoading, onClose, onCreated }) => {
  const { api } = useWorkspace();
  const { reloadPermissions } = useCampaignWorkspace();
  const [requestId] = useState(() => crypto.randomUUID());
  const busyRef = useRef(false);
  const mountedRef = useRef(true);
  const titleId = useId();
  const descriptionId = useId();
  const tagsId = useId();
  const bodyId = useId();
  const previewId = useId();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [failure, setFailure] = useState<unknown>();
  const [checkFailure, setCheckFailure] = useState<unknown>();
  const [titleError, setTitleError] = useState('');
  const [forbidden, setForbidden] = useState(false);
  const dirty = Boolean(title || description || tags.length > 0 || body || blocked);
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

  const close = () => {
    if (busyRef.current) return;
    if (dirty && !window.confirm(blocked
      ? 'Результат создания неизвестен. Закрыть и потерять черновик и возможность проверки?'
      : 'Отказаться от черновика материала мира?')) return;
    clearDirty();
    onClose();
  };

  const checkCreation = async () => {
    if (!blocked || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setCheckFailure(undefined);
    try {
      const material = await api.getWorldMaterial(campaignId, kind, requestId);
      if (mountedRef.current) {
        clearDirty();
        onCreated(material);
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

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
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

  return <ModalPortal isOpen title="Создать материал мира" size="wide" onClose={close} dismissDisabled={busy}>
    <form className={styles.form} onSubmit={submit} aria-busy={busy || undefined}>
      <>
        <Field label="Название" htmlFor={titleId} error={titleError || undefined}>
          <Input variant="single-line" id={titleId} value={title} disabled={busy} aria-invalid={titleError ? 'true' : undefined} onChange={event => { setTitle(event.target.value); setTitleError(''); }} />
        </Field>
        <Field label="Краткое описание" htmlFor={descriptionId}>
          <Textarea variant="multiline" id={descriptionId} value={description} disabled={busy} onChange={event => setDescription(event.target.value)} />
        </Field>
        <div>
          <h3>Теги</h3>
          <WorldTagsEditor idPrefix={tagsId} tags={tags} disabled={busy} onChange={setTags} />
        </div>
        <p className={styles.notice}>Новый материал всегда будет закрыт для игроков. Открыть его можно будет после создания.</p>
        {!writeAllowed && <Notification kind="warning" eventKey={`${scope}:${permissionsLoading}:${forbidden}`}>{permissionsLoading ? 'Проверяются права записи. Команды временно заблокированы.' : 'Право записи недоступно. Черновик сохранён.'}</Notification>}
        {blocked && <StatePanel kind="info"><>
          Результат создания не подтверждён. Черновик и идентификатор операции сохранены; повторное создание не выполняется.
          <div className={styles.formActions}>
            <Button type="button" size="small" disabled={busy} onClick={() => void checkCreation()}>Проверить создание</Button>
          </div>
        </></StatePanel>}
        {failure && <ApiError error={failure} />}
        {checkFailure && <>
          {isNotFound(checkFailure) && <StatePanel kind="empty">Создание пока не подтверждено. Повторная отправка не выполнялась.</StatePanel>}
          <ApiError error={checkFailure} />
        </>}
        <Field label="Markdown" htmlFor={bodyId}>
          <Textarea className={styles.markdownInput} variant="multiline" id={bodyId} value={body} disabled={busy} onChange={event => setBody(event.target.value)} />
        </Field>
        <section className={styles.preview} aria-labelledby={previewId}>
          <h3 id={previewId}>Предпросмотр</h3>
          <div className={`${styles.markdown} ${styles.longText}`}><ReactMarkdown>{body}</ReactMarkdown></div>
        </section>
        <div className={styles.formActions}>
          {!blocked && <Button type="submit" disabled={!writeAllowed || busy || !title.trim() || hasEmptyTag}>Создать</Button>}
          <Button variant="secondary" type="button" disabled={busy} onClick={close}>{blocked ? 'Отказаться от проверки' : 'Отмена'}</Button>
        </div>
      </>
    </form>
  </ModalPortal>;
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
}> = ({ campaignId, kind, mode, materialId, scope, canWrite, permissionsLoading, onBack, initialMaterial, initialBody }) => {
  const { api } = useWorkspace();
  const { reloadPermissions } = useCampaignWorkspace();
  const metadata = useResource(`${scope}:material:${materialId}`, () => api.getWorldMaterial(campaignId, kind, materialId));
  const bodyCard = metadata.data ?? initialMaterial;
  const bodyEnabled = Boolean(bodyCard && (mode === 'gm' || bodyCard.isPublished));
  const body = useResource(`${scope}:body:${materialId}`, () => api.getWorldBody(campaignId, kind, materialId), bodyEnabled);
  const [editing, setEditing] = useState(false);
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
  const previewId = useId();
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
    setEditing(true);
  };

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
    setEditing(false);
  };

  const saveMetadata = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
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

  const saveBody = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
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

  const backAction = <Button type="button" variant="secondary" onClick={onBack}>К списку</Button>;
  if (metadata.loading && !item) return <section className={styles.detail}><StatePanel kind="loading">Загрузка материала…</StatePanel>{backAction}</section>;
  if (metadata.error && !item) return <section className={styles.detail}>
    {isNotFound(metadata.error)
      ? <StatePanel kind="empty">Материал недоступен или не найден</StatePanel>
      : <ApiError error={metadata.error} onRetry={metadata.reload} />}
    {backAction}
  </section>;
  if (!item || unavailableToPlayer) return <section className={styles.detail}><StatePanel kind="empty">Материал недоступен или не найден</StatePanel>{backAction}</section>;

  return <article className={styles.detail}>
    <>
      <h2 className={styles.longText}>{item.title}</h2>
      {item.description && <p className={styles.longText}>{item.description}</p>}
      {item.tags.length > 0 && <ul className={styles.tags}>{item.tags.map((tag, index) => <li key={`${index}:${tag}`}>{tag}</li>)}</ul>}
      <p>{item.isPublished ? 'Открыт игрокам' : mode === 'gm' ? 'Закрыт' : ''}</p>
      {mode === 'gm' && permissionsLoading && <Notification kind="warning" eventKey={`${scope}:permissions-loading`}>Проверяются права записи. Команды управления временно заблокированы.</Notification>}
      {mode === 'gm' && !permissionsLoading && !writeAllowed && <Notification kind="warning" eventKey={`${scope}:read-only`}>Право записи недоступно. Черновик сохранён; команды управления заблокированы.</Notification>}
      {metadata.error && <ApiError error={metadata.error} onRetry={metadata.reload} />}
      {body.loading && !bodyData && <StatePanel kind="loading">Загрузка текста материала…</StatePanel>}
      {body.error && !isNotFound(body.error) && <ApiError error={body.error} onRetry={body.reload} />}
      {bodyData && !editing && <div className={`${styles.markdown} ${styles.longText}`}><ReactMarkdown>{bodyData.body}</ReactMarkdown></div>}
      {body.error && isNotFound(body.error) && <StatePanel kind="empty" actions={<Button type="button" size="small" onClick={body.reload}>Повторить загрузку</Button>}>Материал недоступен или не найден</StatePanel>}
      {editing && metadataDraft && bodyDraft !== undefined && <>
      <form className={styles.form} onSubmit={saveMetadata} aria-busy={metadataSaving || undefined}>
        <>
          <h3>Карточка материала</h3>
          <Field label="Название" htmlFor={titleId} error={metadataTitleError || undefined}>
            <Input variant="single-line" id={titleId} value={metadataDraft.title} disabled={metadataSaving} aria-invalid={metadataTitleError ? 'true' : undefined} onChange={event => { setMetadataDraft(current => current ? { ...current, title: event.target.value } : current); setMetadataTitleError(''); }} />
          </Field>
          <Field label="Краткое описание" htmlFor={descriptionId}>
            <Textarea variant="multiline" id={descriptionId} value={metadataDraft.description} disabled={metadataSaving} onChange={event => setMetadataDraft(current => current ? { ...current, description: event.target.value } : current)} />
          </Field>
          <div>
            <h4>Теги</h4>
            <WorldTagsEditor idPrefix={tagsId} tags={metadataDraft.tags} disabled={metadataSaving} onChange={tags => setMetadataDraft(current => current ? { ...current, tags } : current)} />
          </div>
          <label className={styles.checkboxLabel} htmlFor={publishedId}>
            <Checkbox id={publishedId} checked={metadataDraft.isPublished} disabled={metadataSaving} onChange={event => setMetadataDraft(current => current ? { ...current, isPublished: event.target.checked } : current)} />
            Открыть игрокам
          </label>
          {metadataBlocked && <StatePanel kind="info"><>
            Сохранение карточки не подтверждено. Черновик сохранён; повторная запись заблокирована до проверки данных.
            <div className={styles.formActions}>
              <Button type="button" size="small" disabled={metadataChecking} onClick={() => void checkMetadata()}>Проверить данные</Button>
              {metadataVerified && <Button type="button" size="small" variant="secondary" onClick={continueMetadata}>Продолжить с моим черновиком</Button>}
            </div>
            {metadataCheckFailure && (isNotFound(metadataCheckFailure)
              ? <StatePanel kind="empty">Материал недоступен или не найден</StatePanel>
              : <ApiError error={metadataCheckFailure} />)}
          </></StatePanel>}
          {metadataFailure && <ApiError error={metadataFailure} />}
          <div className={styles.formActions}>
            <Button type="submit" disabled={!writeAllowed || !metadataDirty || metadataBlocked || metadataSaving || !metadataDraft.title.trim() || hasEmptyMetadataTag}>Сохранить карточку</Button>
          </div>
        </>
      </form>
      <form className={styles.form} onSubmit={saveBody} aria-busy={bodySaving || undefined}>
        <>
          <Field label="Текст материала (Markdown)" htmlFor={bodyId}>
            <Textarea className={styles.markdownInput} variant="multiline" id={bodyId} value={bodyDraft} disabled={bodySaving} onChange={event => setBodyDraft(event.target.value)} />
          </Field>
          <section className={styles.preview} aria-labelledby={previewId}>
            <h4 id={previewId}>Предпросмотр</h4>
            <div className={`${styles.markdown} ${styles.longText}`}><ReactMarkdown>{bodyDraft}</ReactMarkdown></div>
          </section>
          {bodyBlocked && <StatePanel kind="info"><>
            Сохранение текста не подтверждено. Черновик сохранён; повторная запись заблокирована до проверки данных.
            <div className={styles.formActions}>
              <Button type="button" size="small" disabled={bodyChecking} onClick={() => void checkBody()}>Проверить данные</Button>
              {bodyVerified && <Button type="button" size="small" variant="secondary" onClick={continueBody}>Продолжить с моим черновиком</Button>}
            </div>
            {bodyCheckFailure && (isNotFound(bodyCheckFailure)
              ? <StatePanel kind="empty">Материал недоступен или не найден</StatePanel>
              : <ApiError error={bodyCheckFailure} />)}
          </></StatePanel>}
          {bodyFailure && <ApiError error={bodyFailure} />}
          <div className={styles.formActions}>
            <Button type="submit" disabled={!writeAllowed || !bodyDirty || bodyBlocked || bodySaving}>Сохранить текст</Button>
          </div>
        </>
      </form>
      </>}
      {deleteBlocked && <StatePanel kind="info"><>
      Результат удаления не подтверждён. Материал не считается удалённым; повторное удаление заблокировано до проверки.
      <div className={styles.formActions}>
        <Button type="button" size="small" disabled={deleteChecking} onClick={() => void checkDelete()}>Проверить данные</Button>
      </div>
      {deleteMissing && <StatePanel kind="empty">Материал недоступен или не найден</StatePanel>}
      {deleteCheckFailure && !isNotFound(deleteCheckFailure) && <ApiError error={deleteCheckFailure} />}
      </></StatePanel>}
      {deleteVerified && <Notification kind="info" eventKey={`${scope}:${String(item.metadataRevision)}:delete-checked`}>Карточка перечитана. Проверьте её перед отдельным запросом на удаление.</Notification>}
      {deleteFailure && !isNotFound(deleteFailure) && <ApiError error={deleteFailure} />}
      <div className={styles.formActions}>
        {!editing && mode === 'gm' && <Button type="button" disabled={!writeAllowed || body.loading || !bodyData} onClick={startEditing}>Изменить</Button>}
        {!editing && mode === 'gm' && <Button type="button" variant="secondary" disabled={!writeAllowed || deleteBusy || deleteBlocked} onClick={() => void deleteMaterial()}>Удалить</Button>}
        {editing && <Button type="button" variant="secondary" disabled={metadataSaving || bodySaving} onClick={cancelEditing}>Отменить изменения</Button>}
        {backAction}
      </div>
    </>
  </article>;
};
