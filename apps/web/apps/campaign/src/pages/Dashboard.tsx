import React from 'react';
import { Link } from 'react-router-dom';
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
  const header = <div className={styles.header}><h2 className={styles.headerTitle}>Последняя группа</h2><p className={styles.headerSubtitle}>Быстрый доступ к последней просмотренной группе</p></div>;
  if (campaignId === null) return <section>{header}<div className={styles.emptyCard}><p className={styles.emptyText}>Посетите группы, чтобы они отображались здесь</p><Link className={buttonStyles.button} to={path('/')}>Перейти к группам</Link></div></section>;
  if (resource.loading) return <section>{header}<p className={styles.loading}>Загрузка группы…</p></section>;
  if (resource.error) return <section>{header}{inaccessible(resource.error) && <p>Последняя группа недоступна.</p>}<ApiError error={resource.error} onRetry={resource.reload} /></section>;
  if (!resource.data || !allowed(resource.data.permissions)) return <section>{header}<div className={styles.emptyCard}><p className={styles.emptyText}>Последняя группа недоступна.</p></div></section>;
  const destination = resource.data.permissions.canWrite ? 'gm/overview' : 'player/characters';
  return <section>{header}<div className={styles.list}><Link aria-label="Продолжить кампанию" className={styles.card} to={path(`/${campaignId}/${destination}`)}><span className={styles.avatarPlaceholder}>G</span><div className={styles.info}><h3 className={styles.title}>{resource.data.campaign.name}</h3></div><span className={`${buttonStyles.button} ${styles.action}`}>→</span></Link></div></section>;
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
  if (resource.loading) return <div key={cardKey}><p className={styles.loading}>Загрузка персонажа…</p></div>;
  if (resource.error) return <div key={cardKey}>{inaccessible(resource.error) && <p>Персонаж или кампания недоступны.</p>}<ApiError error={resource.error} onRetry={resource.reload} /></div>;
  if (!resource.data || !allowed(resource.data.characterPermissions) || !allowed(resource.data.campaignPermissions)) return <div key={cardKey}><p>Персонаж или кампания недоступны.</p></div>;
  const mode = resource.data.campaignPermissions.canWrite ? 'gm' : 'player';
  const href = path(`/${visit.groupId}/${mode}/characters/${encodeURIComponent(visit.characterId)}`);
  return <Link key={cardKey} aria-label={`Открыть персонажа ${resource.data.character.name}`} className={styles.card} to={href}><span className={styles.avatarPlaceholder}>C</span><div className={styles.info}><h3 className={styles.title}>{resource.data.character.name}</h3><p className={styles.subtitle}>{resource.data.campaign.name}</p></div><span className={`${buttonStyles.button} ${styles.action}`}>→</span></Link>;
};

const Dashboard: React.FC = () => {
  const { path, sessionKey } = useWorkspace();
  const { lastVisitedGroupId, lastVisitedCharacters } = useVisitHistory();
  const campaignId = lastVisitedGroupId;
  return <div className={commonStyles.container}>
    <div className={styles.grid}>
      <LastCampaignCard key={`${sessionKey}:campaign:${campaignId}`} campaignId={campaignId} />
      <section>
        <div className={styles.header}><h2 className={styles.headerTitle}>Последние персонажи</h2><p className={styles.headerSubtitle}>Быстрый доступ к последним просмотренным персонажам</p></div>
        {lastVisitedCharacters.length === 0 ? <div className={styles.emptyCard}><p className={styles.emptyText}>Посетите персонажа, чтобы они отображались здесь</p><Link className={buttonStyles.button} to={path('/')}>Перейти к группам</Link></div> : <div className={styles.list}>{lastVisitedCharacters.map(visit => <RecentCharacter key={`${sessionKey}:${visit.groupId}:${visit.characterId}`} visit={visit} />)}</div>}
      </section>
    </div>
  </div>;
};

export default Dashboard;
