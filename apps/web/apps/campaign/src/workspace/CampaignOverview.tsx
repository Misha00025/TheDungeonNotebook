import React from 'react';
import { Link } from 'react-router-dom';
import { useWorkspace } from './Workspace';
import { useResource } from './hooks';
import { useCampaignWorkspace } from './Shell';
import Characters from './Characters';
import styles from './Workspace.module.css';

const CampaignOverview: React.FC = () => {
  const { path, api, sessionKey, invalidation } = useWorkspace();
  const { campaign, mode } = useCampaignWorkspace();
  const characters = useResource(`${sessionKey}:${campaign.id}:overview-characters:${invalidation}`, () => api.listCharacters(campaign.id));
  return <section className={styles.page}>
    <h2>Обзор кампании</h2><p>{campaign.name}</p>
    <p>{characters.loading && !characters.data ? 'Загрузка персонажей…' : Boolean(characters.error) && !characters.data ? 'Количество персонажей недоступно.' : characters.data ? `Персонажей: ${characters.data.length}` : 'Количество персонажей недоступно.'}</p>
    {Boolean(characters.error) && <p role="alert">Не удалось загрузить количество персонажей.</p>}
    <Link to={path(`/${campaign.id}/${mode}/characters`)}>К списку персонажей</Link>
    <Link to={path(`/${campaign.id}/gm/templates`)}>Настроить шаблоны</Link>
    <Link to={path(`/${campaign.id}/gm/formulas`)}>Настроить формулы</Link>
    <Link to={path(`/${campaign.id}/gm/views`)}>Настроить представления</Link>
    <Characters compact />
  </section>;
};
export default CampaignOverview;
