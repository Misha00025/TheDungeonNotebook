import React from 'react';
import { ActionRow, LinkButton, List, PageHeader, Panel, StatePanel, Statistic } from '@tdn/shared';
import { useWorkspace } from './Workspace';
import { useResource } from './hooks';
import { useCampaignWorkspace } from './Shell';
import Characters from './Characters';
import GMOverviewRoster from './GMOverviewRoster';
import { ApiError } from './Feedback';

const CampaignOverview: React.FC = () => {
  const { path, api, sessionKey, invalidation } = useWorkspace();
  const { campaign, mode } = useCampaignWorkspace();
  const characters = useResource(`${sessionKey}:${campaign.id}:overview-characters:${invalidation}`, () => api.listCharacters(campaign.id));

  return <section><List layout="vertical" stretch>
    <PageHeader title="Обзор кампании" headingLevel={2} subtitle="Состав и инструменты кампании под рукой." />
    <List layout="grid" columns={3} minItemWidth="12rem">
      {characters.data !== undefined || characters.loading
        ? <List layout="vertical" stretch>
          <Statistic label="Персонажи" value={characters.data?.length ?? '…'} busy={characters.loading} />
          {Boolean(characters.error) && <ApiError error={characters.error} onRetry={characters.reload} />}
        </List>
        : characters.error
          ? <ApiError error={characters.error} onRetry={characters.reload} />
          : <StatePanel kind="loading">Загрузка персонажей…</StatePanel>}
      <Panel title="Квесты" />
      <Panel title="Заметки" />
    </List>
    <List layout="grid" columns={2} minItemWidth="18rem">
      <Panel title="Персонажи кампании" headingLevel={3}>
        {mode === 'gm'
          ? characters.data !== undefined && <GMOverviewRoster campaignId={campaign.id} characters={characters.data} resourceKey={`${sessionKey}:${campaign.id}:overview-roster:${invalidation}`} />
          : <Characters compact />}
      </Panel>
      <Panel title="Быстрые действия" headingLevel={3}>
        <List layout="vertical" stretch>
          <ActionRow><LinkButton to={path(`/${campaign.id}/${mode}/characters`)} variant="secondary">К списку персонажей</LinkButton></ActionRow>
          <ActionRow><LinkButton to={path(`/${campaign.id}/gm/templates`)} variant="secondary">Настроить шаблон</LinkButton></ActionRow>
          <ActionRow><LinkButton to={path(`/${campaign.id}/gm/formulas`)} variant="secondary">Настроить формулы</LinkButton></ActionRow>
          <ActionRow><LinkButton to={path(`/${campaign.id}/gm/views`)} variant="secondary">Настроить представления</LinkButton></ActionRow>
        </List>
      </Panel>
    </List>
  </List></section>;
};

export default CampaignOverview;
