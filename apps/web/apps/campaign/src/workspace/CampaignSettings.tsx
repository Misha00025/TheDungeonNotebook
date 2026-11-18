import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useWorkspace, useDirtyDraft } from './Workspace';
import { useCampaignWorkspace } from './Shell';
import { useMutation, useResource } from './hooks';
import { ApiError } from './Feedback';
import commonStyles from '@tdn/shared/styles/common.module.css';
import buttonStyles from '@tdn/shared/styles/components/Button.module.css';
import inputStyles from '@tdn/shared/styles/components/Input.module.css';
import styles from './Workspace.module.css';

const CampaignSettings: React.FC = () => {
  const { groupId = '' } = useParams();
  const id = Number(groupId);
  const { api, sessionKey, notifyInvalidation } = useWorkspace();
  const { campaign, permissions, permissionsLoading = false, mode, reloadCampaign } = useCampaignWorkspace();
  const [name, setName] = useState(campaign.name);
  const [baseName, setBaseName] = useState(campaign.name);
  const [revision, setRevision] = useState(campaign.metadataRevision);
  const [conflict, setConflict] = useState(false);
  const [verificationKey, setVerificationKey] = useState(0);
  const [verified, setVerified] = useState(false);
  const [frozen, setFrozen] = useState(false);
  const [readLatest, setReadLatest] = useState(false);
  const [verifiedSnapshot, setVerifiedSnapshot] = useState<{ name: string; metadataRevision: typeof revision }>();
  const [savedMessage, setSavedMessage] = useState(false);
  const seenCampaignRevision = React.useRef(String(campaign.metadataRevision));
  const ownSavedRevision = React.useRef<string | undefined>(undefined);
  const latest = useResource(`${sessionKey}:${id}:settings-latest:${verificationKey}`, () => api.getCampaign(id), readLatest);
  const dirty = name !== baseName;
  const clearDirty = useDirtyDraft(`campaign-settings-${id}`, dirty);
  const save = useMutation((value: { name: string; expectedRevision: typeof revision }) => api.renameCampaign(id, value));
  useEffect(() => {
    const nextRevision = String(campaign.metadataRevision);
    if (seenCampaignRevision.current === nextRevision) return;
    seenCampaignRevision.current = nextRevision;
    if (ownSavedRevision.current === nextRevision) { ownSavedRevision.current = undefined; return; }
    if (!dirty && !conflict && !frozen) { setRevision(campaign.metadataRevision); setBaseName(campaign.name); setName(campaign.name); setVerifiedSnapshot(undefined); }
    else if (dirty && nextRevision !== String(revision)) { setVerifiedSnapshot({ name: campaign.name, metadataRevision: campaign.metadataRevision }); setConflict(true); setFrozen(true); setVerified(false); }
  }, [campaign.metadataRevision, campaign.name, dirty, conflict, frozen, revision]);
  const reloadVersion = () => { setReadLatest(true); setVerified(false); setVerificationKey(value => value + 1); };
  useEffect(() => { if (!readLatest || latest.loading) return; if (latest.error) { setVerified(false); return; } if (latest.data) { setVerifiedSnapshot({ name: latest.data.name, metadataRevision: latest.data.metadataRevision }); setRevision(latest.data.metadataRevision); seenCampaignRevision.current = String(campaign.metadataRevision); setVerified(true); setConflict(true); setFrozen(false); setReadLatest(false); } }, [readLatest, latest.loading, latest.error, latest.data, campaign.metadataRevision]);
  const cancel = () => { if (dirty && !window.confirm('Отказаться от черновика настроек?')) return; setName(baseName); clearDirty(); };
  const submit = async (event: React.FormEvent) => { event.preventDefault(); if (mode !== 'gm' || !permissions.canWrite || permissionsLoading || !dirty || !name.trim() || save.busy || ((conflict || frozen) && !verified)) return; const submittedName = name.trim(); setSavedMessage(false); try { const saved = await save.run({ name: submittedName, expectedRevision: revision }); if (saved) { setName(saved.name); setBaseName(saved.name); setRevision(saved.metadataRevision); ownSavedRevision.current = String(saved.metadataRevision); setVerifiedSnapshot(undefined); clearDirty(); setConflict(false); setVerified(false); setFrozen(false); setSavedMessage(true); reloadCampaign(); } } catch (error) { const status = error && typeof error === 'object' && 'status' in error ? Number(error.status) : undefined; const outcomeUnknown = Boolean(error && typeof error === 'object' && 'unknownOutcome' in error && error.unknownOutcome); if (status === 409) { setConflict(true); setVerified(false); } if (outcomeUnknown) { setFrozen(true); setVerified(false); } if (status === 403) { reloadCampaign(); notifyInvalidation('permissions'); } } };
   return <section className={styles.page}><h2>Настройки кампании</h2>{(mode !== 'gm' || !permissions.canWrite) && <p role="alert">Нет доступа к настройкам кампании.</p>}{permissionsLoading && <p>Проверка прав кампании…</p>}<form className={commonStyles.form} onSubmit={submit}><label className={commonStyles.formGroup}>Название кампании<input className={inputStyles.input} value={name} disabled={save.busy || permissionsLoading || mode !== 'gm' || !permissions.canWrite} onChange={event => { setName(event.target.value); setSavedMessage(false); }} /></label>{(conflict || frozen) && <div role="alert"><p>{conflict ? 'Версия изменилась. Черновик названия сохранён; перечитайте актуальную версию перед повторной записью.' : 'Результат записи неизвестен. Запись заблокирована до проверки актуальной версии.'}</p><button type="button" className={buttonStyles.button} disabled={latest.loading} onClick={reloadVersion}>Перечитать версию</button>{latest.loading && <p>Чтение актуальной версии…</p>}{Boolean(latest.error) && <ApiError error={latest.error} onRetry={reloadVersion} />}{verifiedSnapshot && <p>Текущая версия: «{verifiedSnapshot.name}». Черновик: «{name}».</p>}</div>}{Boolean(save.error) && <ApiError error={save.error} />}{readLatest && Boolean(latest.error) && <p>Не удалось проверить версию; запись заблокирована до успешного перечитывания.</p>}{savedMessage && <p role="status">Название сохранено.</p>}<div className={commonStyles.formActions}><button className={buttonStyles.button} disabled={!name.trim() || !dirty || save.busy || permissionsLoading || mode !== 'gm' || !permissions.canWrite || ((conflict || frozen) && !verified) || (readLatest && !verified)}>{save.busy ? 'Сохранение…' : 'Сохранить'}</button><button type="button" className={buttonStyles.button} disabled={save.busy} onClick={cancel}>Отмена</button></div></form></section>;
};
export default CampaignSettings;
