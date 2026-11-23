import type { CatalogGroup, CatalogGroupCondition, CatalogGroupConfigurationEnvelope, CatalogGroupInput } from './catalogTypes';
import { stringifyJson } from './json';

export type CatalogGroupDraftRow = {
  clientKey: string;
  id?: string;
  title: string;
  parentKey: string | null;
  entryIds: string[];
  condition: CatalogGroupCondition | null;
};

export type CatalogGroupSaveStage = {
  kind: 'intermediate' | 'final';
  groups: CatalogGroupInput[];
  clientKeys: string[];
  containsNewGroups: boolean;
};

export type CatalogGroupStagePlan = { stage: CatalogGroupSaveStage } | { error: string };

const groupClientKey = (id: string) => `group-${id}`;
const missingParentKey = (id: string) => `missing-parent:${id}`;

export function rowsFromConfiguration(groups: CatalogGroup[]): CatalogGroupDraftRow[] {
  const keyById = new Map(groups.map(group => [group.id, groupClientKey(group.id)]));
  return groups.map(group => ({
    clientKey: groupClientKey(group.id),
    id: group.id,
    title: group.title,
    parentKey: group.parentId === null ? null : keyById.get(group.parentId) ?? missingParentKey(group.parentId),
    entryIds: [...group.entryIds],
    condition: group.condition,
  }));
}

export function createGroupDraftRow(parentKey: string | null = null): CatalogGroupDraftRow {
  return {
    clientKey: `new:${crypto.randomUUID()}`,
    title: '',
    parentKey,
    entryIds: [],
    condition: null,
  };
}

function draftSnapshot(rows: CatalogGroupDraftRow[]) {
  const byKey = new Map(rows.map(row => [row.clientKey, row]));
  return rows.map(row => {
    const parent = row.parentKey ? byKey.get(row.parentKey) : undefined;
    return {
      identity: row.id ? `id:${row.id}` : `new:${row.clientKey}`,
      title: row.title,
      parent: row.parentKey === null
        ? null
        : parent?.id
          ? `id:${parent.id}`
          : parent
            ? `new:${parent.clientKey}`
            : `missing:${row.parentKey}`,
      entryIds: row.entryIds,
      condition: row.condition,
    };
  });
}

export function groupDraftIsDirty(rows: CatalogGroupDraftRow[], baseline?: CatalogGroupConfigurationEnvelope) {
  if (!baseline) return false;
  return stringifyJson(draftSnapshot(rows)) !== stringifyJson(draftSnapshot(rowsFromConfiguration(baseline.data.groups)));
}

export function groupDraftHierarchyError(rows: CatalogGroupDraftRow[]): string | undefined {
  const byKey = new Map(rows.map(row => [row.clientKey, row]));
  for (const row of rows) {
    if (row.parentKey !== null && !byKey.has(row.parentKey)) return 'Выберите существующую родительскую группу или корень.';
    if (row.parentKey === row.clientKey) return 'Группа не может быть родителем самой себя.';
    const path = new Set<string>();
    let current: CatalogGroupDraftRow | undefined = row;
    while (current) {
      if (current.parentKey === null) break;
      if (path.has(current.clientKey)) return 'Иерархия групп не может содержать циклы.';
      path.add(current.clientKey);
      current = byKey.get(current.parentKey);
    }
  }
  return undefined;
}

export function planGroupSaveStage(
  rows: CatalogGroupDraftRow[],
  confirmedGroups: CatalogGroup[],
): CatalogGroupStagePlan {
  const hierarchyError = groupDraftHierarchyError(rows);
  if (hierarchyError) return { error: hierarchyError };

  const byKey = new Map(rows.map(row => [row.clientKey, row]));
  const confirmedIds = new Set(confirmedGroups.map(group => group.id));
  if (rows.some(row => row.id && !confirmedIds.has(row.id))) {
    return { error: 'Группа больше не входит в подтверждённую конфигурацию.' };
  }

  const unresolvedParent = rows.some(row => {
    if (row.parentKey === null) return false;
    const parent = byKey.get(row.parentKey);
    return !parent?.id || !confirmedIds.has(parent.id);
  });
  const newRows = rows.filter(row => !row.id);
  const readyNewRows = newRows.filter(row => {
    if (row.parentKey === null) return true;
    const parent = byKey.get(row.parentKey);
    return Boolean(parent?.id && confirmedIds.has(parent.id));
  });

  if (!unresolvedParent && readyNewRows.length === newRows.length) {
    const groups = rows.map(row => {
      const parent = row.parentKey === null ? undefined : byKey.get(row.parentKey);
      return {
        ...(row.id ? { id: row.id } : {}),
        title: row.title,
        parentId: parent?.id ?? null,
        entryIds: [...row.entryIds],
        condition: row.condition,
      };
    });
    return {
      stage: {
        kind: 'final',
        groups,
        clientKeys: rows.map(row => row.clientKey),
        containsNewGroups: groups.some(group => !group.id),
      },
    };
  }

  if (readyNewRows.length === 0) return { error: 'Проверьте вложенность групп: родительская группа недоступна.' };

  const groups: CatalogGroupInput[] = confirmedGroups.map(group => ({
    id: group.id,
    title: group.title,
    parentId: group.parentId,
    entryIds: [...group.entryIds],
    condition: group.condition,
  }));
  const clientKeys = confirmedGroups.map(group => groupClientKey(group.id));
  for (const row of readyNewRows) {
    const parent = row.parentKey === null ? undefined : byKey.get(row.parentKey);
    groups.push({
      title: row.title,
      parentId: parent?.id ?? null,
      entryIds: [...row.entryIds],
      condition: row.condition,
    });
    clientKeys.push(row.clientKey);
  }

  return {
    stage: {
      kind: 'intermediate',
      groups,
      clientKeys,
      containsNewGroups: readyNewRows.length > 0,
    },
  };
}

export function assignConfirmedIds(
  rows: CatalogGroupDraftRow[],
  submittedClientKeys: string[],
  acceptedGroups: CatalogGroup[],
): CatalogGroupDraftRow[] {
  const idsByClientKey = new Map(submittedClientKeys.flatMap((clientKey, index) => {
    const group = acceptedGroups[index];
    return group ? [[clientKey, group.id] as const] : [];
  }));
  return rows.map(row => {
    const id = idsByClientKey.get(row.clientKey);
    return id ? { ...row, id } : row;
  });
}

export function rowsFromAcceptedGroups(
  groups: CatalogGroup[],
  submittedClientKeys: string[],
): CatalogGroupDraftRow[] {
  const keyById = new Map(groups.map((group, index) => [group.id, submittedClientKeys[index] ?? groupClientKey(group.id)]));
  return groups.map((group, index) => ({
    clientKey: submittedClientKeys[index] ?? groupClientKey(group.id),
    id: group.id,
    title: group.title,
    parentKey: group.parentId === null ? null : keyById.get(group.parentId) ?? missingParentKey(group.parentId),
    entryIds: [...group.entryIds],
    condition: group.condition,
  }));
}
