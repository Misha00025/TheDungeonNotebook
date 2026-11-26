import React from 'react';
import { Outlet, useParams } from 'react-router-dom';
import { PageHeader, TabBar } from '@tdn/shared';
import { useWorkspace } from './Workspace';

const CharacterSheetSections: React.FC = () => {
  const { groupId = '' } = useParams();
  const { path } = useWorkspace();

  return <>
    <PageHeader title="Лист персонажа" />
    <TabBar
      basePath={path(`/${groupId}/gm/character-sheet`)}
      aria-label="Разделы листа персонажа"
      tabs={[
        { id: 'templates', label: 'Шаблон', path: 'templates' },
        { id: 'formulas', label: 'Формулы', path: 'formulas' },
        { id: 'views', label: 'Представления', path: 'views' },
      ]}
    />
    <Outlet />
  </>;
};

export default CharacterSheetSections;
