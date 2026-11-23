import { describe, expect, it } from 'vitest';
import { isLosslessNumber } from 'lossless-json';
import type { JsonValue, LayoutNode, Presentation, ViewNode, WidgetNode, WidgetSource } from './types';
import { parseJson, stringifyJson } from './json';
import {
  addPageKey,
  duplicateNode,
  findNode,
  insertNode,
  isPageKey,
  localDraftKey,
  makeNode,
  moveNode,
  moveSibling,
  normalizeRoots,
  parseDraft,
  patchNodeParams,
  readLocalDraft,
  readParams,
  readPages,
  removeTreeNode,
  stringifyDraft,
  updateNode,
  writeLocalDraft,
  writePages,
  readSurfaceAssignment,
  readViewSurface,
  surfaceContextKeys,
  writeSurfaceAssignments,
  writeViewSurface,
  type LocalDraft,
  type LocalDraftScope,
  type PresentationNode,
  type PresentationPage,
} from './presentationModel';

function object(value: JsonValue): Record<string, JsonValue> {
  if (value === null || typeof value !== 'object' || Array.isArray(value) || isLosslessNumber(value)) throw new Error('Expected an object');
  return value;
}

function lossless(text: string) {
  const value = parseJson(text);
  if (!isLosslessNumber(value)) throw new Error('Expected a lossless number');
  return value;
}

function layout(nodeKey: string, params: JsonValue = null, children: ViewNode[] = []): LayoutNode {
  return { kind: 'layout', nodeKey, title: nodeKey, params, children };
}

function widget(nodeKey: string, format: string, sources: WidgetSource[] = [], params: JsonValue = null, children: ViewNode[] = []): WidgetNode {
  return { kind: 'widget', nodeKey, title: nodeKey, params, sources, format, children };
}

function keys(roots: PresentationNode[]): string[] {
  return roots.flatMap(node => [node.nodeKey, ...keys(node.children)]);
}
function nodes(roots: PresentationNode[]): PresentationNode[] {
  return roots.flatMap(node => [node, ...nodes(node.children)]);
}

const baseSource: WidgetSource = { kind: 'Base', fieldId: 'base-id' };
const virtualSource: WidgetSource = { kind: 'Virtual', fieldId: 'virtual-id' };

