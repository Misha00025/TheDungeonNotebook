import React, { useState, useEffect } from 'react';
import { useParams, Outlet } from 'react-router-dom';
import { Group } from '../../types/group';
import { groupAPI } from '../../services/api';
import { useGroup } from '../../contexts/GroupContext';
import { useVisited } from '../../contexts/VisitedContext';
import { usePlatform } from '../../hooks/usePlatform';
import { usePermissions } from '../../contexts/PermissionsContext';
import { useCampaignPath } from '../../navigation';
import PageLayout from '@tdn/shared/ui/PageLayout/PageLayout';
import PageHeader from '@tdn/shared/ui/PageLayout/PageHeader';
import { TabItem } from '@tdn/shared/ui/PageLayout/TabBar';

const GroupLayout: React.FC = () => {
  const { groupId } = useParams<{ groupId: string }>();
  const { selectedGroup, setSelectedGroup } = useGroup();
  const { isGroupAdmin } = usePermissions();
  const { visitGroup } = useVisited();
  const isMobile = usePlatform();
  const campaignPath = useCampaignPath();
  const [group, setGroup] = useState<Group | null>(null);

  useEffect(() => {
    if (!groupId) return;
    if (!selectedGroup || selectedGroup.id !== parseInt(groupId)) {
      groupAPI.getGroup(parseInt(groupId)).then(data => {
        setGroup(data);
        setSelectedGroup(data);
        visitGroup(data.id);
      });
    } else {
      setGroup(selectedGroup);
      visitGroup(selectedGroup.id);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId]);

  const groupTabs: TabItem[] = [
    { id: 'characters', label: 'Персонажи', path: 'characters' },
    { id: 'items', label: 'Предметы', path: 'items' },
    { id: 'skills', label: 'Книга способностей', path: 'skills' },
    { id: 'notes', label: 'Заметки', path: 'notes' },
    { id: 'quests', label: 'Квесты', path: 'quests' },
    ...(isGroupAdmin ? [{ id: 'settings', label: 'Настройки', path: 'settings' }] : []),
  ];

  if (!group) return <div>Загрузка...</div>;

  return (
    <PageLayout
      breadcrumbs={[
        { label: 'Группы', path: campaignPath('/groups') },
        { label: group.name },
      ]}
      header={
        <PageHeader
          title={group.name}
          imageUrl={group.icon ?? undefined}
          imageAlt={group.name}
        />
      }
      tabs={groupTabs}
      tabBasePath={campaignPath(`/groups/${groupId}`)}
      tabOrientation={isMobile ? 'bottom' : 'top'}
    >
      <Outlet />
    </PageLayout>
  );
};

export default GroupLayout;
