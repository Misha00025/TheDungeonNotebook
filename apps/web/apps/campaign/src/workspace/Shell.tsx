import React, { createContext, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link, Navigate, Outlet, useLocation, useParams } from 'react-router-dom';
import { Breadcrumbs } from '@tdn/shared';
import commonStyles from '@tdn/shared/styles/common.module.css';
import buttonStyles from '@tdn/shared/styles/components/Button.module.css';
import type { Campaign, Permissions } from './types';
import { useWorkspace } from './Workspace';
import { useVisitHistory } from './VisitHistory';
import { useResource } from './hooks';
import { ApiError } from './Feedback';
import styles from './Workspace.module.css';

export type CampaignWorkspaceValue = { campaign: Campaign; permissions: Permissions; lastKnownPermissions: Permissions; permissionsLoading?: boolean; mode: 'gm' | 'player'; reloadCampaign: () => void };
const CampaignContext = createContext<CampaignWorkspaceValue | null>(null);
export const useCampaignWorkspace = () => { const value = useContext(CampaignContext); if (!value) throw new Error('useCampaignWorkspace requires campaign route'); return value; };
const CampaignShell: React.FC = () => {
  const { groupId = '' } = useParams();
  const id = Number(groupId);
  const { api, path, sessionKey, invalidation, navigate } = useWorkspace();
  const { visitGroup } = useVisitHistory();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [switchBusy, setSwitchBusy] = useState(false);
  const [switchError, setSwitchError] = useState<unknown>();
  const busy = useRef(false);
  const sequence = useRef(0);
  const mounted = useRef(true);
  const route = useRef(location.pathname);
  const scope = useRef(`${sessionKey}:${id}:${invalidation}`);
  const recordedGroup = useRef<string | null>(null);
  const valid = Boolean(groupId.trim()) && Number.isInteger(id) && id >= -2147483648 && id <= 2147483647;
  const campaign = useResource(`${sessionKey}:${id}:campaign`, () => valid ? api.getCampaign(id) : Promise.reject(new Error('Invalid campaign id')));
  const permission = useResource(`${sessionKey}:${id}:permissions`, () => valid ? api.campaignPermissions(id) : Promise.reject(new Error('Invalid campaign id')));
  const campaigns = useResource(`${sessionKey}:campaign-list:${invalidation}`, () => api.listCampaigns());
  const mode: 'gm' | 'player' = location.pathname.includes('/gm/') ? 'gm' : 'player';
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; sequence.current += 1; busy.current = false; }; }, []);
  useLayoutEffect(() => { if (route.current !== location.pathname) { route.current = location.pathname; sequence.current += 1; busy.current = false; setSwitchBusy(false); setSwitchError(undefined); } }, [location.pathname]);
  useLayoutEffect(() => { const next = `${sessionKey}:${id}:${invalidation}`; if (scope.current !== next) { scope.current = next; sequence.current += 1; busy.current = false; setSwitchBusy(false); setSwitchError(undefined); } }, [sessionKey, id, invalidation]);
  const initialInvalidation = useRef(invalidation);
  useEffect(() => { if (initialInvalidation.current === invalidation) return; initialInvalidation.current = invalidation; campaign.reload(); permission.reload(); }, [invalidation, campaign.reload, permission.reload]);
  useEffect(() => {
    const identity = `${sessionKey}:${id}`;
    if (!valid || !campaign.data || campaign.loading || campaign.error || !permission.data || permission.loading || permission.error || (!permission.data.canRead && !permission.data.canWrite) || recordedGroup.current === identity) return;
    recordedGroup.current = identity;
    visitGroup(id);
  }, [sessionKey, id, valid, campaign.data, campaign.loading, campaign.error, permission.data, permission.loading, permission.error, visitGroup]);
  if (!valid) return <p role="alert">Некорректный идентификатор кампании.</p>;
  if (campaign.loading && !campaign.data) return <p>Загрузка кампании…</p>;
  if (campaign.error && !campaign.data) return <ApiError error={campaign.error} onRetry={campaign.reload} />;
  if (!campaign.data) return <p role="alert">Данные кампании недоступны.</p>;
  if (permission.loading && !permission.data) return <p>Загрузка прав кампании…</p>;
  if (permission.error && !permission.data) return <ApiError error={permission.error} onRetry={permission.reload} />;
  if (!permission.data) return <p role="alert">Права кампании недоступны.</p>;
  if (mode === 'gm' && !permission.loading && !permission.error && !permission.data.canWrite) return <Navigate to={path(`/${id}/player/characters`)} replace />;
  const effective = permission.loading || permission.error ? { ...permission.data, canWrite: false, canManageAccess: false } : permission.data;
  const canEnterGm = effective.canWrite;
  const targetMode = (next: 'gm' | 'player') => path(`/${id}/${next === 'gm' ? 'gm/overview' : 'player/characters'}`);
  const switchMode = async () => {
    if (busy.current) return;
    const target = mode === 'gm' ? 'player' : 'gm';
    const sheetRoute = location.pathname.match(/\/(?:gm|player)\/characters\/([^/]+)\/(overview|stats)$/);
    if (!sheetRoute) { setMenuOpen(false); navigate(targetMode(target)); return; }
    busy.current = true; const current = ++sequence.current; const pathname = location.pathname; setSwitchBusy(true); setSwitchError(undefined);
    try {
      const access = await api.characterPermissions(id, decodeURIComponent(sheetRoute[1]));
      if (mounted.current && sequence.current === current && route.current === pathname) {
        setMenuOpen(false);
        if (target === 'gm' && !canEnterGm) navigate(targetMode(target));
        else if (access.canRead || access.canWrite) navigate(path(`/${id}/${target}/characters/${encodeURIComponent(decodeURIComponent(sheetRoute[1]))}/${sheetRoute[2]}`));
        else navigate(targetMode(target));
      }
    } catch (error) {
      const status = (error as { status?: number })?.status;
      if (mounted.current && sequence.current === current && route.current === pathname) {
        if (status === 403 || status === 404) navigate(targetMode(target));
        else setSwitchError(error);
      }
    } finally { if (mounted.current && sequence.current === current) { busy.current = false; setSwitchBusy(false); } }
  };
  const changeCampaign = async (next: number) => {
    if (busy.current) return;
    busy.current = true; const current = ++sequence.current; const pathname = location.pathname; setSwitchBusy(true); setSwitchError(undefined);
    try { const access = await api.campaignPermissions(next); if (mounted.current && sequence.current === current && route.current === pathname) { setMenuOpen(false); navigate(path(`/${next}/${mode === 'gm' && access.canWrite ? 'gm/overview' : 'player/characters'}`)); } }
    catch (error) { if (mounted.current && sequence.current === current && route.current === pathname) setSwitchError(error); }
    finally { if (mounted.current && sequence.current === current) { busy.current = false; setSwitchBusy(false); } }
  };
  const nav = mode === 'gm' ? [['Обзор', 'gm/overview'], ['Персонажи', 'gm/characters'], ['Шаблоны', 'gm/templates'], ['Формулы', 'gm/formulas'], ['Представления', 'gm/views'], ['Участники и доступ', 'gm/members'], ['Настройки', 'gm/settings']] : [['Мои персонажи', 'player/characters']];
  const title = nav.find(([, suffix]) => location.pathname.endsWith(`/${suffix}`))?.[0] ?? campaign.data.name;
  return <CampaignContext.Provider value={{ campaign: campaign.data, permissions: effective, lastKnownPermissions: permission.data, permissionsLoading: permission.loading || Boolean(permission.error), mode, reloadCampaign: campaign.reload }}>
    <div className={styles.workspace}><button className={`${buttonStyles.button} ${styles.mobileToggle}`} aria-expanded={menuOpen} aria-controls="campaign-navigation" onClick={() => setMenuOpen(value => !value)}>Меню</button><aside id="campaign-navigation" className={`${commonStyles.card} ${styles.sidebar} ${menuOpen ? styles.open : ''}`}>
      <p>Режим: {mode === 'gm' ? 'Мастер' : 'Игрок'}</p>
      <label>Кампания<select value={String(id)} disabled={switchBusy} onChange={event => { setMenuOpen(false); void changeCampaign(Number(event.target.value)); }} aria-label="Кампания">{campaigns.data?.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      {campaigns.loading && <p>Загрузка списка кампаний…</p>}
      {Boolean(campaigns.error) && <ApiError error={campaigns.error} onRetry={campaigns.reload} />}
      <nav aria-label="Разделы кампании">{nav.map(([label, route]) => <Link key={route} to={path(`/${id}/${route}`)} aria-current={location.pathname.endsWith(`/${route}`) ? 'page' : undefined} onClick={() => setMenuOpen(false)}>{label}</Link>)}</nav>
      {effective.canWrite && <button className={buttonStyles.button} disabled={switchBusy} onClick={switchMode}>{mode === 'gm' ? 'Пространство игрока' : 'Пространство мастера'}</button>}
    </aside><main className={styles.content}><Breadcrumbs items={[{ label: 'Кампании', path: path('/') }, { label: campaign.data.name, path: targetMode(mode) }, { label: title }]} /><h1>{campaign.data.name}</h1>
      {permission.loading && <p>Обновление прав кампании…</p>}{Boolean(permission.error) && <ApiError error={permission.error} onRetry={permission.reload} />}{Boolean(switchError) && <ApiError error={switchError} />}<Outlet />
    </main></div>
  </CampaignContext.Provider>;
};
const Shell: React.FC = () => { const { groupId = '' } = useParams(); return <CampaignShell key={groupId} />; };
export default Shell;
