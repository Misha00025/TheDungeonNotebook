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
  it('uses only visible current-kind metadata, preserves explicit nested membership, and deduplicates per group', () => {
    const rootEntry = entry('root-entry', 'Root entry');
    const childEntry = entry('child-entry', 'Child entry');
    const ungroupedEntry = entry('ungrouped-entry', 'Ungrouped entry');
    const skill = entry('skill-entry', 'Skill entry', 'Skill');
    const invisible = entry('not-visible', 'Not visible metadata');
    const model = buildCatalogBrowseModel({
      rootCatalog: [rootEntry, childEntry, ungroupedEntry, skill],
      groups: [
        { id: 'root', title: 'Root', parentId: null },
        { id: 'child', title: 'Child', parentId: 'root' },
        { id: 'other', title: 'Other', parentId: null },
      ],
      memberships: [
        { groupId: 'root', entries: [rootEntry, rootEntry, invisible], diagnostics: [] },
        { groupId: 'child', entries: [childEntry], diagnostics: [] },
        { groupId: 'other', entries: [rootEntry], diagnostics: [] },
      ],
      kind: 'Item',
      search: '',
      summariesReady: true,
      membershipsReady: true,
    });
    const root = model.sections.find(section => section.key === 'group:root');
    const other = model.sections.find(section => section.key === 'group:other');

    expect(root?.ownEntries.map(item => item.id)).toEqual(['root-entry']);
    expect(root?.children[0].ownEntries.map(item => item.id)).toEqual(['child-entry']);
    expect(other?.ownEntries.map(item => item.id)).toEqual(['root-entry']);
    expect(model.sections.find(section => section.key === 'ungrouped')?.ownEntries.map(item => item.id)).toEqual(['ungrouped-entry']);
    expect(collectEntries(model.sections).map(item => item.id)).toEqual([
      'root-entry', 'child-entry', 'root-entry', 'ungrouped-entry',
    ]);
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
