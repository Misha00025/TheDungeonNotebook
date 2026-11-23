import type { CatalogGroupEntriesEnvelope, CatalogGroupSummary, CatalogKind, CatalogMetadata } from './catalogTypes';

export type CatalogGroupDiagnostic = CatalogGroupEntriesEnvelope['diagnostics'][number];

export type CatalogMembershipResult = {
  groupId: string;
  entries?: CatalogMetadata[];
  diagnostics?: CatalogGroupDiagnostic[];
  error?: unknown;
  loading?: boolean;
};

export type CatalogBrowseInput = {
  rootCatalog: CatalogMetadata[];
  groups: CatalogGroupSummary[];
  memberships: CatalogMembershipResult[];
  kind: CatalogKind;
  search: string;
  summariesReady: boolean;
  membershipsReady: boolean;
};

export type CatalogBrowseSection = {
  key: string;
  title: string;
  ownEntries: CatalogMetadata[];
  children: CatalogBrowseSection[];
  state: 'loading' | 'ready' | 'error';
  diagnostics: CatalogGroupDiagnostic[];
  error?: unknown;
};

export type CatalogBrowseModel = {
  sections: CatalogBrowseSection[];
  sectionKeys: string[];
  keysToOpenForSearch: string[];
  ungroupedState: 'unavailable' | 'loading' | 'ready';
  ungroupedEntries: CatalogMetadata[];
  noMatches: boolean;
};

const sectionKey = (id: string) => `group:${id}`;

function collectEntryIds(section: CatalogBrowseSection, ids: Set<string>): void {
  section.ownEntries.forEach(entry => ids.add(entry.id));
  section.children.forEach(child => collectEntryIds(child, ids));
}

export function buildCatalogBrowseModel(input: CatalogBrowseInput): CatalogBrowseModel {
  const query = input.search.trim().toLocaleLowerCase();
  const visibleById = new Map(input.rootCatalog.filter(entry => entry.kind === input.kind).map(entry => [entry.id, entry]));
  const membershipById = new Map(input.memberships.map(result => [result.groupId, result]));
  const matching = (entry: CatalogMetadata) => !query || entry.name.toLocaleLowerCase().includes(query);
  const groupChildren = new Map<string | null, CatalogGroupSummary[]>();
  for (const group of input.groups) {
    const parentId = group.parentId && input.groups.some(candidate => candidate.id === group.parentId) ? group.parentId : null;
    groupChildren.set(parentId, [...(groupChildren.get(parentId) ?? []), group]);
  }
  const built = new Map<string, CatalogBrowseSection>();
  const building = new Set<string>();
  const buildGroup = (group: CatalogGroupSummary): CatalogBrowseSection | undefined => {
    if (building.has(group.id)) return undefined;
    const membership = membershipById.get(group.id);
    const membershipEntries = membership?.entries;
    const state: CatalogBrowseSection['state'] = membership?.error ? 'error' : membership?.loading || !membership?.entries ? 'loading' : 'ready';
    let ownEntries = state === 'ready' && membership && membershipEntries
      ? [...new Map(membershipEntries.flatMap(entry => {
        const visible = visibleById.get(entry.id);
        return visible && matching(visible) ? [[visible.id, visible] as const] : [];
      })).values()]
      : [];
    building.add(group.id);
    const children = (groupChildren.get(group.id) ?? []).flatMap(child => {
      const section = buildGroup(child);
      return section ? [section] : [];
    });
    const descendantEntryIds = new Set<string>();
    children.forEach(child => collectEntryIds(child, descendantEntryIds));
    ownEntries = ownEntries.filter(entry => !descendantEntryIds.has(entry.id));
    building.delete(group.id);
    const diagnostics = membership?.diagnostics ?? [];
    if (state === 'ready' && ownEntries.length === 0 && children.length === 0 && diagnostics.length === 0) return undefined;
    const section = {
      key: sectionKey(group.id), title: group.title, ownEntries, children, state,
      diagnostics, error: membership?.error,
    };
    built.set(group.id, section);
    return section;
  };
  const sections = (groupChildren.get(null) ?? []).flatMap(group => {
    const section = buildGroup(group);
    return section ? [section] : [];
  });
  for (const group of input.groups) {
    if (!built.has(group.id) && !building.has(group.id)) {
      const section = buildGroup(group);
      if (section) sections.push(section);
    }
  }

  const allMembershipsKnown = input.summariesReady && input.membershipsReady && input.groups.every(group => {
    const membership = membershipById.get(group.id);
    return membership !== undefined && membership.entries !== undefined && !membership.error && !membership.loading;
  });
  const membershipUnavailable = input.memberships.some(result => Boolean(result.error));
  const ungroupedState: CatalogBrowseModel['ungroupedState'] = allMembershipsKnown
    ? 'ready'
    : !input.summariesReady || membershipUnavailable ? 'unavailable' : 'loading';
  const groupedIds = new Set(input.memberships.flatMap(result => (result.entries ?? []).map(entry => entry.id)));
  const ungroupedEntries = allMembershipsKnown
    ? [...new Map(input.rootCatalog.filter(entry => entry.kind === input.kind && !groupedIds.has(entry.id) && matching(entry)).map(entry => [entry.id, entry])).values()]
    : [];
  const sectionKeys: string[] = [];
  const keysToOpenForSearch: string[] = [];
  const visit = (section: CatalogBrowseSection): boolean => {
    sectionKeys.push(section.key);
    const childMatches: boolean = section.children.map((child): boolean => visit(child)).some(Boolean);
    const ownMatches = query.length > 0 && section.ownEntries.some(matching);
    const needsOpening = ownMatches || childMatches || section.state !== 'ready' || section.diagnostics.length > 0;
    if (query && needsOpening) keysToOpenForSearch.push(section.key);
    return ownMatches || childMatches || section.state !== 'ready' || section.diagnostics.length > 0;
  };
  sections.forEach(visit);
  if (allMembershipsKnown && ungroupedEntries.length > 0) {
    const ungrouped: CatalogBrowseSection = {
      key: 'ungrouped', title: 'Без группы', ownEntries: ungroupedEntries, children: [], state: 'ready', diagnostics: [],
    };
    sections.push(ungrouped);
    sectionKeys.push(ungrouped.key);
    if (query) keysToOpenForSearch.push(ungrouped.key);
  }
  const matchingVisibleEntries = [...visibleById.values()].filter(matching);
  return {
    sections, sectionKeys, keysToOpenForSearch, ungroupedState, ungroupedEntries,
    noMatches: allMembershipsKnown && matchingVisibleEntries.length === 0,
  };
}
