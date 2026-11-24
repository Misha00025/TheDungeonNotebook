import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useWorkspace, useDirtyDraft } from './Workspace';
import { useMutation, useResource } from './hooks';
import { runCreation, CampaignApiError } from './api';
import type { Campaign, Permissions } from './types';
import { ApiError } from './Feedback';
import { Badge, Button, List, Panel } from '@tdn/shared';
import commonStyles from '@tdn/shared/styles/common.module.css';
import buttonStyles from '@tdn/shared/styles/components/Button.module.css';
import inputStyles from '@tdn/shared/styles/components/Input.module.css';
import styles from './Workspace.module.css';
import cardStyles from './Campaigns.module.css';

const newRequestId = () => crypto.randomUUID();
const isUncertainCreation = (error: unknown) => error instanceof CampaignApiError && (error.unknownOutcome || ['creation_already_published', 'already_published'].includes(error.problem.code));

const CampaignCard: React.FC<{ campaign: Campaign }> = ({ campaign }) => {
  const { api, path, navigate, sessionKey } = useWorkspace();
  const resource = useResource<Permissions>(`${sessionKey}:${campaign.id}:permissions`, () => api.campaignPermissions(campaign.id));
  const canWrite = Boolean(resource.data?.canWrite);
  const canRead = Boolean(resource.data?.canRead);
  return <Panel as="article" className={cardStyles.card} aria-busy={resource.loading || undefined} actions={(canWrite || canRead) ? <Button className={cardStyles.entryButton} size="small" type="button" onClick={() => navigate(path(`/${campaign.id}/${canWrite ? 'gm/overview' : 'player/characters'}`))}>{canWrite ? 'Вести' : 'Играть'}</Button> : undefined}>
    <div className={cardStyles.identity}><h2 className={cardStyles.title}>{campaign.name}</h2>{resource.data && (canWrite || canRead) && <Badge>{canWrite ? 'ГМ' : 'Игрок'}</Badge>}</div>
    {Boolean(resource.error) && <ApiError error={resource.error} onRetry={resource.reload} />}
    {resource.data && !canRead && !canWrite && <p>Нет доступных действий.</p>}
  </Panel>;
};

