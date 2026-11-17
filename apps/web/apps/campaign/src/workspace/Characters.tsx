import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useWorkspace } from './Workspace';
import { useCampaignWorkspace } from './Shell';
import { useResource } from './hooks';
import type { CharacterMetadata, Permissions } from './types';
import { ApiError } from './Feedback';
import CreateCharacter from './CreateCharacter';
import buttonStyles from '@tdn/shared/styles/components/Button.module.css';
import commonStyles from '@tdn/shared/styles/common.module.css';
import inputStyles from '@tdn/shared/styles/components/Input.module.css';
import styles from './Workspace.module.css';

type Access = Permissions | { error: unknown };
const importanceLabel: Record<CharacterMetadata['importance'], string> = { Background: 'Фоновый', Secondary: 'Второстепенный', Key: 'Ключевой' };
const CharacterCard: React.FC<{ character: CharacterMetadata; access: Permissions; href: string }> = ({ character, access, href }) => <article className={commonStyles.card}>
  <h3><Link to={href}>{character.name}</Link></h3><p>{importanceLabel[character.importance] ?? character.importance}</p>
  <p>{access.canWrite ? 'Можно вести и редактировать' : 'Только просмотр'}</p>
</article>;
const Characters: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const { groupId = '' } = useParams();
  const campaignId = Number(groupId);
  const { api, path, sessionKey, invalidation } = useWorkspace();
  const { campaign, mode, permissions, permissionsLoading } = useCampaignWorkspace();
  const key = `${sessionKey}:${campaign.id}:characters:${invalidation}`;
  const resource = useResource<CharacterMetadata[]>(key, () => api.listCharacters(campaignId));
  const [accesses, setAccesses] = useState<{ key: string; values: Record<string, Access> }>({ key, values: {} });
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const accessMap = accesses.key === key ? accesses.values : {};
  const onResult = useCallback((id: string, result: Access) => setAccesses(current => current.key === key ? { key, values: { ...current.values, [id]: result } } : { key, values: { [id]: result } }), [key]);
  const filtered = useMemo(() => (resource.data ?? []).filter(item => item.name.toLocaleLowerCase().includes(search.toLocaleLowerCase())), [resource.data, search]);
  const allowed = filtered.filter(item => { const access = accessMap[item.id]; return access && !('error' in access) && (access.canRead || access.canWrite); });
  const failed = filtered.filter(item => { const access = accessMap[item.id]; return access && 'error' in access; });
  const settled = filtered.every(item => Boolean(accessMap[item.id]));
  const groups = mode === 'player' ? [
    ['Могу вести', allowed.filter(item => { const access = accessMap[item.id]; return access && !('error' in access) && access.canWrite; })],
    ['Могу просматривать', allowed.filter(item => { const access = accessMap[item.id]; return access && !('error' in access) && !access.canWrite; })]
  ] as const : [['Персонажи', allowed]] as const;
  const emptyText = search ? 'Совпадений нет.' : 'Персонажей пока нет.';
  const characterHref = (id: string) => path(`/${campaignId}/${mode}/characters/${encodeURIComponent(id)}/overview`);
  if (resource.loading && !resource.data) return <p>Загрузка персонажей…</p>;
  if (resource.error && !resource.data) return <ApiError error={resource.error} onRetry={resource.reload} />;
  return <section className={styles.page}>
    {!compact && <><h2>{mode === 'gm' ? 'Персонажи кампании' : 'Мои персонажи'}</h2><label>Поиск персонажей<input className={inputStyles.input} value={search} onChange={event => setSearch(event.target.value)} /></label>{mode === 'gm' && permissions.canWrite && !permissionsLoading && !createOpen && <button className={buttonStyles.button} type="button" onClick={() => setCreateOpen(true)}>Создать персонажа</button>}</>}
    {resource.loading && <p>Обновление персонажей…</p>}{Boolean(resource.error) && <ApiError error={resource.error} onRetry={resource.reload} />}
    {!resource.data?.length && !resource.loading && !resource.error && <p>{emptyText}</p>}
    {Boolean(resource.data?.length) && filtered.length === 0 && <p>Совпадений нет.</p>}
    {filtered.map(character => <PermissionProbe key={`${key}:${character.id}`} character={character} campaignId={campaignId} resourceKey={key} onResult={onResult} />)}
    {groups.map(([title, items]) => <section key={title}><h3>{title}</h3><div className={styles.grid}>{items.map(item => <CharacterCard key={item.id} character={item} access={accessMap[item.id] as Permissions} href={characterHref(item.id)} />)}</div></section>)}
    {failed.length > 0 && <p role="alert">Не удалось загрузить права для {failed.length} персонажей.</p>}
    {Boolean(resource.data?.length) && filtered.length > 0 && settled && allowed.length === 0 && failed.length === 0 && <p>Нет доступных персонажей.</p>}
    {mode === 'gm' && !compact && createOpen && <CreateCharacter campaignId={campaignId} onClose={() => setCreateOpen(false)} />}
  </section>;
};
const PermissionProbe: React.FC<{ character: CharacterMetadata; campaignId: number; resourceKey: string; onResult: (id: string, result: Access) => void }> = ({ character, campaignId, resourceKey, onResult }) => {
  const { api } = useWorkspace();
  const resource = useResource<Permissions>(`${resourceKey}:${character.id}:permissions`, () => api.characterPermissions(campaignId, character.id));
  useEffect(() => { if (resource.error) onResult(character.id, { error: resource.error }); else if (resource.data) onResult(character.id, resource.data); }, [character.id, resource.error, resource.data, onResult]);
  return resource.loading ? <p>Загрузка прав персонажа «{character.name}»…</p> : resource.error ? <ApiError error={resource.error} onRetry={resource.reload} /> : null;
};
export default Characters;
