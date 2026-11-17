import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useWorkspace, useDirtyDraft } from './Workspace';
import { useCampaignWorkspace } from './Shell';
import { useMutation, useResource } from './hooks';
import { runCreation, CampaignApiError } from './api';
import type { DefinitionMetadata, Importance } from './types';
import { ApiError } from './Feedback';
import commonStyles from '@tdn/shared/styles/common.module.css';
import buttonStyles from '@tdn/shared/styles/components/Button.module.css';
import inputStyles from '@tdn/shared/styles/components/Input.module.css';
import styles from './Workspace.module.css';

const isUncertain = (error: unknown) => error instanceof CampaignApiError && (error.unknownOutcome || ['creation_already_published', 'already_published', 'content_already_prepared'].includes(error.problem.code));

const CreateCharacter: React.FC<{ campaignId: number; onClose: () => void }> = ({ campaignId, onClose }) => {
  const { api, path, navigate, sessionKey, notifyInvalidation } = useWorkspace();
  const { campaign, permissions, lastKnownPermissions, permissionsLoading, mode } = useCampaignWorkspace();
  const writable = permissions.canWrite && !permissionsLoading;
  const [requestId] = useState(() => crypto.randomUUID());
  const templates = useResource<DefinitionMetadata[]>(`${sessionKey}:${campaignId}:templates-for-character`, () => api.listTemplates(campaignId), mode === 'gm' && lastKnownPermissions.canWrite);
  const [name, setName] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [importance, setImportance] = useState<Importance | ''>('');
  const [createError, setCreateError] = useState<unknown>();
  const [checkError, setCheckError] = useState<unknown>();
  const [uncertain, setUncertain] = useState(false);
  const active = useRef(true);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  const clearDirty = useDirtyDraft(`character-create-${campaignId}-${requestId}`, Boolean(name || templateId || importance));
  const creation = useMutation((payload: { name: string; templateId: string; importance: Importance; requestId: string }) => runCreation(
    () => api.createCharacter(campaignId, payload),
    () => api.getCharacter(campaignId, payload.requestId)
  ));
  const finish = (characterId: string) => {
    if (!active.current) return;
    clearDirty();
    notifyInvalidation('characters');
    onClose();
    navigate(path(`/${campaign.id}/gm/characters/${encodeURIComponent(characterId)}/overview`));
  };
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (mode !== 'gm' || !writable || !name.trim() || !templateId || !importance || !templates.data?.length || templates.loading || templates.error || uncertain || creation.busy) return;
    setCreateError(undefined);
    setCheckError(undefined);
    try {
      const result = await creation.run({ name: name.trim(), templateId, importance, requestId });
      if (result) finish(result.id);
    } catch (error) {
      if (active.current) { setCreateError(error); setUncertain(isUncertain(error)); }
    }
  };
  const checkCreation = async () => {
    if (creation.busy) return;
    setCheckError(undefined);
    try {
      const result = await api.getCharacter(campaignId, requestId);
      finish(result.id);
    } catch (error) { if (active.current) setCheckError(error); }
  };
  const close = () => { clearDirty(); onClose(); };
  const cancel = () => { if (!name && !templateId && !importance || window.confirm('Отказаться от черновика персонажа?')) close(); };
  const abandon = () => { if (window.confirm('Отказаться от проверки операции? Результат создания может оставаться неизвестным.')) close(); };
  if (mode !== 'gm' || !lastKnownPermissions.canWrite) return null;
  return <form className={`${commonStyles.form} ${styles.page}`} onSubmit={submit}>
    <h2>Создать персонажа</h2>
    {permissionsLoading && <p>Обновление прав кампании…</p>}
    {templates.loading && <p>Загрузка шаблонов…</p>}
    {Boolean(templates.error) && <ApiError error={templates.error} onRetry={templates.reload} />}
    {templates.data?.length === 0 && <p>Нет шаблонов. <Link to={path(`/${campaignId}/gm/templates`)}>Откройте раздел шаблонов кампании.</Link></p>}
    <label className={commonStyles.formGroup}>Имя<input className={inputStyles.input} required value={name} disabled={!writable || uncertain || creation.busy} onChange={event => setName(event.target.value)} /></label>
    <label className={commonStyles.formGroup}>Шаблон<select className={inputStyles.input} value={templateId} disabled={!writable || uncertain || creation.busy || !templates.data?.length} onChange={event => setTemplateId(event.target.value)}><option value="">Выберите шаблон</option>{templates.data?.map(template => <option key={template.id} value={template.id}>{template.name}</option>)}</select></label>
    <label className={commonStyles.formGroup}>Важность<select className={inputStyles.input} value={importance} disabled={!writable || uncertain || creation.busy} onChange={event => setImportance(event.target.value as Importance | '')}><option value="">Выберите важность</option><option value="Background">Фоновый</option><option value="Secondary">Второстепенный</option><option value="Key">Ключевой</option></select></label>
    {Boolean(createError) && <ApiError error={createError} />}{Boolean(checkError) && <ApiError error={checkError} />}
    <div className={commonStyles.formActions}>{uncertain ? <button className={buttonStyles.button} type="button" disabled={creation.busy} onClick={() => void checkCreation()}>Проверить создание</button> : <button className={buttonStyles.button} disabled={!writable || creation.busy || templates.loading || Boolean(templates.error) || !templates.data?.length || !name.trim() || !templateId || !importance}>{creation.busy ? 'Создание…' : 'Создать'}</button>}<button className={buttonStyles.button} type="button" disabled={creation.busy} onClick={uncertain ? abandon : cancel}>{uncertain ? 'Отказаться от операции' : 'Отмена'}</button></div>
  </form>;
};

export default CreateCharacter;