describe('presentation model normalization', () => {
  it('normalizes nested widgets losslessly and parses the supported legacy format tokens', () => {
    const large = lossless('9223372036854775807');
    const widgetParams = parseJson('{"opaque":{"number":9007199254740993},"enabled":false}') as JsonValue;
    const roots: ViewNode[] = [layout('layout-root', { untouched: large }, [
      widget('widget-root', 'HP: $1 / ${2:s} $$', [baseSource, virtualSource], widgetParams, [
        layout('nested-layout', parseJson('{"precision":0.1234567890123456789}'), [widget('nested-widget', '', [], [false, large])]),
      ]),
    ])];
    const before = stringifyJson(roots);

    const normalized = normalizeRoots(roots);
    const normalizedRoot = normalized[0]!;

    expect(stringifyJson(roots)).toBe(before);
    expect(normalized).toHaveLength(1);
    expect(normalizedRoot).toMatchObject({ kind: 'layout', nodeKey: 'layout-root', title: 'layout-root' });
    expect(object(normalizedRoot.params).untouched).toBe(large);
    const converted = normalizedRoot.children[0]!;
    expect(converted.kind).toBe('layout');
    expect(converted.nodeKey).toBe('widget-root');
    const convertedParams = object(converted.params);
    expect(convertedParams.type).toBe('composite');
    expect(convertedParams.primary).toBeNull();
    expect(convertedParams.parts).toEqual([
      { text: 'HP: ' },
      { source: { kind: 'Base', fieldId: 'base-id' } },
      { text: ' / ' },
      { source: { kind: 'Virtual', fieldId: 'virtual-id' }, signed: true },
      { text: ' $' },
    ]);
    expect(object(convertedParams.legacyWidget as JsonValue)).toEqual({ params: widgetParams, sources: [baseSource, virtualSource], format: 'HP: $1 / ${2:s} $$' });
    const nested = converted.children[0]!;
    expect(nested).toMatchObject({ kind: 'layout', nodeKey: 'nested-layout' });
    const nestedWidget = nested.children[0]!;
    expect(object(nestedWidget.params)).toMatchObject({ parts: [], primary: null, legacyWidget: { format: '' } });
    expect(object(object(nestedWidget.params).legacyWidget as JsonValue).params).toEqual([false, large]);
    expect(keys(normalized)).toEqual(['layout-root', 'widget-root', 'nested-layout', 'nested-widget']);
    expect(nodes(normalized).every(node => node.kind === 'layout')).toBe(true);
    const retainedWidgetParams = object(object(convertedParams.legacyWidget as JsonValue).params as JsonValue);
    expect(isLosslessNumber(object(retainedWidgetParams.opaque).number)).toBe(true);
    expect(stringifyJson(convertedParams)).toContain('9007199254740993');
  });

  it('preserves opaque scalar and array widget params and keeps invalid format source material diagnostic', () => {
    const large = lossless('9007199254740993');
    const scalarWidget = widget('scalar', '', [baseSource], large);
    const invalidWidget = widget('invalid', '$1 / ${2:format}', [baseSource, virtualSource], false, [layout('child')]);
    const normalized = normalizeRoots([scalarWidget, invalidWidget]);
    const scalarParams = object(normalized[0]!.params);
    expect(scalarParams.legacyParams).toBe(large);
    expect(object(scalarParams.legacyWidget as JsonValue).params).toBe(large);
    expect(scalarParams.parts).toEqual([]);
    expect(scalarParams.legacyFormatError).toBeUndefined();
    expect(object(normalized[1]!.params).legacyParams).toBe(false);
    expect(object(object(normalized[1]!.params).legacyWidget as JsonValue)).toEqual({ params: false, sources: [baseSource, virtualSource], format: '$1 / ${2:format}' });
    expect(object(normalized[1]!.params).parts).toEqual([]);
    expect(readParams(normalized[1]!.params).status).toBe('invalid');
    expect(normalized[1]!.children[0]!.nodeKey).toBe('child');
    expect(keys(normalizeRoots([invalidWidget]))).toContain('invalid');
    const missingSource = normalizeRoots([widget('missing', '$2', [baseSource])])[0]!;
    expect(readParams(missingSource.params).status).toBe('invalid');
    expect(object(object(missingSource.params).legacyWidget as JsonValue).format).toBe('$2');
  });

  it('reads typeless scalar, array, and object params as a default group without modifying them', () => {
    const cases: JsonValue[] = [null, 0, false, 'legacy', [false, lossless('9223372036854775807')], { direction: 'row', columns: 0, opaque: lossless('9007199254740993') }];
    for (const params of cases) {
      const original = stringifyJson(params);
      const read = readParams(params);
      expect(read.status).toBe('supported');
      if (read.status !== 'supported') continue;
      expect(read.type).toBe('group');
      expect(read.params).toMatchObject({ version: 1, type: 'group', columns: 1, gap: 'medium', appearance: 'plain' });
      expect(read.params.direction).toBe(isLosslessNumber(params) ? 'column' : objectOrNullField(params, 'direction') === 'row' ? 'row' : 'column');
      expect(stringifyJson(params)).toBe(original);
    }
    const scalar = lossless('9223372036854775807');
    const node = normalizeRoots([layout('legacy-scalar', scalar) as ViewNode])[0];
    expect(node.params).toBe(scalar);
  });

  it('reads invisible appearance for explicit and typeless groups and preserves it through JSON round-trip', () => {
    const params = { ...object(makeNode('group').params), appearance: 'invisible' } as JsonValue;
    const read = readParams(parseJson(stringifyJson(params)));
    expect(read.status).toBe('supported');
    if (read.status === 'supported') expect(read.params.appearance).toBe('invisible');

    const typeless = readParams(parseJson('{"appearance":"invisible"}'));
    expect(typeless.status).toBe('supported');
    if (typeless.status === 'supported') expect(typeless.params.appearance).toBe('invisible');
  });

  it('reports unsupported and invalid explicit params while retaining their exact JSON', () => {
    const unknown = parseJson('{"version":9,"type":"inventory","extension":{"amount":9223372036854775807}}');
    const unsupported = readParams(unknown);
    expect(unsupported.status).toBe('unsupported');
    expect(unsupported.params).toBe(unknown);
    expect(stringifyJson(unsupported.params)).toContain('9223372036854775807');

    const malformed = parseJson('{"version":1,"type":"composite","parts":[{"source":{"kind":"Base","fieldId":"f"},"signed":"yes"}],"primary":null,"opaque":false}');
    const invalid = readParams(malformed);
    expect(invalid.status).toBe('invalid');
    expect(invalid.params).toBe(malformed);
    expect(object(invalid.params).opaque).toBe(false);
  });

  it('round-trips resource and composite sizes, defaults missing size to large, and preserves opaque lossless params', () => {
    const opaque = lossless('9007199254740993');
    for (const type of ['resource', 'composite'] as const) {
      for (const size of ['compact', 'medium', 'large'] as const) {
        const node = makeNode(type);
        const params = { ...object(node.params), size, opaque } as JsonValue;
        const read = readParams(params);
        if (read.status !== 'supported' || (read.type !== 'resource' && read.type !== 'composite')) throw new Error('Expected supported sized params');
        expect(read.params.size).toBe(size);
        expect(object(read.params).opaque).toBe(opaque);
        expect(stringifyJson(params)).toContain('9007199254740993');
      }
      const params = { ...object(makeNode(type).params), opaque } as Record<string, JsonValue>;
      delete params.size;
      const original = stringifyJson(params);
      const read = readParams(params);
      if (read.status !== 'supported' || (read.type !== 'resource' && read.type !== 'composite')) throw new Error('Expected supported sized params');
      expect(read.params.size).toBe('large');
      expect(stringifyJson(params)).toBe(original);
      expect(object(params).opaque).toBe(opaque);
    }
  });
});

