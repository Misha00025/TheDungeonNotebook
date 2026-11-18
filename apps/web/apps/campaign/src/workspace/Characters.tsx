import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ActionRow, Badge, Button, LinkButton, List, PageHeader, Panel, SearchBar, StatePanel, Toolbar } from '@tdn/shared';
import { useWorkspace } from './Workspace';
import { useCampaignWorkspace } from './Shell';
import { useResource } from './hooks';
import type { CharacterMetadata, Permissions } from './types';
import { ApiError } from './Feedback';
import CreateCharacter from './CreateCharacter';

type Access = Permissions | { error: unknown };
const importanceLabel: Record<CharacterMetadata['importance'], string> = { Background: 'Фоновый', Secondary: 'Второстепенный', Key: 'Ключевой' };

const CharacterCard: React.FC<{ character: CharacterMetadata; access: Permissions; href: string; mode: 'gm' | 'player' }> = ({ character, access, href, mode }) => (
  <Panel
    as="article"
    title={character.name}
    headingLevel={mode === 'player' ? 4 : 3}
    description={importanceLabel[character.importance] ?? character.importance}
    status={<Badge>{access.canWrite ? 'Можно вести и редактировать' : 'Только просмотр'}</Badge>}
    actions={<ActionRow justify="end"><LinkButton to={href} variant="secondary" aria-label={`Открыть лист ${character.name}`}>Открыть лист</LinkButton></ActionRow>}
  />
);

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
  const headingId = React.useId();
  if (resource.loading && !resource.data) return <StatePanel kind="loading">Загрузка персонажей…</StatePanel>;
  if (resource.error && !resource.data) return <ApiError error={resource.error} onRetry={resource.reload} />;
  return <section><List layout="vertical" stretch>
    {!compact && <>
      <PageHeader
        title={mode === 'gm' ? 'Персонажи кампании' : 'Мои персонажи'}
        headingLevel={2}
        subtitle="Права на каждого персонажа определяются отдельно."
        actions={mode === 'gm' && permissions.canWrite && !permissionsLoading && !createOpen
          ? <Button type="button" onClick={() => setCreateOpen(true)}>Создать персонажа</Button>
          : undefined}
      />
      <Toolbar>
        <SearchBar searchTerm={search} onSearchChange={setSearch} aria-label="Поиск персонажей" compact />
      </Toolbar>
    </>}
    {resource.loading && <StatePanel kind="loading">Обновление персонажей…</StatePanel>}
    {Boolean(resource.error) && <ApiError error={resource.error} onRetry={resource.reload} />}
    {!resource.data?.length && !resource.loading && !resource.error && <StatePanel kind="empty">{emptyText}</StatePanel>}
    {Boolean(resource.data?.length) && filtered.length === 0 && <StatePanel kind="empty">Совпадений нет.</StatePanel>}
    {filtered.map(character => <PermissionProbe key={`${key}:${character.id}`} character={character} campaignId={campaignId} resourceKey={key} onResult={onResult} />)}
    {mode === 'gm' && <List layout="grid" gridSize="small">
      {groups[0][1].map(item => <CharacterCard key={item.id} character={item} access={accessMap[item.id] as Permissions} href={characterHref(item.id)} mode="gm" />)}
    </List>}
    {mode === 'player' && <List layout="grid" gridSize="large">
      {groups.map(([title, items], index) => {
        const id = `${headingId}-${index}`;
        const emptyLabel = index === 0 ? 'Нет персонажей для ведения.' : 'Нет персонажей только для просмотра.';
        const mayShowEmpty = filtered.length > 0 && settled && failed.length === 0 && !resource.loading && !resource.error && items.length === 0;
        return <section key={title} aria-labelledby={id}>
          <h3 id={id}>{title}</h3>
          <List layout="vertical" stretch>
            {items.map(item => <CharacterCard key={item.id} character={item} access={accessMap[item.id] as Permissions} href={characterHref(item.id)} mode="player" />)}
            {mayShowEmpty && <StatePanel kind="empty">{emptyLabel}</StatePanel>}
          </List>
        </section>;
      })}
    </List>}
    {failed.length > 0 && <StatePanel kind="error">Не удалось загрузить права для {failed.length} персонажей.</StatePanel>}
    {Boolean(resource.data?.length) && filtered.length > 0 && settled && allowed.length === 0 && failed.length === 0 && <StatePanel kind="empty">Нет доступных персонажей.</StatePanel>}
    {mode === 'gm' && !compact && createOpen && <CreateCharacter campaignId={campaignId} onClose={() => setCreateOpen(false)} />}
  </List></section>;
};

const PermissionProbe: React.FC<{ character: CharacterMetadata; campaignId: number; resourceKey: string; onResult: (id: string, result: Access) => void }> = ({ character, campaignId, resourceKey, onResult }) => {
  const { api } = useWorkspace();
  const resource = useResource<Permissions>(`${resourceKey}:${character.id}:permissions`, () => api.characterPermissions(campaignId, character.id));
  useEffect(() => { if (resource.error) onResult(character.id, { error: resource.error }); else if (resource.data) onResult(character.id, resource.data); }, [character.id, resource.error, resource.data, onResult]);
  return resource.loading ? <StatePanel kind="loading">Загрузка прав персонажа «{character.name}»…</StatePanel> : resource.error ? <ApiError error={resource.error} onRetry={resource.reload} /> : null;
};

export default Characters;
