import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useWorkspace, useDirtyDraft } from './Workspace';
import { useMutation, useResource } from './hooks';
import { runCreation, CampaignApiError } from './api';
import type { Campaign, Permissions } from './types';
import { ApiError } from './Feedback';
import commonStyles from '@tdn/shared/styles/common.module.css';
import buttonStyles from '@tdn/shared/styles/components/Button.module.css';
import inputStyles from '@tdn/shared/styles/components/Input.module.css';
import styles from './Workspace.module.css';

const newRequestId = () => crypto.randomUUID();
const isUncertainCreation = (error: unknown) => error instanceof CampaignApiError && (error.unknownOutcome || ['creation_already_published', 'already_published'].includes(error.problem.code));

const CampaignCard: React.FC<{ campaign: Campaign }> = ({ campaign }) => {
  const { api, path, sessionKey, invalidation } = useWorkspace();
  const resource = useResource<Permissions>(`${sessionKey}:${campaign.id}:permissions:${invalidation}`, () => api.campaignPermissions(campaign.id));
  return <article className={commonStyles.card}>
    <h2>{campaign.name}</h2>
    {resource.loading && <p>Загрузка прав…</p>}
    {Boolean(resource.error) && <ApiError error={resource.error} onRetry={resource.reload} />}
    {resource.data && <div className={styles.actions}>{resource.data.canRead && <Link to={path(`/${campaign.id}/player/characters`)}>Играть</Link>}{resource.data.canWrite && <Link to={path(`/${campaign.id}/gm/overview`)}>Вести</Link>}{!resource.data.canRead && !resource.data.canWrite && <p>Нет доступных действий.</p>}</div>}
  </article>;
};

const CampaignCreateForm: React.FC<{ onClose: () => void; requestId: string; onNewRequest: () => void }> = ({ onClose, requestId, onNewRequest }) => {
  const { api, navigate, path, notifyInvalidation } = useWorkspace();
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
    notifyInvalidation('campaigns');
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
    <label className={commonStyles.formGroup}>Название<input className={inputStyles.input} required value={name} disabled={uncertain || creation.busy} onChange={event => setName(event.target.value)} /></label>
    <label className={commonStyles.formGroup}>ID администратора (необязательно)<input className={inputStyles.input} value={administratorUserId} disabled={uncertain || creation.busy} onChange={event => setAdministratorUserId(event.target.value)} inputMode="numeric" /></label>
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
  const { api, sessionKey, invalidation, navigate, path } = useWorkspace();
  const campaigns = useResource(`${sessionKey}:campaign-list:${invalidation}`, () => api.listCampaigns());
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
  return <main className={styles.page}>
    <h1>Кампании</h1>
    {campaigns.loading && <p>Загрузка кампаний…</p>}
    {Boolean(campaigns.error) && <ApiError error={campaigns.error} onRetry={campaigns.reload} />}
    {campaigns.data && (campaigns.data.length ? <section className={styles.grid}>{campaigns.data.map((campaign: Campaign) => <CampaignCard key={campaign.id} campaign={campaign} />)}</section> : <p>Кампаний пока нет.</p>)}
    {!createOpen && (allowCreate ? <button className={buttonStyles.button} onClick={() => { setRequestId(newRequestId()); setCreateOpen(true); }}>Создать кампанию</button> : <Link className={buttonStyles.button} to={`${path('/')}?create=1`}>Создать кампанию</Link>)}
    {allowCreate && createOpen && <CampaignCreateForm key={requestId} requestId={requestId} onClose={() => setCreateOpen(false)} onNewRequest={() => setRequestId(newRequestId())} />}
  </main>;
};
export default Campaigns;
