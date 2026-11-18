import React from 'react';
import { Link } from 'react-router-dom';
import List from '@tdn/shared/ui/List/List';
import ListItem from '@tdn/shared/ui/List/ListItem';
import buttonStyles from '@tdn/shared/styles/components/Button.module.css';
import commonStyles from '@tdn/shared/styles/common.module.css';
import { useWorkspace } from '../workspace/Workspace';
import { useResource } from '../workspace/hooks';
import { useVisitHistory } from '../workspace/VisitHistory';
import { ApiError } from '../workspace/Feedback';
import type { Campaign, CharacterMetadata, Permissions } from '../workspace/types';
import type { CharacterVisit } from '../workspace/VisitHistory';
import styles from './Dashboard.module.css';

type CampaignAccess = { campaign: Campaign; permissions: Permissions };
type CharacterAccess = { character: CharacterMetadata; characterPermissions: Permissions; campaign: Campaign; campaignPermissions: Permissions };

const allowed = (permissions: Permissions) => permissions.canRead || permissions.canWrite;
const inaccessible = (error: unknown) => Boolean(error && typeof error === 'object' && 'status' in error && [403, 404].includes(Number(error.status)));

const LastCampaignCard: React.FC<{ campaignId: number | null }> = ({ campaignId }) => {
  const { api, path, sessionKey } = useWorkspace();
  const resource = useResource<CampaignAccess>(`${sessionKey}:home-campaign:${campaignId}`, async () => {
    if (campaignId === null) throw new Error('No campaign visit');
    const [campaign, permissions] = await Promise.all([api.getCampaign(campaignId), api.campaignPermissions(campaignId)]);
    return { campaign, permissions };
  }, campaignId !== null);
  const header = <h2 className={styles.headerTitle}>Последняя кампания</h2>;
  if (campaignId === null) return <section>{header}<List><ListItem><p className={styles.emptyText}>История посещений кампаний пока пуста.</p><Link className={buttonStyles.button} to={path('/')}>Перейти к кампаниям</Link></ListItem></List></section>;
  if (resource.loading) return <section>{header}<p className={styles.loading}>Загрузка кампании…</p></section>;
  if (resource.error) return <section>{header}{inaccessible(resource.error) && <p>Последняя кампания недоступна.</p>}<ApiError error={resource.error} onRetry={resource.reload} /></section>;
  if (!resource.data || !allowed(resource.data.permissions)) return <section>{header}<List><ListItem><p>Последняя кампания недоступна.</p></ListItem></List></section>;
  const destination = resource.data.permissions.canWrite ? 'gm/overview' : 'player/characters';
  return <section>{header}<List><ListItem><h3 className={styles.title}>{resource.data.campaign.name}</h3><Link className={buttonStyles.button} to={path(`/${campaignId}/${destination}`)}>Продолжить кампанию</Link></ListItem></List></section>;
};

const RecentCharacter: React.FC<{ visit: CharacterVisit }> = ({ visit }) => {
  const { api, path, sessionKey } = useWorkspace();
  const resource = useResource<CharacterAccess>(`${sessionKey}:home-character:${visit.groupId}:${visit.characterId.toLowerCase()}`, async () => {
    const [character, characterPermissions, campaign, campaignPermissions] = await Promise.all([
      api.getCharacter(visit.groupId, visit.characterId),
      api.characterPermissions(visit.groupId, visit.characterId),
      api.getCampaign(visit.groupId),
      api.campaignPermissions(visit.groupId)
    ]);
    return { character, characterPermissions, campaign, campaignPermissions };
  });
  const cardKey = `${sessionKey}:${visit.groupId}:${visit.characterId}`;
  if (resource.loading) return <ListItem key={cardKey}><p className={styles.loading}>Загрузка персонажа…</p></ListItem>;
  if (resource.error) return <ListItem key={cardKey}>{inaccessible(resource.error) && <p>Персонаж или кампания недоступны.</p>}<ApiError error={resource.error} onRetry={resource.reload} /></ListItem>;
  if (!resource.data || !allowed(resource.data.characterPermissions) || !allowed(resource.data.campaignPermissions)) return <ListItem key={cardKey}><p>Персонаж или кампания недоступны.</p></ListItem>;
  const mode = resource.data.campaignPermissions.canWrite ? 'gm' : 'player';
  const href = path(`/${visit.groupId}/${mode}/characters/${encodeURIComponent(visit.characterId)}/overview`);
  return <ListItem key={cardKey}><h3 className={styles.title}>{resource.data.character.name}</h3><p className={styles.subtitle}>{resource.data.campaign.name}</p><p className={styles.subtitle}>{resource.data.characterPermissions.canWrite ? 'Можно редактировать' : 'Только просмотр'}</p><Link className={buttonStyles.button} to={href}>Открыть персонажа</Link></ListItem>;
};

const Dashboard: React.FC = () => {
  const { path, sessionKey } = useWorkspace();
  const { lastVisitedGroupId, lastVisitedCharacters } = useVisitHistory();
  const campaignId = lastVisitedGroupId;
  const createHref = `${path('/')}?create=1`;
  return <main className={commonStyles.container}>
    <h1 className={styles.headerTitle}>Главная</h1>
    <div className={styles.grid}>
      <LastCampaignCard key={`${sessionKey}:campaign:${campaignId}`} campaignId={campaignId} />
      <section>
        <h2 className={styles.headerTitle}>Последние персонажи</h2>
        {lastVisitedCharacters.length === 0 ? <List><ListItem><p className={styles.emptyText}>История посещений персонажей пока пуста.</p><Link className={buttonStyles.button} to={path('/')}>Перейти к кампаниям</Link></ListItem></List> : <List>{lastVisitedCharacters.map(visit => <RecentCharacter key={`${sessionKey}:${visit.groupId}:${visit.characterId}`} visit={visit} />)}</List>}
      </section>
    </div>
    <Link className={buttonStyles.button} to={path('/')}>Все кампании</Link>
    <Link className={buttonStyles.button} to={createHref}>Создать кампанию</Link>
  </main>;
};

export default Dashboard;
