import { describe, expect, it } from 'vitest';
import { LosslessNumber } from 'lossless-json';
import type { JsonValue } from './types';
import { duplicateNode, makeNode, moveNode, removeTreeNode, updateNode, type PresentationNode } from './presentationModel';

const makeTreeNode = (nodeKey: string, type: 'group' | 'composite' = 'composite', children: PresentationNode[] = []): PresentationNode => {
  const base = makeNode(type, nodeKey);
  const opaque = new LosslessNumber('9007199254740993');
  return { ...base, nodeKey, children, params: { ...(base.params as Record<string, JsonValue>), opaque, source: { kind: 'Base', fieldId: `field-${nodeKey}` } } };
};

const keys = (roots: PresentationNode[]): string[] => roots.flatMap(node => [node.nodeKey, ...keys(node.children)]);

describe('presentation model structural sharing', () => {
  it('updates only the target and its ancestor path while retaining unrelated references and opaque values', () => {
    const untouchedLeaf = makeTreeNode('untouched-leaf');
    const untouchedBranch = makeTreeNode('untouched-branch', 'group', [untouchedLeaf]);
    const editedLeaf = makeTreeNode('edited-leaf');
    const siblingLeaf = makeTreeNode('sibling-leaf');
    const editedBranch = makeTreeNode('edited-branch', 'group', [editedLeaf, siblingLeaf]);
    const untouchedRoot = makeTreeNode('untouched-root', 'group', [untouchedBranch]);
    const roots = [untouchedRoot, editedBranch];
    const originalParams = editedLeaf.params;
    const opaque = (originalParams as Record<string, JsonValue>).opaque;
    const source = (originalParams as Record<string, JsonValue>).source;

    const updated = updateNode(roots, editedLeaf.nodeKey, current => ({ ...current, title: 'changed' }));

    expect(updated).not.toBe(roots);
    expect(updated[0]).toBe(untouchedRoot);
    expect(updated[1]).not.toBe(editedBranch);
    expect(updated[1]?.children).not.toBe(editedBranch.children);
    expect(updated[1]?.children[0]).not.toBe(editedLeaf);
    expect(updated[1]?.children[0]?.title).toBe('changed');
    expect(updated[1]?.children[0]?.params).toBe(originalParams);
    expect((updated[1]?.children[0]?.params as Record<string, JsonValue>).opaque).toBe(opaque);
    expect((updated[1]?.children[0]?.params as Record<string, JsonValue>).source).toBe(source);
    expect(updated[1]?.children[0]?.children).toBe(editedLeaf.children);
    expect(updated[1]?.children[1]).toBe(siblingLeaf);
    expect(updated[1]?.children[1]?.params).toBe(siblingLeaf.params);
    expect(untouchedBranch.children).toBe(untouchedRoot.children[0]?.children);
    expect(roots[1]).toBe(editedBranch);
    expect(editedLeaf.title).toBe('edited-leaf');
  });

  it('returns exact roots references for missing targets, same-node updates, and missing removals', () => {
    const leaf = makeTreeNode('leaf');
    const root = makeTreeNode('root', 'group', [leaf]);
    const roots = [root];
    const missingUpdate = vi.fn((current: PresentationNode) => current);

    expect(updateNode(roots, 'missing', missingUpdate)).toBe(roots);
    expect(missingUpdate).not.toHaveBeenCalled();
    expect(updateNode(roots, leaf.nodeKey, current => current)).toBe(roots);
    expect(removeTreeNode(roots, 'missing')).toBe(roots);
  });

  it.each([
    { key: 'first', index: 0 },
    { key: 'first', index: 1 },
    { key: 'middle', index: 1 },
    { key: 'middle', index: 2 },
    { key: 'last', index: 3 },
    { key: 'last', index: 30 },
    { key: 'first', index: -4 },
  ])('keeps a same-position move of $key at insertion index $index as the original roots array', ({ key, index }) => {
    const siblings = ['first', 'middle', 'last'].map(id => makeTreeNode(id));
    const rootGroup = makeTreeNode('container', 'group', siblings);
    const rootSet = [...siblings];
    const nestedSet = [rootGroup];

    expect(moveNode(rootSet, key, null, index)).toBe(rootSet);
    expect(moveNode(nestedSet, key, rootGroup.nodeKey, index)).toBe(nestedSet);
  });

  it('moves before and after within a sibling list without replacing moved nodes or their payloads', () => {
    const first = makeTreeNode('first');
    const middle = makeTreeNode('middle');
    const last = makeTreeNode('last');
    const opaque = (middle.params as Record<string, JsonValue>).opaque;
    const source = (middle.params as Record<string, JsonValue>).source;
    const roots = [first, middle, last];

    const movedBefore = moveNode(roots, middle.nodeKey, null, 0);
    expect(movedBefore.map(node => node.nodeKey)).toEqual(['middle', 'first', 'last']);
    expect(movedBefore[0]).toBe(middle);
    expect(movedBefore[0]?.params).toBe(middle.params);
    expect((movedBefore[0]?.params as Record<string, JsonValue>).opaque).toBe(opaque);
    expect((movedBefore[0]?.params as Record<string, JsonValue>).source).toBe(source);
    expect(movedBefore[1]).toBe(first);
    expect(movedBefore[2]).toBe(last);

    const movedAfter = moveNode(roots, first.nodeKey, null, 2);
    expect(movedAfter.map(node => node.nodeKey)).toEqual(['middle', 'first', 'last']);
    expect(movedAfter[0]).toBe(middle);
    expect(movedAfter[1]).toBe(first);
    expect(movedAfter[2]).toBe(last);
    expect(roots).toEqual([first, middle, last]);
  });

  it('moves between groups while retaining unrelated branch identity and all node data', () => {
    const movedLeaf = makeTreeNode('moved-leaf');
    const sourceSibling = makeTreeNode('source-sibling');
    const sourceGroup = makeTreeNode('source-group', 'group', [movedLeaf, sourceSibling]);
    const targetSibling = makeTreeNode('target-sibling');
    const targetGroup = makeTreeNode('target-group', 'group', [targetSibling]);
    const unrelated = makeTreeNode('unrelated', 'group', [makeTreeNode('unrelated-child')]);
    const roots = [sourceGroup, targetGroup, unrelated];
    const movedParams = movedLeaf.params;

    const moved = moveNode(roots, movedLeaf.nodeKey, targetGroup.nodeKey, 1);

    expect(moved.map(node => node.nodeKey)).toEqual(['source-group', 'target-group', 'unrelated']);
    expect(moved[0]).not.toBe(sourceGroup);
    expect(moved[0]?.params).toBe(sourceGroup.params);
    expect(moved[0]?.children.map(node => node.nodeKey)).toEqual(['source-sibling']);
    expect(moved[0]?.children[0]).toBe(sourceSibling);
    expect(moved[1]).not.toBe(targetGroup);
    expect(moved[1]?.params).toBe(targetGroup.params);
    expect(moved[1]?.children.map(node => node.nodeKey)).toEqual(['target-sibling', 'moved-leaf']);
    expect(moved[1]?.children[0]).toBe(targetSibling);
    expect(moved[1]?.children[1]).toBe(movedLeaf);
    expect(moved[1]?.children[1]?.params).toBe(movedParams);
    expect(moved[2]).toBe(unrelated);
    expect(keys(moved)).toEqual(['source-group', 'source-sibling', 'target-group', 'target-sibling', 'moved-leaf', 'unrelated', 'unrelated-child']);
    expect(new Set(keys(moved)).size).toBe(keys(moved).length);
    expect(sourceGroup.children).toEqual([movedLeaf, sourceSibling]);
    expect(targetGroup.children).toEqual([targetSibling]);
  });

  it('keeps self-parent, cycle, and invalid destination moves unchanged without losing nodes', () => {
    const nestedGroup = makeTreeNode('nested-group', 'group', [makeTreeNode('leaf')]);
    const root = makeTreeNode('root', 'group', [nestedGroup]);
    const invalidDestination = makeTreeNode('not-a-group');
    const roots = [root, invalidDestination];
    const originalKeys = keys(roots);

    expect(moveNode(roots, root.nodeKey, root.nodeKey, 0)).toBe(roots);
    expect(moveNode(roots, root.nodeKey, nestedGroup.nodeKey, 0)).toBe(roots);
    expect(moveNode(roots, nestedGroup.nodeKey, invalidDestination.nodeKey, 0)).toBe(roots);
    expect(moveNode(roots, 'missing', null, 0)).toBe(roots);
    expect(keys(roots)).toEqual(originalKeys);
  });

  it('duplicates a subtree with unique keys while retaining source data and opaque lossless params', () => {
    const leaf = makeTreeNode('duplicate-leaf');
    const child = makeTreeNode('duplicate-child', 'group', [leaf]);
    const original = makeTreeNode('duplicate-root', 'group', [child]);
    const roots = [original];
    const originalKeys = keys(roots);
    const opaque = (leaf.params as Record<string, JsonValue>).opaque;
    const source = (leaf.params as Record<string, JsonValue>).source;

    const duplicated = duplicateNode(roots, original.nodeKey);
    const clone = duplicated[1]!;
    const cloneChild = clone.children[0]!;
    const cloneLeaf = cloneChild.children[0]!;

    expect(clone.nodeKey).not.toBe(original.nodeKey);
    expect(cloneChild.nodeKey).not.toBe(child.nodeKey);
    expect(cloneLeaf.nodeKey).not.toBe(leaf.nodeKey);
    expect(new Set(keys(duplicated)).size).toBe(keys(duplicated).length);
    expect(cloneLeaf.params).toEqual(leaf.params);
    expect((cloneLeaf.params as Record<string, JsonValue>).opaque).toBe(opaque);
    expect((cloneLeaf.params as Record<string, JsonValue>).source).toBe(source);
    expect(roots[0]).toBe(original);
    expect(keys(roots)).toEqual(originalKeys);
    expect(leaf.params).toBe(cloneLeaf.params);
  });

  it('removes a nested leaf while preserving unrelated roots, subtrees, and params references', () => {
    const removed = makeTreeNode('removed');
    const keptSibling = makeTreeNode('kept-sibling');
    const parent = makeTreeNode('parent', 'group', [removed, keptSibling]);
    const unrelatedChild = makeTreeNode('unrelated-child');
    const unrelated = makeTreeNode('unrelated', 'group', [unrelatedChild]);
    const roots = [parent, unrelated];

    const next = removeTreeNode(roots, removed.nodeKey);

    expect(next).not.toBe(roots);
    expect(next[0]).not.toBe(parent);
    expect(next[0]?.params).toBe(parent.params);
    expect(next[0]?.children).not.toBe(parent.children);
    expect(next[0]?.children).toEqual([keptSibling]);
    expect(next[0]?.children[0]).toBe(keptSibling);
    expect(next[1]).toBe(unrelated);
    expect(next[1]?.children).toBe(unrelated.children);
    expect(next[1]?.children[0]).toBe(unrelatedChild);
    expect(roots[0]?.children).toEqual([removed, keptSibling]);
  });
});