function objectOrNullField(value: JsonValue, key: string): JsonValue | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value) && !isLosslessNumber(value) ? value[key] : undefined;
}

describe('presentation tree operations', () => {
  it('inserts roots and children, moves siblings, and preserves every node on invalid targets or cycles', () => {
    const parent = makeNode('group', 'parent');
    const secondGroup = makeNode('group', 'second group');
    const child = makeNode('composite', 'child');
    const roots = insertNode(insertNode([parent, secondGroup], child, parent.nodeKey), makeNode('resource', 'last'), null, 1);
    expect(findNode(roots, child.nodeKey)).toBeDefined();
    expect(roots.map(node => node.title)).toEqual(['parent', 'last', 'second group']);

    const invalidMove = moveNode(roots, parent.nodeKey, child.nodeKey, 0);
    expect(invalidMove).toBe(roots);
    expect(findNode(invalidMove, parent.nodeKey)).toBeDefined();
    const cycle = moveNode(roots, parent.nodeKey, child.nodeKey, 0);
    expect(keys(cycle)).toHaveLength(keys(roots).length);
    const invalidInsert = insertNode(roots, makeNode('stat-list'), child.nodeKey);
    expect(invalidInsert).toBe(roots);
    const invalidParentMove = moveNode(roots, secondGroup.nodeKey, child.nodeKey, 0);
    expect(invalidParentMove).toBe(roots);
    expect(findNode(invalidParentMove, secondGroup.nodeKey)).toBeDefined();

    const reordered = moveSibling(roots, secondGroup.nodeKey, 'before', parent.nodeKey);
    expect(reordered.map(node => node.title)).toEqual(['second group', 'parent', 'last']);
    const rootMoved = moveNode(reordered, child.nodeKey, null, 0);
    expect(findNode(rootMoved, child.nodeKey)?.nodeKey).toBe(child.nodeKey);
    expect(removeTreeNode(rootMoved, child.nodeKey).flatMap(node => keys([node]))).not.toContain(child.nodeKey);
  });

  it('duplicates a subtree with new keys at every level and leaves source references unchanged', () => {
    const sourceParams: JsonValue = { version: 1, type: 'composite', parts: [{ source: { kind: 'Base', fieldId: 'field-a' }, signed: true }], primary: { kind: 'Base', fieldId: 'field-a' } };
    const leaf: PresentationNode = { kind: 'layout', nodeKey: 'leaf', title: 'Leaf', params: sourceParams, children: [] };
    const parent = makeNode('group', 'Parent');
    const roots = insertNode([parent], leaf, parent.nodeKey);
    const originalKeys = keys(roots);
    const duplicate = duplicateNode(roots, parent.nodeKey);
    const duplicateParent = duplicate[1]!;
    const duplicateLeaf = duplicateParent.children[0]!;
    const allKeys = keys(duplicate);
    expect(new Set(allKeys).size).toBe(allKeys.length);
    expect(duplicateParent.nodeKey).not.toBe(parent.nodeKey);
    expect(duplicateLeaf.nodeKey).not.toBe(leaf.nodeKey);
    expect(duplicateLeaf.params).toEqual(sourceParams);
    expect(keys(roots)).toEqual(originalKeys);
    const duplicateParts = object(duplicateLeaf.params).parts;
    expect(Array.isArray(duplicateParts)).toBe(true);
    if (!Array.isArray(duplicateParts)) return;
    expect(object(duplicateParts[0]!).source).toEqual({ kind: 'Base', fieldId: 'field-a' });
  });
});

