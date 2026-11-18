import React, { useEffect, useRef, useState } from 'react';
import { ActionRow, Button, Field, Input, List, Panel, Select, StatePanel } from '@tdn/shared';
import { useWorkspace, useDirtyDraft } from './Workspace';
import { useCampaignWorkspace } from './Shell';
import { useMutation } from './hooks';
import { runCreation, CampaignApiError } from './api';
import type { Importance } from './types';
import { ApiError } from './Feedback';

const isUncertain = (error: unknown) => error instanceof CampaignApiError && (error.unknownOutcome || ['creation_already_published', 'already_published', 'content_already_prepared'].includes(error.problem.code));

const CreateCharacter: React.FC<{ campaignId: number; onClose: () => void }> = ({ campaignId, onClose }) => {
  const { api, path, navigate, notifyInvalidation } = useWorkspace();
  const { campaign, permissions, lastKnownPermissions, permissionsLoading, mode } = useCampaignWorkspace();
  const writable = permissions.canWrite && !permissionsLoading;
  const [requestId] = useState(() => crypto.randomUUID());
  const [name, setName] = useState('');
  const [importance, setImportance] = useState<Importance | ''>('');
  const [createError, setCreateError] = useState<unknown>();
  const [checkError, setCheckError] = useState<unknown>();
  const [uncertain, setUncertain] = useState(false);
  const nameId = React.useId();
  const importanceId = React.useId();
  const active = useRef(true);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  const clearDirty = useDirtyDraft(`character-create-${campaignId}-${requestId}`, Boolean(name || importance));
  const creation = useMutation((payload: { name: string; importance?: Importance; requestId: string }) => runCreation(
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
    if (mode !== 'gm' || !writable || !name.trim() || uncertain || creation.busy) return;
    setCreateError(undefined);
    setCheckError(undefined);
    try {
      const result = await creation.run({ requestId, name: name.trim(), ...(importance ? { importance } : {}) });
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
  const cancel = () => { if (!name && !importance || window.confirm('Отказаться от черновика персонажа?')) close(); };
  const abandon = () => { if (window.confirm('Отказаться от проверки операции? Результат создания может оставаться неизвестным.')) close(); };
  if (mode !== 'gm' || !lastKnownPermissions.canWrite) return null;
  return <form onSubmit={submit}>
    <Panel title="Создать персонажа" headingLevel={2} description="Персонаж использует единственный шаблон кампании." actions={<ActionRow>
      {uncertain
        ? <Button type="button" disabled={creation.busy} onClick={() => void checkCreation()}>Проверить создание</Button>
        : <Button type="submit" busy={creation.busy} disabled={!writable || uncertain || !name.trim()}>{creation.busy ? 'Создание…' : 'Создать'}</Button>}
      <Button variant="secondary" type="button" disabled={creation.busy} onClick={uncertain ? abandon : cancel}>{uncertain ? 'Отказаться от операции' : 'Отмена'}</Button>
    </ActionRow>}>
      {permissionsLoading && <StatePanel kind="loading">Обновление прав кампании…</StatePanel>}
      <List layout="grid" gridSize="small">
        <Field label="Имя" htmlFor={nameId}><Input id={nameId} required value={name} disabled={!writable || uncertain || creation.busy} onChange={event => setName(event.target.value)} /></Field>
        <Field label="Важность" htmlFor={importanceId}><Select id={importanceId} value={importance} disabled={!writable || uncertain || creation.busy} onChange={event => setImportance(event.target.value as Importance | '')}><option value="">По умолчанию (фоновый)</option><option value="Background">Фоновый</option><option value="Secondary">Второстепенный</option><option value="Key">Ключевой</option></Select></Field>
      </List>
      {Boolean(createError) && <ApiError error={createError} />}{Boolean(checkError) && <ApiError error={checkError} />}
    </Panel>
  </form>;
};

export default CreateCharacter;
