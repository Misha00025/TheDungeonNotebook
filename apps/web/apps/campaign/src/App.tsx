import React from 'react';
import { Link, Navigate, Route, Routes, useParams } from 'react-router-dom';
import { useAuth, RemoteAuthProvider } from '@tdn/shared';
import type { HubRemoteProps } from '@tdn/shared';
import { WorkspaceProvider, DirtyProvider, useAcceptedLocation, useWorkspace } from './workspace/Workspace';
import { useResource } from './workspace/hooks';
import { ApiError } from './workspace/Feedback';
import Campaigns from './workspace/Campaigns';
import Shell, { useCampaignWorkspace } from './workspace/Shell';
import Characters from './workspace/Characters';
import CampaignOverview from './workspace/CampaignOverview';
import Members from './workspace/Members';
import CampaignSettings from './workspace/CampaignSettings';
import Templates from './workspace/Templates';
import Formulas from './workspace/Formulas';
import CharacterSheet from './workspace/CharacterSheet';
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
const LegacySectionEntry: React.FC<{ target: 'members' | 'settings' | 'templates' }> = ({ target }) => {
  const { groupId = '' } = useParams();
  const { api, path, sessionKey, invalidation } = useWorkspace();
  const id = Number(groupId);
  const resource = useResource(`${sessionKey}:${id}:legacy-section:${invalidation}`, () => api.campaignPermissions(id));
  if (resource.loading) return <p>Загрузка прав кампании…</p>;
  if (resource.error) return <ApiError error={resource.error} onRetry={resource.reload} />;
  return <Navigate to={path(`/${id}/${resource.data?.canWrite ? target === 'templates' ? 'gm/templates' : `gm/${target}` : 'player/characters'}`)} replace />;
};
const GuardedRoutes: React.FC = () => {
  const accepted = useAcceptedLocation();
  return <Routes location={accepted}>
    <Route index element={<Campaigns />} />
    <Route path=":groupId" element={<Shell />}>
      <Route index element={<ModeEntry />} />
      <Route path="gm/overview" element={<CampaignOverview />} />
      <Route path="gm/templates" element={<Templates />} />
      <Route path="gm/formulas" element={<Formulas />} />
      <Route path="templates" element={<LegacySectionEntry target="templates" />} />
      <Route path="gm/characters" element={<Characters />} />
      <Route path="gm/characters/:characterId/:tab" element={<CharacterSheetRoute />} />
      <Route path="gm/members" element={<Members />} />
      <Route path="gm/settings" element={<CampaignSettings />} />
      <Route path="users" element={<LegacySectionEntry target="members" />} />
      <Route path="settings" element={<LegacySectionEntry target="settings" />} />
      <Route path="player/characters" element={<Characters />} />
      <Route path="player/characters/:characterId/:tab" element={<CharacterSheetRoute />} />
      <Route path="character/:characterId" element={<LegacyCharacterRoute />} />
      <Route path="character/:characterId/:legacyTab" element={<LegacyCharacterRoute />} />
      <Route path="characters" element={<LegacyCharactersEntry />} />
      <Route path="*" element={<NotFound />} />
    </Route>
    <Route path="*" element={<NotFound />} />
  </Routes>;
};
const CharacterSheetRoute: React.FC = () => {
  const { groupId = '', characterId = '', tab = '' } = useParams();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(characterId) || !['overview', 'stats'].includes(tab)) return <NotFound />;
  return <CharacterSheet key={`${groupId}:${characterId}`} campaignId={Number(groupId)} characterId={characterId} stats={tab === 'stats'} />;
};
const LegacyCharacterRoute: React.FC = () => {
  const { groupId = '', characterId = '', legacyTab } = useParams();
  const { path } = useWorkspace();
  const { permissions } = useCampaignWorkspace();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(characterId)) return <NotFound />;
  if (legacyTab !== undefined && !['base', 'resources', 'stats'].includes(legacyTab)) return <NotFound />;
  const tab = legacyTab === 'stats' ? 'stats' : 'overview';
  const mode = permissions.canWrite ? 'gm' : 'player';
  return <Navigate to={path(`/${groupId}/${mode}/characters/${encodeURIComponent(characterId)}/${tab}`)} replace />;
};
const AppContent: React.FC = () => {
  const { authenticated, userId } = useAuth();
  if (!authenticated) return null;
  return <WorkspaceProvider key={String(userId)}><DirtyProvider><GuardedRoutes /></DirtyProvider></WorkspaceProvider>;
};
const App: React.FC<HubRemoteProps> = ({ auth }) => <RemoteAuthProvider auth={auth}><AppContent /></RemoteAuthProvider>;
export default App;