describe('campaign page model', () => {
  it('sorts numeric page suffixes and valid order values without making context-only pages visible', () => {
    const presentation: Presentation = {
      contentRevision: 1,
      defaults: { page_10: 'view-ten', page_2: 'view-two', overview: 'legacy-view' },
      contextParams: {
        page_10: { title: 'Ten', order: 'invalid', marker: false },
        page_2: { title: 'Two', order: 0, marker: 0 },
        page_99: { title: 'Not assigned', order: 1 },
        page_3: { title: 'Three', order: 1 },
      },
    };
    expect(readPages(presentation).map(page => [page.key, page.title])).toEqual([['page_2', 'Two'], ['page_10', 'Ten']]);
    expect(isPageKey('page_1')).toBe(true);
    expect(isPageKey('page_0')).toBe(false);
    expect(isPageKey('page_01')).toBe(false);
    expect(isPageKey('character.overview')).toBe(false);

    const ordered: Presentation = { ...presentation, contextParams: { ...presentation.contextParams, page_10: { title: 'Ten', order: 1 }, page_2: { title: 'Two', order: 2 } } };
    expect(readPages(ordered).map(page => page.key)).toEqual(['page_10', 'page_2']);

    const losslessOrder: Presentation = {
      contentRevision: 1,
      defaults: { page_2: 'view-two', page_10: 'view-ten' },
      contextParams: { page_2: { title: 'Two', order: lossless('9007199254740993') }, page_10: { title: 'Ten', order: lossless('9007199254740992') } },
    };
    expect(readPages(losslessOrder).map(page => page.key)).toEqual(['page_10', 'page_2']);
  });

  it('adds keys after all assigned and context-only suffixes using bigint arithmetic', () => {
    const presentation: Presentation = { contentRevision: 1, defaults: { page_2: 'v2' }, contextParams: { page_500: { title: 'Context only' } } };
    expect(addPageKey(presentation)).toBe('page_501');
    const huge = { contentRevision: 1, defaults: {}, contextParams: { page_9223372036854775807: null } };
    expect(addPageKey(huge)).toBe('page_9223372036854775808');
  });

  it('writes reordered pages and deletes only page assignments while preserving non-page and opaque lossless data', () => {
    const large = lossless('9223372036854775807');
    const original: Presentation = {
      contentRevision: 7,
      defaults: { page_2: 'view-two', page_10: 'view-ten', character_overview: 'view-legacy' },
      contextParams: {
        page_2: { title: 'Two', order: 0, flag: false },
        page_10: { title: 'Ten', order: 99, label: '', opaque: { count: large } },
        page_99: { contextOnly: { retained: true } },
        character_overview: { opaqueContext: { exact: large } },
        other: [0, false, ''],
      },
    };
    const pages = readPages(original);
    const pageTen = pages.find(page => page.key === 'page_10')!;
    const reordered: PresentationPage[] = [
      { ...pageTen, title: 'Renamed Ten' },
      { key: 'page_11', title: 'New', viewKey: 'view-new' },
    ];
    const updated = writePages(original, reordered);
    expect(updated.defaults).toEqual({ page_10: 'view-ten', page_11: 'view-new', character_overview: 'view-legacy' });
    expect(updated.contextParams.character_overview).toEqual({ opaqueContext: { exact: large } });
    expect(updated.contextParams.page_99).toEqual({ contextOnly: { retained: true } });
    expect(updated.contextParams.page_99).toEqual({ contextOnly: { retained: true } });
    expect(updated.contextParams.other).toEqual([0, false, '']);
    expect(object(object(updated.contextParams.page_10!).opaque).count).toBe(large);
    expect(object(updated.contextParams.page_10!).title).toBe('Renamed Ten');
    expect(object(updated.contextParams.page_10!).label).toBe('');
    expect(object(updated.contextParams.page_10!).order).toBe(1);
    expect(updated.contextParams.page_11).toEqual({ title: 'New', order: 2 });
    expect(updated.defaults).not.toHaveProperty('page_2');
    expect(updated.contextParams).not.toHaveProperty('page_2');
    expect(stringifyJson(updated.contextParams.page_10)).toContain('9223372036854775807');
    expect(original.defaults.page_10).toBe('view-ten');
  });

  it('preserves scalar page params through explicit editing without changing existing keys', () => {
    const original: Presentation = { contentRevision: 3, defaults: { page_2: 'v2', page_10: 'v10' }, contextParams: { page_2: 'opaque legacy' } };
    const pages = readPages(original);
    const updated = writePages(original, pages.map(page => ({ ...page, title: page.title })));
    expect(updated.defaults).toEqual({ page_2: 'v2', page_10: 'v10' });
    expect(updated.contextParams.page_2).toEqual({ legacyParams: 'opaque legacy', title: 'Страница 2', order: 1 });
    expect(updated.contextParams.page_10).toEqual({ title: 'Страница 10', order: 2 });
    expect(Object.keys(updated.defaults).filter(isPageKey)).toEqual(['page_2', 'page_10']);
  });

  it('keeps surface slots, pages, unknown contexts, and per-view editor surfaces independent', () => {
    const exact = lossless('9223372036854775807');
    const viewKey = 'view-a';
    const original: Presentation = {
      contentRevision: 12,
      defaults: { page_1: viewKey, [surfaceContextKeys.header]: 'header-view', [surfaceContextKeys.card]: 'card-view', future: 'future-view' },
      contextParams: { page_1: { title: 'Page' }, future: { opaque: exact }, [`view_${viewKey}`]: { editorSurface: 'page', extra: false } },
    };
    const slots = writeSurfaceAssignments(original, { header: '', card: viewKey });
    expect(slots.defaults).toEqual({ page_1: viewKey, [surfaceContextKeys.card]: viewKey, future: 'future-view' });
    expect(readSurfaceAssignment(slots, 'header')).toBe('');
    expect(readSurfaceAssignment(slots, 'card')).toBe(viewKey);
    expect(slots.contextParams).toEqual(original.contextParams);

    const updatedView = writeViewSurface(slots, viewKey, 'card');
    expect(readViewSurface(updatedView, viewKey)).toBe('card');
    expect(updatedView.defaults).toEqual(slots.defaults);
    expect(object(updatedView.contextParams[`view_${viewKey}`]!).extra).toBe(false);
    expect(object(updatedView.contextParams.future!).opaque).toBe(exact);
    expect(readPages(updatedView)).toMatchObject([{ key: 'page_1', viewKey, title: 'Page' }]);

    const removed = writeSurfaceAssignments(updatedView, { header: 'header-view', card: '' });
    expect(readSurfaceAssignment(removed, 'header')).toBe('header-view');
    expect(readSurfaceAssignment(removed, 'card')).toBe('');
    expect(readViewSurface(removed, viewKey)).toBe('card');
    expect(removed.defaults.page_1).toBe(viewKey);
    expect(removed.defaults.future).toBe('future-view');
    expect(removed.contextParams.future).toEqual({ opaque: exact });
  });
});

