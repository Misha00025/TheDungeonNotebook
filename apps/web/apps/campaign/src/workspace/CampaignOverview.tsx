import React from 'react';
import { ActionRow, LinkButton, List, PageHeader, Panel, StatePanel } from '@tdn/shared';
import { useWorkspace } from './Workspace';
import { useResource } from './hooks';
import { useCampaignWorkspace } from './Shell';
import Characters from './Characters';
import { ApiError } from './Feedback';

const CampaignOverview: React.FC = () => {
  const { path, api, sessionKey, invalidation } = useWorkspace();
  const { campaign, mode } = useCampaignWorkspace();
  const characters = useResource(`${sessionKey}:${campaign.id}:overview-characters:${invalidation}`, () => api.listCharacters(campaign.id));
  const formulas = useResource(`${sessionKey}:${campaign.id}:overview-formulas:${invalidation}`, () => api.listFormulas(campaign.id));
  const views = useResource(`${sessionKey}:${campaign.id}:overview-views:${invalidation}`, () => api.listViews(campaign.id));

  return <section><List layout="vertical" stretch>
    <PageHeader title="Обзор кампании" headingLevel={2} subtitle="Состав и инструменты кампании под рукой." />
    <List layout="grid" columns={3} minItemWidth="12rem">
      <Panel as="article" title="Персонажи" headingLevel={3}>
        {characters.data && <p>Персонажей: {characters.data.length}</p>}
        {characters.loading && !characters.data && <StatePanel kind="loading">Загрузка персонажей…</StatePanel>}
        {Boolean(characters.error) && <ApiError error={characters.error} onRetry={characters.reload} />}
      </Panel>
      <Panel as="article" title="Формулы" headingLevel={3}>
        {formulas.data && <p>Формул: {formulas.data.length}</p>}
        {formulas.loading && !formulas.data && <StatePanel kind="loading">Загрузка формул…</StatePanel>}
        {Boolean(formulas.error) && <ApiError error={formulas.error} onRetry={formulas.reload} />}
      </Panel>
      <Panel as="article" title="Представления" headingLevel={3}>
        {views.data && <p>Представлений: {views.data.length}</p>}
        {views.loading && !views.data && <StatePanel kind="loading">Загрузка представлений…</StatePanel>}
        {Boolean(views.error) && <ApiError error={views.error} onRetry={views.reload} />}
      </Panel>
    </List>
    <List layout="grid" columns={2} minItemWidth="18rem">
      <Panel title="Персонажи кампании" headingLevel={3}>
        <Characters compact />
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
