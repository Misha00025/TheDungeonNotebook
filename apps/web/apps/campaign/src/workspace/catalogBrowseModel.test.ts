import { describe, expect, it } from 'vitest';
import { buildCatalogBrowseModel } from './catalogBrowseModel';
import type { CatalogMetadata } from './catalogTypes';

const entry = (id: string, name = id, kind: CatalogMetadata['kind'] = 'Item'): CatalogMetadata => ({
  id,
  campaignId: 12,
  name,
  kind,
  creatorUserId: null,
  isHidden: false,
  quantityUnit: kind === 'Item' ? 'Whole' : null,
  allowNegative: false,
  metadataRevision: 1,
});

const collectEntries = (sections: ReturnType<typeof buildCatalogBrowseModel>['sections']): CatalogMetadata[] => sections.flatMap(section => [
  ...section.ownEntries,
  ...collectEntries(section.children),
]);

describe('catalog browse model', () => {
  it('shows repeated membership only at the deepest level within a branch', () => {
    const repeatedEntry = entry('repeated', 'Repeated entry');
    const rootEntry = entry('root-entry', 'Root entry');
    const childEntry = entry('child-entry', 'Child entry');
    const ungroupedEntry = entry('ungrouped-entry', 'Ungrouped entry');
    const skill = entry('skill-entry', 'Skill entry', 'Skill');
    const invisible = entry('not-visible', 'Not visible metadata');
    const model = buildCatalogBrowseModel({
      rootCatalog: [repeatedEntry, rootEntry, childEntry, ungroupedEntry, skill],
      groups: [
        { id: 'root', title: 'Root', parentId: null },
        { id: 'child', title: 'Child', parentId: 'root' },
        { id: 'grandchild', title: 'Grandchild', parentId: 'child' },
        { id: 'sibling', title: 'Sibling', parentId: 'root' },
        { id: 'independent', title: 'Independent', parentId: null },
      ],
      memberships: [
        { groupId: 'root', entries: [repeatedEntry, rootEntry, invisible, skill], diagnostics: [] },
        { groupId: 'child', entries: [repeatedEntry, childEntry], diagnostics: [] },
        { groupId: 'grandchild', entries: [repeatedEntry], diagnostics: [] },
        { groupId: 'sibling', entries: [repeatedEntry], diagnostics: [] },
        { groupId: 'independent', entries: [repeatedEntry], diagnostics: [] },
      ],
      kind: 'Item',
      search: '',
      summariesReady: true,
      membershipsReady: true,
    });
    const root = model.sections.find(section => section.key === 'group:root');
    const sibling = root?.children.find(section => section.key === 'group:sibling');
    const independent = model.sections.find(section => section.key === 'group:independent');

    expect(root?.ownEntries.map(item => item.id)).toEqual(['root-entry']);
    expect(root?.children.find(section => section.key === 'group:child')?.ownEntries.map(item => item.id)).toEqual(['child-entry']);
    expect(root?.children.find(section => section.key === 'group:child')?.children[0].ownEntries.map(item => item.id)).toEqual(['repeated']);
    expect(sibling?.ownEntries.map(item => item.id)).toEqual(['repeated']);
    expect(independent?.ownEntries.map(item => item.id)).toEqual(['repeated']);
    expect(model.sections.find(section => section.key === 'ungrouped')?.ownEntries.map(item => item.id)).toEqual(['ungrouped-entry']);
    expect(collectEntries(model.sections).map(item => item.id)).toEqual([
      'root-entry', 'child-entry', 'repeated', 'repeated', 'repeated', 'ungrouped-entry',
    ]);
  });

  it('keeps confirmed parent entries while child memberships are loading or unavailable', () => {
    const erroredEntry = entry('errored-parent-entry');
    const loadingEntry = entry('loading-parent-entry');
    const model = buildCatalogBrowseModel({
      rootCatalog: [erroredEntry, loadingEntry],
      groups: [
        { id: 'error-parent', title: 'Error parent', parentId: null },
        { id: 'error-child', title: 'Error child', parentId: 'error-parent' },
        { id: 'loading-parent', title: 'Loading parent', parentId: null },
        { id: 'loading-child', title: 'Loading child', parentId: 'loading-parent' },
      ],
      memberships: [
        { groupId: 'error-parent', entries: [erroredEntry], diagnostics: [] },
        { groupId: 'error-child', error: new Error('private error payload') },
        { groupId: 'loading-parent', entries: [loadingEntry], diagnostics: [] },
        { groupId: 'loading-child', loading: true },
      ],
      kind: 'Item',
      search: '',
      summariesReady: true,
      membershipsReady: false,
    });

    expect(model.sections.find(section => section.key === 'group:error-parent')?.ownEntries.map(item => item.id)).toEqual([erroredEntry.id]);
    expect(model.sections.find(section => section.key === 'group:loading-parent')?.ownEntries.map(item => item.id)).toEqual([loadingEntry.id]);
    expect(model.ungroupedEntries).toEqual([]);
    expect(model.sections.some(section => section.key === 'ungrouped')).toBe(false);
  });

  it('retains empty diagnostic sections and does not claim no matches while membership is erroneous', () => {
    const model = buildCatalogBrowseModel({
      rootCatalog: [],
      groups: [
        { id: 'diagnostic', title: 'Diagnostic group', parentId: null },
        { id: 'failed', title: 'Failed group', parentId: null },
      ],
      memberships: [
        { groupId: 'diagnostic', entries: [], diagnostics: [{ groupId: 'diagnostic', entryId: null, code: 'invalid_condition' }] },
        { groupId: 'failed', error: new Error('private error payload') },
      ],
      kind: 'Item',
      search: 'missing',
      summariesReady: true,
      membershipsReady: true,
    });

    expect(model.sections.map(section => [section.key, section.state])).toEqual([
      ['group:diagnostic', 'ready'],
      ['group:failed', 'error'],
    ]);
    expect(model.sections[0].diagnostics).toHaveLength(1);
    expect(model.keysToOpenForSearch).toEqual(['group:diagnostic', 'group:failed']);
    expect(model.ungroupedState).toBe('unavailable');
    expect(model.noMatches).toBe(false);
  });
});