describe('presentation local draft model', () => {
  const scope: LocalDraftScope = { account: 'account/a', campaign: 'campaign 7', view: 'view?x', schemaVersion: 1 };

  it('uses an encoded scoped key and round-trips native precision while whitelisting the draft DTO', () => {
    const largeRevision = lossless('9223372036854775807');
    const exactParam = lossless('9007199254740993');
    const root = makeNode('group', 'Root');
    const params: JsonValue = { version: 1, type: 'group', direction: 'row', columns: 1, gap: 'small', appearance: 'plain', opaque: exactParam };
    const roots = [{ ...root, params }];
    const largeMetadataRevision = lossless('9007199254740993');
    const draft: LocalDraft = { ...scope, roots, name: 'Unsaved name', surface: 'card', baseContentRevision: largeRevision, baseMetadataRevision: largeMetadataRevision };
    const serialized = stringifyDraft(draft);
    expect(serialized).toContain('9223372036854775807');
    expect(serialized).toContain('9007199254740993');
    expect(serialized).not.toContain('characterId');
    expect(serialized).not.toContain('previewCharacter');

    const withExtraneousData = stringifyJson({ ...draft, characterId: 'game-character', gameplayValue: 999, roots: [{ ...roots[0]!, gameplayValue: 999 }] });
    const parsed = parseDraft(withExtraneousData, scope);
    expect(parsed.status).toBe('ok');
    if (parsed.status !== 'ok') return;
    expect(parsed.draft).not.toHaveProperty('characterId');
    expect(parsed.draft).not.toHaveProperty('gameplayValue');
    expect(parsed.draft.surface).toBe('card');
    expect(parsed.draft.roots[0]!).not.toHaveProperty('gameplayValue');
    expect(isLosslessNumber(parsed.draft.baseContentRevision)).toBe(true);
    expect(isLosslessNumber(parsed.draft.baseMetadataRevision)).toBe(true);
    const restoredRoot = parsed.draft.roots[0]!;
    expect(isLosslessNumber(object(restoredRoot.params).opaque)).toBe(true);
    expect(stringifyJson(restoredRoot.params)).toContain('9007199254740993');
    expect(stringifyJson(parsed.draft)).not.toContain('game-character');
    const oldRead = parseDraft(stringifyDraft({ ...draft, surface: undefined }), scope);
    expect(oldRead.status).toBe('ok');
    if (oldRead.status === 'ok') expect(oldRead.draft.surface).toBeUndefined();
  });

  it('rejects a different scope, malformed payload, and duplicate keys across the tree', () => {
    const root = makeNode('group', 'Root');
    const draft: LocalDraft = { ...scope, roots: [root], name: 'Name', baseContentRevision: 2, baseMetadataRevision: 3 };
    expect(parseDraft(stringifyDraft(draft), { ...scope, account: 'another' }).status).toBe('error');
    expect(parseDraft('{bad json', scope).status).toBe('error');
    const duplicate = { ...root, children: [{ ...root, title: 'duplicate' }] };
    expect(parseDraft(stringifyJson({ ...draft, roots: [duplicate] }), scope)).toMatchObject({ status: 'error' });
    expect(parseDraft(stringifyJson({ ...draft, schemaVersion: 2 }), scope).status).toBe('error');
    expect(parseDraft(stringifyJson({ ...draft, baseMetadataRevision: 0 }), scope).status).toBe('error');
  });

  it('surfaces storage read errors and propagates explicit write errors to its caller', () => {
    const readFailure = { getItem: () => { throw new Error('private storage detail'); } } as Pick<Storage, 'getItem'>;
    expect(readLocalDraft(readFailure, scope)).toMatchObject({ status: 'error' });
    const serialized = stringifyDraft({ ...scope, roots: [], name: '', baseContentRevision: 1, baseMetadataRevision: 1 });
    expect(readLocalDraft({ getItem: () => serialized } as Pick<Storage, 'getItem'>, scope)?.status).toBe('ok');
    const writeFailure = { setItem: () => { throw new Error('quota'); } } as Pick<Storage, 'setItem'>;
    const draft: LocalDraft = { ...scope, roots: [], name: 'Name', baseContentRevision: 1, baseMetadataRevision: 1 };
    expect(() => writeLocalDraft(writeFailure, draft)).toThrow('quota');
    expect(localDraftKey(draft)).toBe(`tdn:presentation-draft:${encodeURIComponent(scope.account)}:${encodeURIComponent(scope.campaign)}:${encodeURIComponent(scope.view)}:1`);
  });
});
