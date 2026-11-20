import React, { createContext, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Navigate, Outlet, useLocation, useParams } from 'react-router-dom';
import { Badge, BottomNavigation, Breadcrumbs, Button, Field, NavigationIcon, Notification, SectionNav, Select, StatePanel, WorkspaceLayout } from '@tdn/shared';
import type { BottomNavigationItem, NavigationIconName } from '@tdn/shared';
import type { Campaign, Permissions } from './types';
import { useWorkspace } from './Workspace';
import { useVisitHistory } from './VisitHistory';
import { useResource } from './hooks';
import { ApiError } from './Feedback';

export type CampaignWorkspaceValue = { campaign: Campaign; permissions: Permissions; lastKnownPermissions: Permissions; permissionsLoading?: boolean; mode: 'gm' | 'player'; reloadCampaign: () => void; reloadPermissions: () => void; updateCampaign: (campaign: Campaign) => void };
const CampaignContext = createContext<CampaignWorkspaceValue | null>(null);
export const useCampaignWorkspace = () => { const value = useContext(CampaignContext); if (!value) throw new Error('useCampaignWorkspace requires campaign route'); return value; };
export const useOptionalCampaignWorkspace = () => useContext(CampaignContext);
const CampaignShell: React.FC = () => {
  const { groupId = '' } = useParams();
  const id = Number(groupId);
  const { api, path, sessionKey, navigate } = useWorkspace();
  const { visitGroup } = useVisitHistory();
  const location = useLocation();
  const campaignSelectId = React.useId();
  const [switchBusy, setSwitchBusy] = useState(false);
  const [switchError, setSwitchError] = useState<unknown>();
  const busy = useRef(false);
  const sequence = useRef(0);
  const mounted = useRef(true);
  const route = useRef(location.pathname);
  const scope = useRef(`${sessionKey}:${id}`);
  const recordedGroup = useRef<string | null>(null);
  const valid = Boolean(groupId.trim()) && Number.isInteger(id) && id >= -2147483648 && id <= 2147483647;
  const campaign = useResource(`${sessionKey}:${id}:campaign`, () => valid ? api.getCampaign(id) : Promise.reject(new Error('Invalid campaign id')));
  const permission = useResource(`${sessionKey}:${id}:permissions`, () => valid ? api.campaignPermissions(id) : Promise.reject(new Error('Invalid campaign id')));
  const campaigns = useResource(`${sessionKey}:campaign-list`, () => api.listCampaigns());
  const mode: 'gm' | 'player' = location.pathname.includes('/gm/') ? 'gm' : 'player';
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; sequence.current += 1; busy.current = false; }; }, []);
  useLayoutEffect(() => { if (route.current !== location.pathname) { route.current = location.pathname; sequence.current += 1; busy.current = false; setSwitchBusy(false); setSwitchError(undefined); } }, [location.pathname]);
  useLayoutEffect(() => { const next = `${sessionKey}:${id}`; if (scope.current !== next) { scope.current = next; sequence.current += 1; busy.current = false; setSwitchBusy(false); setSwitchError(undefined); } }, [sessionKey, id]);
  const updateCampaign = (saved: Campaign) => {
    if (saved.id !== campaign.data?.id) return;
    campaign.setData(saved);
    if (campaigns.data) campaigns.setData(campaigns.data.map(item => item.id === saved.id ? { ...item, name: saved.name } : item));
  };
  useEffect(() => {
    const identity = `${sessionKey}:${id}`;
    if (!valid || !campaign.data || campaign.loading || campaign.error || !permission.data || permission.loading || permission.error || (!permission.data.canRead && !permission.data.canWrite) || recordedGroup.current === identity) return;
    recordedGroup.current = identity;
    visitGroup(id);
  }, [sessionKey, id, valid, campaign.data, campaign.loading, campaign.error, permission.data, permission.loading, permission.error, visitGroup]);
  if (!valid) return <Notification kind="error" eventKey={groupId}>Некорректный идентификатор кампании.</Notification>;
  if (campaign.loading && !campaign.data) return <StatePanel kind="loading">Загрузка кампании…</StatePanel>;
  if (campaign.error && !campaign.data) return <ApiError error={campaign.error} onRetry={campaign.reload} />;
  if (!campaign.data) return <Notification kind="error" eventKey={campaign.error}>Данные кампании недоступны.</Notification>;
  if (permission.loading && !permission.data) return <StatePanel kind="loading">Загрузка прав кампании…</StatePanel>;
  if (permission.error && !permission.data) return <ApiError error={permission.error} onRetry={permission.reload} />;
  if (!permission.data) return <Notification kind="error" eventKey={permission.error}>Права кампании недоступны.</Notification>;
  if (mode === 'gm' && !permission.loading && !permission.error && !permission.data.canWrite) return <Navigate to={path(`/${id}/player/characters`)} replace />;
  const effective = permission.data;
  const canEnterGm = effective.canWrite;
  const targetMode = (next: 'gm' | 'player') => path(`/${id}/${next === 'gm' ? 'gm/overview' : 'player/characters'}`);
  const switchMode = async () => {
    if (busy.current || permission.loading || permission.error) return;
    const target = mode === 'gm' ? 'player' : 'gm';
     const sheetRoute = location.pathname.match(/\/(?:gm|player)\/characters\/([^/]+)(?:\/(page_[1-9]\d*|overview|stats|all-stats))?$/);
    if (!sheetRoute) { navigate(targetMode(target)); return; }
    busy.current = true; const current = ++sequence.current; const pathname = location.pathname; setSwitchBusy(true); setSwitchError(undefined);
    try {
      const access = await api.characterPermissions(id, decodeURIComponent(sheetRoute[1]));
      if (mounted.current && sequence.current === current && route.current === pathname) {
        if (target === 'gm' && !canEnterGm) navigate(targetMode(target));
         else if (access.canRead || access.canWrite) {
           const page = sheetRoute[2]?.startsWith('page_') ? `/${sheetRoute[2]}` : '';
           navigate(path(`/${id}/${target}/characters/${encodeURIComponent(decodeURIComponent(sheetRoute[1]))}${page}`));
         }
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
    try { const access = await api.campaignPermissions(next); if (mounted.current && sequence.current === current && route.current === pathname) { navigate(path(`/${next}/${mode === 'gm' && access.canWrite ? 'gm/overview' : 'player/characters'}`)); } }
    catch (error) { if (mounted.current && sequence.current === current && route.current === pathname) setSwitchError(error); }
    finally { if (mounted.current && sequence.current === current) { busy.current = false; setSwitchBusy(false); } }
  };
  const nav: [string, string][] = mode === 'gm' ? [['Обзор', 'gm/overview'], ['Персонажи', 'gm/characters'], ['Шаблон', 'gm/templates'], ['Формулы', 'gm/formulas'], ['Представления', 'gm/views'], ['Участники и доступ', 'gm/members'], ['Настройки', 'gm/settings']] : [['Мои персонажи', 'player/characters']];
  const title = nav.find(([, suffix]) => location.pathname.endsWith(`/${suffix}`))?.[0] ?? campaign.data.name;
  const sectionIcons: Record<string, NavigationIconName> = {
    'gm/overview': 'home',
    'gm/characters': 'people',
    'gm/templates': 'document',
    'gm/formulas': 'function',
    'gm/views': 'layout',
    'gm/members': 'access',
    'gm/settings': 'settings',
    'player/characters': 'people',
  };
  const campaignNavigation: BottomNavigationItem[] = nav.map(([label, route]) => {
    const to = path(`/${id}/${route}`);
    return {
      id: route,
      label: route === 'gm/members' ? 'Участники' : label,
      icon: <NavigationIcon name={sectionIcons[route]} />,
      to,
      active: location.pathname === to || location.pathname.startsWith(`${to}/`),
    };
  });
   const sheetRoute = location.pathname.match(/\/(?:gm|player)\/characters\/([^/]+)(?:\/(page_[1-9]\d*|overview|stats|all-stats))?$/);
  const sheetCharacterId = sheetRoute?.[1];
  const validSheetCharacter = Boolean(sheetCharacterId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sheetCharacterId));
  const mobileItems: BottomNavigationItem[] = validSheetCharacter && sheetRoute && sheetCharacterId
    ? [{ id: `back-${id}-${mode}-${sheetCharacterId}`, label: 'Назад', icon: <NavigationIcon name="arrow-left" />, to: path(`/${id}/${mode}/characters`) }]
    : campaignNavigation;
  const mobileNavigationKey = validSheetCharacter && sheetRoute && sheetCharacterId
    ? `${id}:${mode}:${sheetCharacterId}:${sheetRoute[2] ?? 'entry'}`
    : `${id}:${mode}:campaign`;
  const campaignItems = campaigns.data ?? [];
  const campaignOptions = campaignItems.some(item => item.id === id)
    ? campaignItems
    : [{ id, name: campaign.data.name }, ...campaignItems];
  return <CampaignContext.Provider value={{ campaign: campaign.data, permissions: effective, lastKnownPermissions: permission.data, permissionsLoading: permission.loading || Boolean(permission.error), mode, reloadCampaign: campaign.reload, reloadPermissions: permission.reload, updateCampaign }}>
    <WorkspaceLayout navigation={<>
      <Badge>Режим: {mode === 'gm' ? 'Мастер' : 'Игрок'}</Badge>
      <Field label="Кампания" htmlFor={campaignSelectId}>
        <Select id={campaignSelectId} value={String(id)} disabled={switchBusy || (campaigns.loading && !campaigns.data)} aria-busy={campaigns.loading || undefined} onChange={event => { void changeCampaign(Number(event.target.value)); }}>
          {campaignOptions.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
        </Select>
      </Field>
      {Boolean(campaigns.error) && <ApiError error={campaigns.error} onRetry={campaigns.reload} />}
      {effective.canWrite && <Button variant="secondary" disabled={switchBusy || permission.loading || Boolean(permission.error)} onClick={switchMode}>{mode === 'gm' ? 'Пространство игрока' : 'Пространство мастера'}</Button>}
       <SectionNav aria-label="Разделы кампании" hideOnMobile items={nav.map(([label, route]) => {
        const to = path(`/${id}/${route}`);
        return { label, to, active: location.pathname === to || location.pathname.startsWith(`${to}/`) };
      })} />
    </>} mobileNavigation={<BottomNavigation key={mobileNavigationKey} aria-label={validSheetCharacter ? 'Лист персонажа на телефоне' : 'Навигация кампании на телефоне'} items={mobileItems} />}>
      <Breadcrumbs items={[{ label: 'Кампании', path: path('/') }, { label: campaign.data.name, path: targetMode(mode) }, { label: title }]} />
       {Boolean(permission.error) && <ApiError error={permission.error} onRetry={permission.reload} />}{Boolean(switchError) && <ApiError error={switchError} />}<Outlet />
    </WorkspaceLayout>
  </CampaignContext.Provider>;
};
const Shell: React.FC = () => { const { groupId = '' } = useParams(); return <CampaignShell key={groupId} />; };
export default Shell;
