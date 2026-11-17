import React from 'react';
import { Link, Navigate, Route, Routes, useParams } from 'react-router-dom';
import { useAuth, RemoteAuthProvider } from '@tdn/shared';
import type { HubRemoteProps } from '@tdn/shared';
import { WorkspaceProvider, DirtyProvider, useAcceptedLocation, useWorkspace } from './workspace/Workspace';
import { useResource } from './workspace/hooks';
import { ApiError } from './workspace/Feedback';
import Campaigns from './workspace/Campaigns';
import Shell from './workspace/Shell';
import Characters from './workspace/Characters';
import CampaignOverview from './workspace/CampaignOverview';
import Members from './workspace/Members';
import CampaignSettings from './workspace/CampaignSettings';
import '@tdn/shared/styles/globals.css';

const NotFound: React.FC = () => { const { path } = useWorkspace(); return <section><h2>Страница не найдена</h2><Link to={path('/')}>К кампаниям</Link></section>; };
const ModeEntry: React.FC = () => {
  const { groupId = '' } = useParams();
  const { api, path, sessionKey, invalidation } = useWorkspace();
  const id = Number(groupId);
  const valid = Boolean(groupId.trim()) && Number.isInteger(id) && id >= -2147483648 && id <= 2147483647;
  const resource = useResource(`${sessionKey}:${id}:mode-entry:${invalidation}`, () => valid ? api.campaignPermissions(id) : Promise.reject(new Error('Invalid campaign id')));
  if (!valid) return <NotFound />;
  if (resource.loading) return <p>Загрузка прав кампании…</p>;
  if (resource.error) return <ApiError error={resource.error} onRetry={resource.reload} />;
  return <Navigate to={path(`/${id}/${resource.data?.canWrite ? 'gm/overview' : 'player/characters'}`)} replace />;
};
const LegacyCharactersEntry: React.FC = () => {
  const { groupId = '' } = useParams();
  const { api, path, sessionKey, invalidation } = useWorkspace();
  const id = Number(groupId);
  const resource = useResource(`${sessionKey}:${id}:legacy-character-mode:${invalidation}`, () => api.campaignPermissions(id));
  if (resource.loading) return <p>Загрузка прав кампании…</p>;
  if (resource.error) return <ApiError error={resource.error} onRetry={resource.reload} />;
  return <Navigate to={path(`/${id}/${resource.data?.canWrite ? 'gm' : 'player'}/characters`)} replace />;
};
const LegacySectionEntry: React.FC<{ target: 'members' | 'settings' }> = ({ target }) => {
  const { groupId = '' } = useParams();
  const { api, path, sessionKey, invalidation } = useWorkspace();
  const id = Number(groupId);
  const resource = useResource(`${sessionKey}:${id}:legacy-section:${invalidation}`, () => api.campaignPermissions(id));
  if (resource.loading) return <p>Загрузка прав кампании…</p>;
  if (resource.error) return <ApiError error={resource.error} onRetry={resource.reload} />;
  return <Navigate to={path(`/${id}/${resource.data?.canWrite ? `gm/${target}` : 'player/characters'}`)} replace />;
};
const GuardedRoutes: React.FC = () => {
  const accepted = useAcceptedLocation();
  return <Routes location={accepted}>
    <Route index element={<Campaigns />} />
    <Route path=":groupId" element={<Shell />}>
      <Route index element={<ModeEntry />} />
      <Route path="gm/overview" element={<CampaignOverview />} />
      <Route path="gm/characters" element={<Characters />} />
      <Route path="gm/members" element={<Members />} />
      <Route path="gm/settings" element={<CampaignSettings />} />
      <Route path="users" element={<LegacySectionEntry target="members" />} />
      <Route path="settings" element={<LegacySectionEntry target="settings" />} />
      <Route path="player/characters" element={<Characters />} />
      <Route path="characters" element={<LegacyCharactersEntry />} />
      <Route path="*" element={<NotFound />} />
    </Route>
    <Route path="*" element={<NotFound />} />
  </Routes>;
};
const AppContent: React.FC = () => {
  const { authenticated, userId } = useAuth();
  if (!authenticated) return null;
  return <WorkspaceProvider key={String(userId)}><DirtyProvider><GuardedRoutes /></DirtyProvider></WorkspaceProvider>;
};
const App: React.FC<HubRemoteProps> = ({ auth }) => <RemoteAuthProvider auth={auth}><AppContent /></RemoteAuthProvider>;
export default App;
