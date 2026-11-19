import React from 'react';
import { Badge, LinkButton, List, ListItem, StatePanel } from '@tdn/shared';
import { useWorkspace } from './Workspace';
import { useResource } from './hooks';
import type { Assignment, CharacterMetadata, Permissions, User } from './types';
import { ApiError } from './Feedback';
import styles from './GMOverviewRoster.module.css';

type RosterRow = { character: CharacterMetadata; names: string[] };
type RosterData = { rows: RosterRow[]; errors: unknown[]; unavailable: boolean };

async function loadRoster(api: ReturnType<typeof useWorkspace>['api'], campaignId: number, characters: CharacterMetadata[]): Promise<RosterData> {
  const profiles = new Map<number, Promise<User>>();
  const rows: Array<RosterRow | undefined> = new Array(characters.length);
  const errors: unknown[] = [];
  let unavailable = false;

  await Promise.all(characters.map(async (character, index) => {
    let permissions: Permissions;
    try {
      permissions = await api.characterPermissions(campaignId, character.id);
    } catch (error) {
      errors.push(error);
      return;
    }
    if (!permissions.canRead && !permissions.canWrite) return;
    if (!permissions.canManageAccess) {
      unavailable = true;
      return;
    }

    let assignments: Assignment[];
    try {
      assignments = await api.listAssignments(campaignId, character.id);
    } catch (error) {
      errors.push(error);
      return;
    }

    const writers = assignments.filter(assignment => assignment.canWrite === true);
    if (!writers.length) return;
    const names = await Promise.all(writers.map(async assignment => {
      if (!profiles.has(assignment.userId)) profiles.set(assignment.userId, api.getUser(assignment.userId));
      try {
        const user = await profiles.get(assignment.userId)!;
        return user.visibleName?.trim() || user.nickname?.trim() || 'Профиль недоступен';
      } catch {
        return 'Профиль недоступен';
      }
    }));
    rows[index] = { character, names };
  }));

  return { rows: rows.filter((row): row is RosterRow => row !== undefined), errors, unavailable };
}

const GMOverviewRoster: React.FC<{ campaignId: number; characters: CharacterMetadata[]; resourceKey: string }> = ({ campaignId, characters, resourceKey }) => {
  const { api, path } = useWorkspace();
  const roster = useResource<RosterData>(resourceKey, () => loadRoster(api, campaignId, characters));

  if (roster.loading && !roster.data) return <p>Загрузка списка ведущих…</p>;
  if (roster.error && !roster.data) return <ApiError error={roster.error} onRetry={roster.reload} />;

  const data = roster.data;
  if (!data) return null;
  return <List layout="vertical" stretch gap="small">
    {roster.loading && <p>Обновление списка ведущих…</p>}
    {Boolean(roster.error) && <ApiError error={roster.error} onRetry={roster.reload} />}
    {data.errors.map((error, index) => <ApiError key={index} error={error} onRetry={roster.reload} />)}
    {data.unavailable && <p>Сведения о ведущих недоступны.</p>}
    {!data.rows.length && !data.errors.length && !data.unavailable && !roster.error && !roster.loading && <StatePanel kind="empty">Нет персонажей с назначенными ведущими.</StatePanel>}
    {data.rows.map(({ character, names }) => <ListItem key={character.id} density="compact">
      <div className={styles.row}>
        <div className={styles.identity}>
          <strong>{character.name}</strong>
          {names.map((name, index) => <Badge key={index}>{name}</Badge>)}
        </div>
        <LinkButton size="small" variant="secondary" to={path(`/${campaignId}/gm/characters/${encodeURIComponent(character.id)}/overview`)} aria-label={`Открыть лист ${character.name}`}>Открыть</LinkButton>
      </div>
    </ListItem>)}
  </List>;
};

export default GMOverviewRoster;
