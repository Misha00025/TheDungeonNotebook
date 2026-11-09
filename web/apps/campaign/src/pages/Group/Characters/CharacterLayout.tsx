import React, { useState, useEffect } from 'react';
import { useParams, Outlet } from 'react-router-dom';
import { usePlatform } from '../../../hooks/usePlatform';
import { groupAPI } from '../../../services/api';
import { Group } from '../../../types/group';
import { useCampaignPath } from '../../../navigation';
import PageLayout from '@tdn/shared/ui/PageLayout/PageLayout';
import PageHeader from '@tdn/shared/ui/PageLayout/PageHeader';
import { TabItem } from '@tdn/shared/ui/PageLayout/TabBar';
import { useVisited } from '../../../contexts/VisitedContext';
import { useDashboardSettings } from '../../../hooks/useDashboardSettings';
import { DashboardSettingsProvider, DashboardSettingsContextType } from '../../../contexts/DashboardSettingsContext';
import { CharacterProvider, useCharacter } from '../../../contexts/CharacterContext';
import ActionLogSidebar from '../../../components/commons/ActionLogSidebar/ActionLogSidebar';

interface CharacterLayoutContentProps {
  group: Group | null;
  dashboardSettings: DashboardSettingsContextType;
}

const CharacterLayoutContent: React.FC<CharacterLayoutContentProps> = ({ group, dashboardSettings }) => {
  const { character, characterLoading, error, refreshCharacter } = useCharacter();
  const isMobile = usePlatform();
  const campaignPath = useCampaignPath();
  const { groupId, characterId } = useParams<{ groupId: string; characterId: string }>();

  useEffect(() => {
    refreshCharacter();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const characterTabs: TabItem[] = [
    { id: 'resources', label: 'Главная', path: 'resources' },
    { id: 'stats', label: 'Статы', path: 'stats' },
    { id: 'items', label: 'Инвентарь', path: 'items' },
    { id: 'skills', label: 'Способности', path: 'skills' },
    { id: 'quests', label: 'Квесты', path: 'quests' },
    // { id: 'notes', label: 'Заметки', path: 'notes' },
  ];

  if (!group || (characterLoading && !character)) return <div>Загрузка...</div>;
  if (error) return <div>Ошибка: {error}</div>;
  if (!character) return <div>Персонаж не найден</div>;

  return (
    <PageLayout
      breadcrumbs={[
        { label: 'Группы', path: campaignPath('/groups') },
        { label: group.name, path: campaignPath(`/groups/${groupId}`) },
        { label: character.name },
      ]}
      header={
        <PageHeader
          title={character.name}
          subtitle={character.description}
        />
      }
      tabs={characterTabs}
      tabBasePath={campaignPath(`/groups/${groupId}/character/${characterId}`)}
      tabOrientation={isMobile ? 'bottom' : 'top'}
    >
      <DashboardSettingsProvider value={dashboardSettings as DashboardSettingsContextType}>
        <Outlet />
        <ActionLogSidebar groupId={Number(groupId)} characterId={Number(characterId)} />
      </DashboardSettingsProvider>
    </PageLayout>
  );
};

const CharacterLayout: React.FC = () => {
  const { groupId, characterId } = useParams<{ groupId: string; characterId: string }>();
  const [group, setGroup] = useState<Group | null>(null);
  const { visitCharacter } = useVisited();

  useEffect(() => {
    if (!groupId) return;
    groupAPI.getGroup(Number(groupId)).then(setGroup).catch(() => setGroup(null));
  }, [groupId]);

  useEffect(() => {
    if (!groupId || !characterId) return;
    visitCharacter(Number(groupId), Number(characterId));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId, characterId]);

  const dashboardSettings = useDashboardSettings(Number(groupId), Number(characterId));

  return (
    <CharacterProvider groupId={Number(groupId)} characterId={Number(characterId)}>
      <CharacterLayoutContent group={group} dashboardSettings={dashboardSettings} />
    </CharacterProvider>
  );
};

export default CharacterLayout;