const CampaignCreateForm: React.FC<{ onClose: () => void; requestId: string; onNewRequest: () => void }> = ({ onClose, requestId, onNewRequest }) => {
  const { api, navigate, path } = useWorkspace();
  const [name, setName] = useState('');
  const [administratorUserId, setAdministratorUserId] = useState('');
  const [createError, setCreateError] = useState<unknown>();
  const [checkError, setCheckError] = useState<unknown>();
  const [uncertain, setUncertain] = useState(false);
  const dirty = Boolean(name || administratorUserId);
  const clearDirty = useDirtyDraft('campaign-create', dirty);

  const creation = useMutation(async (payload: { name: string; administratorUserId?: number; requestId: string }) => runCreation(
    () => api.createCampaign({ name: payload.name, requestId: payload.requestId, ...(payload.administratorUserId === undefined ? {} : { administratorUserId: payload.administratorUserId }) }),
    async () => {
      const status = await api.creationStatus(payload.requestId);
      return api.getCampaign(status.resourceId);
    }
  ));

  const finish = (campaign: Campaign) => {
    clearDirty();
    setName('');
    setAdministratorUserId('');
    setUncertain(false);
    onClose();
    onNewRequest();
    navigate(path(`/${campaign.id}/gm/overview`));
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const cleanName = name.trim();
    if (!cleanName || creation.busy || uncertain) return;
    let administratorId: number | undefined;
    if (administratorUserId.trim()) {
      if (!/^-?\d+$/.test(administratorUserId.trim())) { setCreateError(new Error('Введите целое число для ID администратора.')); return; }
      administratorId = Number(administratorUserId);
      if (!Number.isInteger(administratorId) || administratorId < -2147483648 || administratorId > 2147483647) { setCreateError(new Error('ID администратора должен быть целым числом int32.')); return; }
    }
    setCreateError(undefined);
    setCheckError(undefined);
    try {
      const result = await creation.run({ name: cleanName, administratorUserId: administratorId, requestId });
      if (result) finish(result);
    }
    catch (error) { setCreateError(error); setUncertain(isUncertainCreation(error)); }
  };

  const checkCreation = async () => {
    if (creation.busy) return;
    setCheckError(undefined);
    try {
      const status = await api.creationStatus(requestId);
      finish(await api.getCampaign(status.resourceId));
    } catch (error) { setCheckError(error); }
  };

  const cancel = () => {
    if (dirty && !window.confirm('Отказаться от несохранённого черновика кампании?')) return;
    clearDirty();
    setName('');
    setAdministratorUserId('');
    onClose();
    onNewRequest();
  };

  const abandon = () => {
    if (!window.confirm('Отказаться от проверки этой операции? Результат создания может оставаться неизвестным.')) return;
    clearDirty();
    setName('');
    setAdministratorUserId('');
    setUncertain(false);
    setCreateError(undefined);
    setCheckError(undefined);
    onClose();
    onNewRequest();
  };

  return <form className={`${commonStyles.form} ${styles.page}`} onSubmit={submit}>
    <h2>Создать кампанию</h2>
    <label className={commonStyles.formGroup}>Название<input className={`${inputStyles.input} ${inputStyles['single-line']}`} required value={name} disabled={uncertain || creation.busy} onChange={event => setName(event.target.value)} /></label>
    <label className={commonStyles.formGroup}>ID администратора (необязательно)<input className={`${inputStyles.input} ${inputStyles['single-line']}`} value={administratorUserId} disabled={uncertain || creation.busy} onChange={event => setAdministratorUserId(event.target.value)} inputMode="numeric" /></label>
    {Boolean(createError) && <ApiError error={createError} />}
    {Boolean(checkError) && <ApiError error={checkError} />}
    <div className={commonStyles.formActions}>
      {!uncertain && <button className={buttonStyles.button} disabled={creation.busy || !name.trim()}>{creation.busy ? 'Создание…' : 'Создать'}</button>}
      {uncertain && <button className={buttonStyles.button} type="button" disabled={creation.busy} onClick={() => void checkCreation()}>Проверить создание</button>}
      <button className={buttonStyles.button} type="button" disabled={creation.busy} onClick={uncertain ? abandon : cancel}>{uncertain ? 'Отказаться от операции' : 'Отмена'}</button>
    </div>
  </form>;
};

const Campaigns: React.FC<{ allowCreate?: boolean }> = ({ allowCreate = true }) => {
  const { api, sessionKey, navigate, path } = useWorkspace();
  const campaigns = useResource(`${sessionKey}:campaign-list`, () => api.listCampaigns());
  const location = useLocation();
  const [createOpen, setCreateOpen] = useState(false);
  const [requestId, setRequestId] = useState(newRequestId);
  const requestedCreate = new URLSearchParams(location.search).get('create') === '1';
  useEffect(() => {
    if (!allowCreate || !requestedCreate || createOpen) return;
    setRequestId(newRequestId());
    setCreateOpen(true);
    navigate(path('/'), { replace: true });
  }, [allowCreate, requestedCreate, createOpen, navigate, path]);
  return <main className={styles.page} aria-busy={campaigns.loading || undefined}>
    <h1>Кампании</h1>
    {campaigns.loading && !campaigns.data && <p>Загрузка кампаний…</p>}
    {Boolean(campaigns.error) && <ApiError error={campaigns.error} onRetry={campaigns.reload} />}
    {campaigns.data && (campaigns.data.length ? <List layout="horizontal" gap="medium">{campaigns.data.map((campaign: Campaign) => <CampaignCard key={campaign.id} campaign={campaign} />)}</List> : <p>Кампаний пока нет.</p>)}
    {!createOpen && (allowCreate ? <Button type="button" onClick={() => { setRequestId(newRequestId()); setCreateOpen(true); }}>Создать кампанию</Button> : <Button type="button" onClick={() => navigate(`${path('/')}?create=1`)}>Создать кампанию</Button>)}
    {allowCreate && createOpen && <CampaignCreateForm key={requestId} requestId={requestId} onClose={() => setCreateOpen(false)} onNewRequest={() => setRequestId(newRequestId())} />}
  </main>;
};
export default Campaigns;
