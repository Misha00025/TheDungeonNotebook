import React from 'react';
import { Routes, Route, Navigate, useParams, Outlet } from 'react-router-dom';
import { GroupSchemasProvider } from './contexts/GroupSchemasContext';
import { useAuth, RemoteAuthProvider } from '@tdn/shared';
import { GroupProvider } from './contexts/GroupContext';
import { VisitedProvider } from './contexts/VisitedContext';
import Dashboard from './pages/Dashboard';
import Groups from './pages/Groups';
import GroupLayout from './pages/Group/GroupLayout';
import GroupSettings from './pages/Group/GroupSettings';
import GroupUsers from './pages/Group/GroupUsers';
import CharacterTemplates from './pages/Group/Characters/Template/CharacterTemplates';
import Characters from './pages/Group/Characters/Characters';
import CharacterLayout from './pages/Group/Characters/CharacterLayout';
import Character from './pages/Group/Characters/Character/Character';
import CharacterDashboard from './pages/Group/Characters/Character/CharacterDashboard';
import CharacterItems from './pages/Group/Characters/Character/CharacterItems';
import CharacterSkills from './pages/Group/Characters/Character/CharacterSkills';
import CharacterNotes from './pages/Group/Characters/Character/CharacterNotes';
import CharacterQuests from './pages/Group/Characters/CharacterQuests';
import GroupItems from './pages/Group/GroupItems';
import GroupNotes from './pages/Group/GroupNotes';
import GroupQuests from './pages/Group/GroupQuests';
import '@tdn/shared/styles/globals.css';
import { GroupUsersProvider } from './contexts/GroupUsersContext';
import { PermissionsProvider } from './contexts/PermissionsContext';
import GroupSkills from './pages/Group/GroupSkills';
import type { HubRemoteProps } from '@tdn/shared';

const GroupSchemasBoundary: React.FC = () => {
  const { groupId } = useParams<{ groupId: string }>();
  if (!groupId) {
    return <Outlet />;
  }
  return (
    <GroupSchemasProvider groupId={Number(groupId)}>
      <Outlet />
    </GroupSchemasProvider>
  );
};

const AppContent: React.FC = () => {
  const { authenticated } = useAuth();
  if (!authenticated) return null;

  return (
    <Routes>
      <Route index element={<Groups />} />
      <Route path=":groupId" element={<GroupSchemasBoundary />}>
        <Route element={<GroupLayout />}>
          <Route index element={<Navigate to="characters" replace />} />
          <Route path="characters" element={<Characters />} />
          <Route path="settings" element={<GroupSettings />} />
          <Route path="users" element={<GroupUsers />} />
          <Route path="templates" element={<CharacterTemplates />} />
          <Route path="skills" element={<GroupSkills />} />
          <Route path="items" element={<GroupItems />} />
          <Route path="notes" element={<GroupNotes />} />
          <Route path="quests" element={<GroupQuests />} />
        </Route>
        <Route path="character/:characterId" element={<CharacterLayout />}>
          <Route index element={<CharacterDashboard />} />
          <Route path="resources" element={<CharacterDashboard />} />
          <Route path="stats" element={<Character />} />
          <Route path="items" element={<CharacterItems />} />
          <Route path="skills" element={<CharacterSkills />} />
          <Route path="quests" element={<CharacterQuests />} />
          <Route path="notes" element={<CharacterNotes />} />
        </Route>
      </Route>
      <Route path="/" element={<Dashboard />} />
      <Route path="/login" element={<Navigate to="/" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

const App: React.FC<HubRemoteProps> = ({ auth }) => {
  return (
    <RemoteAuthProvider auth={auth}>
      <GroupProvider>
        <VisitedProvider>
          <GroupUsersProvider>
            <PermissionsProvider>
              <AppContent />
            </PermissionsProvider>
          </GroupUsersProvider>
        </VisitedProvider>
      </GroupProvider>
    </RemoteAuthProvider>
  );
};

export default App;
